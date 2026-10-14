# Runbook Authentication

Tài liệu này hướng dẫn chạy, kiểm tra và xử lý sự cố cho luồng authentication của Project Management K2H ở local và DEV.

## Phạm vi

Luồng hiện được hỗ trợ:

```text
Register → Protected Home → Reload/Refresh → Logout → Login
```

Backend cung cấp register, login, refresh rotation, logout, current user, JWT guard và role guard. Frontend cung cấp AuthProvider, access token trong memory, Login/Register, protected routing và Home cơ bản.

Quên mật khẩu, email verification, MFA, social login và trang quản trị user chưa thuộc phạm vi hiện tại.

## Chạy local

Từ root repository:

```bash
cp .env.example .env
pnpm install
pnpm db:up
pnpm db:migration:run
pnpm dev
```

Các địa chỉ:

| Chức năng | URL |
| --- | --- |
| Register | `http://localhost:5173/register` |
| Login | `http://localhost:5173/login` |
| Protected Home | `http://localhost:5173/` |
| API health | `http://localhost:3000/api/health` |
| Swagger local | `http://localhost:3000/api/docs` |

Vite proxy chuyển `/api/*` tới `127.0.0.1:3000`. Nếu Web báo `502` hoặc terminal hiện `ECONNREFUSED 127.0.0.1:3000`, kiểm tra terminal API trước; proxy không thể hoạt động khi NestJS chưa compile hoặc chưa listen port `3000`.

## Auth smoke test local

1. Mở `/register`.
2. Nhập display name, email hợp lệ và password từ 10 đến 128 ký tự.
3. Xác nhận chuyển về Home và chỉ thấy display name, email, role.
4. Reload Home; phiên phải được khôi phục bằng refresh cookie.
5. Mở `/login` khi đã authenticated; ứng dụng phải chuyển về Home.
6. Đăng xuất; ứng dụng phải chuyển về Login.
7. Truy cập `/` khi đã logout; ứng dụng phải chuyển về Login.
8. Đăng nhập sai và xác nhận UI chỉ hiển thị thông báo chung, không tiết lộ email có tồn tại hay không.
9. Đăng nhập đúng và xác nhận quay lại protected location ban đầu.

`POST /api/auth/refresh` trả `401` trước lần đăng nhập đầu tiên hoặc sau logout là bình thường.

## Auth smoke test DEV

Sau khi workflow `Deploy DEV` thành công, mở:

```text
https://dev.kiotrandev.tech/register
```

Dùng một tài khoản test riêng cho DEV và thực hiện lại smoke test local. Bổ sung các kiểm tra:

- reload trình duyệt vẫn khôi phục phiên;
- cookie refresh có `HttpOnly`, `Secure` và policy `SameSite` đúng cấu hình;
- `/login` và `/register` redirect về Home khi session còn hiệu lực;
- logout xóa phiên và refresh tiếp theo bị từ chối;
- không có password, access token, refresh token hoặc cookie value trong log/ảnh chụp.

Không dùng tài khoản cá nhân thật và không ghi credential test vào repository, PR, issue hoặc workflow input.

## Mô hình token

- Access token có TTL ngắn và chỉ nằm trong memory của tab Web.
- Refresh token nằm trong HttpOnly cookie nên JavaScript không đọc được.
- Reload làm mất access token; AuthProvider gọi refresh để lấy access token mới.
- Nhiều protected request cùng nhận `401` dùng chung một refresh Promise.
- Refresh thất bại sẽ xóa auth state và đưa user về Login.
- Refresh token cũ bị vô hiệu sau rotation; reuse detection revoke toàn bộ token family.

Không thêm token vào `localStorage`, `sessionStorage`, IndexedDB hoặc URL.

## Lỗi thường gặp

### Web báo 502 hoặc ECONNREFUSED

Kiểm tra API:

```bash
pnpm --filter @project-management/api typecheck
pnpm --filter @project-management/api dev
curl -i http://127.0.0.1:3000/api/health
```

Chỉ kiểm tra Vite proxy sau khi API health trả `200`:

```bash
curl -i http://127.0.0.1:5173/api/health
```

### Reload luôn quay về Login

Kiểm tra theo thứ tự:

1. `POST /api/auth/refresh` có gửi cookie hay không.
2. Local dùng `AUTH_COOKIE_SECURE=false`; DEV phải dùng `true`.
3. `AUTH_COOKIE_SAME_SITE=none` chỉ hợp lệ khi Secure là `true`.
4. Hostname và HTTPS có khớp môi trường tạo cookie hay không.
5. Refresh session có hết hạn, bị revoke hoặc reuse detection thu hồi hay không.

Không in cookie value hoặc token để debug. Chỉ ghi status code, error code an toàn và request path.

### Login luôn báo thông tin không hợp lệ

- Email được trim và lowercase; password không được trim.
- Password có khoảng trắng đầu/cuối phải được nhập đúng như lúc đăng ký.
- Backend cố ý dùng cùng một lỗi cho email không tồn tại và password sai.
- Nếu bị rate limit, chờ hết TTL thay vì thay đổi error contract để lộ tài khoản.

### Register báo email đã được sử dụng

Dùng email test khác hoặc đăng nhập bằng tài khoản hiện có. Không xóa trực tiếp user trong DEV database chỉ để chạy smoke test nếu chưa đánh giá các refresh sessions liên quan.

## Security checklist

- Không log request body của endpoint auth.
- Không log `Authorization`, cookie, token, digest hoặc password.
- Không lưu access token ở browser persistent storage.
- Register không cho client chọn role.
- Login dùng generic invalid-credentials error.
- DEV đặt `AUTH_COOKIE_SECURE=true`.
- `JWT_ACCESS_SECRET` và `REFRESH_TOKEN_PEPPER` là hai secrets độc lập.
- TypeORM giữ `synchronize=false`; schema thay đổi qua migration.

## Verification trước pull request

Chạy từ root repository sau khi PostgreSQL local healthy:

```bash
pnpm lint
pnpm typecheck
pnpm test
NODE_ENV=test SWAGGER_ENABLED=false pnpm test:e2e
pnpm build
bash infra/docker/compose.local.test.sh
bash infra/docker/compose.dev.test.sh
bash infra/ci/ci-workflow.test.sh
bash infra/ci/deploy-workflow.test.sh
bash infra/deploy/deploy-dev.test.sh
git diff --check
```

Chỉ merge khi toàn bộ lệnh thành công và CI của pull request xanh.
