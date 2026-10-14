# Refresh Token Rotation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hoàn thiện refresh-token rotation, reuse detection, HTTP endpoint và E2E tests cho Task 12 của Phase 1.

**Architecture:** `AuthController` đọc refresh token từ cookie HttpOnly rồi gọi `AuthService`. `AuthService` khóa refresh-session trong transaction, rotate token hợp lệ hoặc revoke toàn bộ family khi phát hiện token cũ bị reuse. Reuse phải được trả ra khỏi callback transaction rồi mới ném `401`, để thao tác revoke được commit.

**Tech Stack:** NestJS 12, TypeScript 6, TypeORM, PostgreSQL, Jest, Supertest, cookie-parser.

**Spec:** `specs-manager/phase-1-authentication-access-design.md`

## Global Constraints

- Không lưu hoặc trả refresh token plaintext trong JSON/database/log.
- Mỗi refresh thành công phải rotate token và giữ nguyên `familyId`.
- Cookie dùng `HttpOnly`, `SameSite=Lax`, path `/api/auth` và cấu hình `Secure` theo environment.
- Reuse một token đã được thay thế phải revoke mọi session active cùng family.
- Không ném reuse exception bên trong transaction sau khi revoke family, vì exception sẽ rollback revoke.

## Review Focus

- Cookie thiếu phải trả `401 AUTH_REFRESH_TOKEN_MISSING` và không gọi AuthService.
- Token không tồn tại, hết hạn hoặc bị logout không được tạo token/session mới.
- Token đã rotate bị dùng lại phải revoke session thay thế đang active.
- Hai token sau rotation phải khác nhau và old session phải trỏ tới replacement session.
- Response không chứa refresh token, password hash hoặc token digest.

---

### Task 1: Hoàn thiện reuse detection trong AuthService

**Files:**
- Modify: `apps/api/src/auth/auth.service.spec.ts`
- Modify: `apps/api/src/auth/auth.service.ts`

**Interfaces:**
- Consumes: `RefreshSessionsService.revokeActiveSessionsByFamilyId(familyId, entityManager)`.
- Produces: `AuthService.refresh(refreshToken): Promise<AuthSessionResult>` với rotation và reuse detection.

- [ ] **Step 1: Mở rộng refresh-session mock**

Thêm `revokeActiveSessionsByFamilyId: jest.Mock` vào type và `beforeEach` của `refreshSessionsService` trong `auth.service.spec.ts`.

- [ ] **Step 2: Viết test token không tồn tại**

Mock digest và `findByTokenDigestForUpdate` trả `null`. Assert `401` có:

```ts
{
  code: 'AUTH_REFRESH_TOKEN_INVALID',
  message: 'Refresh token không hợp lệ',
}
```

Assert không gọi `findById`, `generateRefreshToken`, `rotateActiveSession` hoặc `issueAccessToken`.

- [ ] **Step 3: Viết test user không tồn tại**

Mock một active session nhưng `usersService.findById` trả `null`. Assert cùng lỗi `AUTH_REFRESH_TOKEN_INVALID`, không generate/rotate/issue token.

- [ ] **Step 4: Viết test reuse detection**

Tạo session có cả:

```ts
revokedAt: new Date('2026-10-09T00:00:00.000Z'),
replacedBySessionId: '44444444-4444-4444-8444-444444444444',
```

Thay implementation của transaction trong riêng test để đánh dấu callback đã resolve:

```ts
let transactionCompleted = false;

dataSource.transaction.mockImplementationOnce(
  async (
    callback: (manager: EntityManager) => Promise<unknown>,
  ) => {
  const result = await callback(entityManager);
  transactionCompleted = true;
  return result;
  },
);
```

Assert:

```ts
await expect(
  authService.refresh('reused-refresh-token'),
).rejects.toMatchObject({ status: 401 });

expect(
  refreshSessionsService.revokeActiveSessionsByFamilyId,
).toHaveBeenCalledWith(reusedSession.familyId, entityManager);

expect(transactionCompleted).toBe(true);
expect(usersService.findById).not.toHaveBeenCalled();
expect(tokenService.generateRefreshToken).not.toHaveBeenCalled();
expect(refreshSessionsService.rotateActiveSession).not.toHaveBeenCalled();
```

Trong `catch` hoặc bằng cách bắt exception riêng, kiểm tra response:

```ts
{
  code: 'AUTH_REFRESH_TOKEN_REUSED',
  message: 'Phát hiện refresh token đã được sử dụng lại',
}
```

- [ ] **Step 5: Thêm discriminated union nội bộ**

Đặt trên class `AuthService`:

```ts
type RefreshTransactionResult =
  | {
      status: 'success';
      value: AuthSessionResult;
    }
  | {
      status: 'reused';
    };
```

- [ ] **Step 6: Sửa `AuthService.refresh`**

Callback transaction trả `Promise<RefreshTransactionResult>`. Nhánh revoked phải là:

```ts
if (currentSession.revokedAt) {
  if (currentSession.replacedBySessionId) {
    await this.refreshSessionsService.revokeActiveSessionsByFamilyId(
      currentSession.familyId,
      entityManager,
    );

    return { status: 'reused' };
  }

  throw this.createRevokedRefreshToken();
}
```

Nhánh thành công trả:

```ts
return {
  status: 'success',
  value: {
    response: {
      user: toSafeUser(user),
      accessToken,
      accessTokenExpiresIn:
        this.tokenService.getAccessTokenExpiresInSeconds(),
    },
    refreshToken: replacementRefreshToken,
  },
};
```

Sau khi transaction đã resolve:

```ts
if (transactionResult.status === 'reused') {
  throw this.createReusedRefreshToken();
}

return transactionResult.value;
```

Thêm helper:

```ts
private createReusedRefreshToken(): UnauthorizedException {
  return new UnauthorizedException({
    code: 'AUTH_REFRESH_TOKEN_REUSED',
    message: 'Phát hiện refresh token đã được sử dụng lại',
  });
}
```

- [ ] **Step 7: Verify AuthService**

```bash
pnpm --filter @project-management/api test auth.service.spec.ts --runInBand
pnpm --filter @project-management/api typecheck
pnpm --filter @project-management/api lint
```

---

### Task 2: Thêm HTTP refresh endpoint

**Files:**
- Modify: `apps/api/src/auth/controllers/auth.controller.spec.ts`
- Modify: `apps/api/src/auth/controllers/auth.controller.ts`

**Interfaces:**
- Consumes: `RefreshTokenCookieService.getRefreshToken`, `setRefreshToken`, `clearRefreshToken` và `AuthService.refresh`.
- Produces: `POST /api/auth/refresh` trả `AuthResponse` và rotate cookie.

- [ ] **Step 1: Mở rộng controller mocks**

Thêm `refresh` vào `authService`; thêm `getRefreshToken` và `clearRefreshToken` vào `cookieService`. Tạo `request = {} as Request` trong `beforeEach`.

- [ ] **Step 2: Test success**

Mock cookie service trả `current-refresh-token`, AuthService trả safe response cùng `replacement-refresh-token`. Assert controller:

```ts
expect(cookieService.getRefreshToken).toHaveBeenCalledWith(request);
expect(authService.refresh).toHaveBeenCalledWith('current-refresh-token');
expect(cookieService.setRefreshToken).toHaveBeenCalledWith(
  response,
  'replacement-refresh-token',
);
expect(result).toEqual(authResponse);
expect(result).not.toHaveProperty('refreshToken');
```

- [ ] **Step 3: Test missing cookie**

Mock `getRefreshToken` trả `undefined`. Assert `401` response:

```ts
{
  code: 'AUTH_REFRESH_TOKEN_MISSING',
  message: 'Không tìm thấy refresh token',
}
```

Assert `authService.refresh` và `setRefreshToken` không được gọi; `clearRefreshToken(response)` được gọi.

- [ ] **Step 4: Test AuthService failure**

Mock cookie hợp lệ nhưng `authService.refresh` reject. Assert controller giữ nguyên exception, clear cookie và không set cookie mới.

- [ ] **Step 5: Implement endpoint**

Import `Req`, `Request` và thêm:

```ts
@Post('refresh')
@HttpCode(HttpStatus.OK)
async refresh(
  @Req() request: Request,
  @Res({ passthrough: true }) response: Response,
): Promise<AuthResponse> {
  const refreshToken = this.cookieService.getRefreshToken(request);

  if (!refreshToken) {
    this.cookieService.clearRefreshToken(response);
    throw this.createMissingRefreshToken();
  }

  try {
    const result = await this.authService.refresh(refreshToken);
    this.cookieService.setRefreshToken(response, result.refreshToken);
    return result.response;
  } catch (error) {
    this.cookieService.clearRefreshToken(response);
    throw error;
  }
}
```

Thêm helper private trả `UnauthorizedException` với code/message của test.

- [ ] **Step 6: Verify controller**

```bash
pnpm --filter @project-management/api test auth.controller.spec.ts --runInBand
pnpm --filter @project-management/api typecheck
pnpm --filter @project-management/api lint
```

---

### Task 3: E2E refresh rotation

**Files:**
- Create: `apps/api/test/auth-refresh.e2e-spec.ts`

**Interfaces:**
- Consumes: `POST /api/auth/register` và `POST /api/auth/refresh`.
- Produces: bằng chứng HTTP + PostgreSQL cho rotation.

- [ ] **Step 1: Tạo E2E harness**

Dùng cấu trúc từ `auth-login.e2e-spec.ts`, nhưng thêm:

```ts
import cookieParser from 'cookie-parser';
```

và trong `beforeAll`, trước pipe:

```ts
app.use(cookieParser());
```

`beforeEach` xóa user test rồi register. Lưu response register để lấy cookie hoặc tạo helper `registerAndGetCookie()`.

- [ ] **Step 2: Test rotation thành công**

Lấy cookie pair bằng:

```ts
const originalCookie = setCookieHeaders[0]?.split(';')[0] ?? '';
```

Gửi:

```ts
const response = await request(app.getHttpServer())
  .post('/api/auth/refresh')
  .set('Cookie', originalCookie)
  .expect(200);
```

Assert response có safe user, access token string, TTL 900 và không có refresh token/digest/passwordHash. Assert cookie mới khác cookie cũ.

Query PostgreSQL và assert:

- Có 2 session trong cùng family.
- Session cũ có `revokedAt` khác null.
- `oldSession.replacedBySessionId === newSession.id`.
- Session mới có `revokedAt === null` và `replacedBySessionId === null`.

- [ ] **Step 3: Verify E2E rotation**

```bash
NODE_ENV=test pnpm --filter @project-management/api test:e2e auth-refresh.e2e-spec.ts --runInBand
```

---

### Task 4: E2E refresh-token reuse

**Files:**
- Modify: `apps/api/test/auth-refresh.e2e-spec.ts`

**Interfaces:**
- Consumes: rotation test setup.
- Produces: bằng chứng replay token cũ revoke cả family.

- [ ] **Step 1: Viết reuse test**

Register để có cookie R1. Gọi refresh lần đầu bằng R1 và xác nhận `200`, tạo R2. Sau đó gọi lại refresh bằng chính R1:

```ts
const reuseResponse = await request(app.getHttpServer())
  .post('/api/auth/refresh')
  .set('Cookie', originalCookie)
  .expect(401);
```

Assert:

```ts
expect(reuseResponse.body).toMatchObject({
  code: 'AUTH_REFRESH_TOKEN_REUSED',
  message: 'Phát hiện refresh token đã được sử dụng lại',
});
```

Header `set-cookie` phải chứa `refresh_token=` và dấu hiệu cookie bị xóa (`Max-Age=0` hoặc expiry trong quá khứ).

Query toàn bộ session của family rồi assert:

```ts
expect(familySessions).toHaveLength(2);
expect(familySessions.every((session) => session.revokedAt !== null)).toBe(
  true,
);
```

- [ ] **Step 2: Test cookie thiếu**

Gọi `/api/auth/refresh` không có cookie, expect `401 AUTH_REFRESH_TOKEN_MISSING`; DB không tạo thêm session.

- [ ] **Step 3: Verify reuse E2E**

```bash
NODE_ENV=test pnpm --filter @project-management/api test:e2e auth-refresh.e2e-spec.ts --runInBand
```

---

### Task 5: Hoàn thiện và kiểm tra Task 12

**Files:**
- Modify: các file Task 12 đã thay đổi nếu formatter yêu cầu.

- [ ] **Step 1: Format**

```bash
pnpm --filter @project-management/api exec prettier --write \
  src/auth/auth.service.ts \
  src/auth/auth.service.spec.ts \
  src/auth/controllers/auth.controller.ts \
  src/auth/controllers/auth.controller.spec.ts \
  src/auth/services/refresh-token-cookie.service.ts \
  src/auth/services/refresh-token-cookie.service.spec.ts \
  src/refresh-sessions/refresh-sessions.service.ts \
  src/refresh-sessions/refresh-sessions.service.spec.ts \
  src/users/users.service.ts \
  src/users/users.service.spec.ts \
  test/auth-refresh.e2e-spec.ts
```

- [ ] **Step 2: Chạy toàn bộ API verification**

```bash
pnpm --filter @project-management/api test --runInBand
NODE_ENV=test pnpm --filter @project-management/api test:e2e --runInBand
pnpm --filter @project-management/api typecheck
pnpm --filter @project-management/api lint
pnpm --filter @project-management/api build
git diff --check
git status --short
```

- [ ] **Step 3: Review an toàn**

Kiểm tra diff không chứa refresh token/secret thật, không lưu plaintext token vào entity và không có log token.

- [ ] **Step 4: Commit sau khi toàn bộ xanh**

```bash
git add \
  apps/api/package.json \
  apps/api/src/auth \
  apps/api/src/main.ts \
  apps/api/src/refresh-sessions \
  apps/api/src/users \
  apps/api/test/auth-refresh.e2e-spec.ts \
  docs/superpowers/plans/2026-10-09-refresh-token-rotation.md \
  pnpm-lock.yaml

git commit -m "feat(auth): add refresh token rotation"
```
