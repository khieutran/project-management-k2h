# Runbook quản lý dự án

Tài liệu này hướng dẫn chạy, kiểm tra và xử lý sự cố cho chức năng quản lý dự án của Project Management K2H ở local và DEV.

## Phạm vi

Chức năng hiện hỗ trợ:

- người dùng đã đăng nhập tạo project và trở thành owner;
- owner xem, cập nhật, chuyển trạng thái, lưu trữ, khôi phục và xóa mềm project của mình;
- owner thêm tài khoản đã đăng ký, đổi role hoặc xóa thành viên khỏi project;
- thành viên xem project, xem danh sách thành viên và tự rời project;
- người dùng không thuộc project không xem được project;
- ADMIN xem được toàn bộ project, bao gồm danh sách đã xóa;
- ADMIN không được cập nhật project hoặc membership của người khác;
- Web có danh sách, tìm kiếm, lọc, phân trang, tạo, chi tiết, chỉnh sửa project và quản lý thành viên.

Tìm kiếm người dùng, gửi lời mời chờ chấp nhận, quản lý task và xóa vĩnh viễn chưa thuộc phạm vi hiện tại. Owner thêm trực tiếp tài khoản đã đăng ký bằng email chính xác.

## Quyền truy cập

| Hành động | Owner | Manager/Member | User ngoài project | ADMIN không phải owner |
| --- | --- | --- | --- | --- |
| Tạo project | Có | Có | Có | Có |
| Xem project và thành viên | Có | Có | Không | Có |
| Xem danh sách đã xóa | Không | Không | Không | Có |
| Cập nhật project/lifecycle | Có | Không | Không | Không |
| Archive/restore/xóa mềm | Có | Không | Không | Không |
| Thêm, đổi role, xóa thành viên | Có | Không | Không | Không |
| Tự rời project | Không | Có | Không | Không |

Frontend ẩn action không hợp lệ để hỗ trợ trải nghiệm người dùng. Backend vẫn là authority cuối cùng và luôn kiểm tra quyền owner; không xem việc ẩn button là một biện pháp authorization.

## Trạng thái và vòng đời

Luồng trạng thái hợp lệ:

```text
PLANNING → ACTIVE → COMPLETED
                ↑        │
                └────────┘
```

- Project mới luôn bắt đầu ở `PLANNING`.
- `PLANNING` chỉ chuyển sang `ACTIVE`.
- `ACTIVE` chỉ chuyển sang `COMPLETED`.
- `COMPLETED` có thể mở lại thành `ACTIVE`.
- Archive không thay đổi lifecycle status.
- Project đã archive không được cập nhật hoặc chuyển trạng thái cho đến khi restore.
- Delete là soft delete; dữ liệu vẫn nằm trong PostgreSQL.

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
| Web | `http://localhost:5173` |
| Danh sách project | `http://localhost:5173/projects` |
| Tạo project | `http://localhost:5173/projects/new` |
| Swagger | `http://localhost:3000/api/docs` |
| API health | `http://localhost:3000/api/health` |

Vite chuyển tiếp `/api/*` tới API tại `127.0.0.1:3000`. Nếu Web báo `ECONNREFUSED`, kiểm tra API đã compile và đang listen port `3000` trước.

## Migration

Migration tạo bảng project:

```text
apps/api/src/database/migrations/1792022400000-CreateProjects.ts
apps/api/src/database/migrations/1792108800000-CreateProjectMembers.ts
```

Trước khi chạy ứng dụng:

```bash
pnpm db:migration:show
pnpm db:migration:run
```

Không bật `synchronize`. Mọi thay đổi schema phải đi qua migration được review.

Nếu API báo `relation "projects" does not exist`, xác nhận PostgreSQL đang healthy và chạy lại `pnpm db:migration:run` trên đúng database. Không tạo bảng thủ công bằng DBeaver hoặc pgAdmin để né migration.

## Project API

Mọi endpoint dưới đây cần access token hợp lệ:

| Method | Endpoint | Chức năng |
| --- | --- | --- |
| `POST` | `/api/projects` | Tạo project |
| `GET` | `/api/projects` | Danh sách theo scope của actor |
| `GET` | `/api/projects/:projectId` | Chi tiết project |
| `PATCH` | `/api/projects/:projectId` | Owner cập nhật project |
| `PATCH` | `/api/projects/:projectId/status` | Owner chuyển lifecycle status |
| `POST` | `/api/projects/:projectId/archive` | Owner archive |
| `POST` | `/api/projects/:projectId/restore` | Owner restore |
| `DELETE` | `/api/projects/:projectId` | Owner xóa mềm |
| `GET` | `/api/projects/:projectId/members` | Actor có read scope xem owner và thành viên |
| `POST` | `/api/projects/:projectId/members` | Owner thêm tài khoản đã đăng ký |
| `PATCH` | `/api/projects/:projectId/members/:userId` | Owner đổi role thành viên |
| `DELETE` | `/api/projects/:projectId/members/:userId` | Owner xóa thành viên |
| `DELETE` | `/api/projects/:projectId/members/me` | Thành viên tự rời project |

Query của endpoint danh sách:

| Query | Mặc định | Ghi chú |
| --- | --- | --- |
| `page` | `1` | Số nguyên từ 1 |
| `limit` | `20` | Từ 1 đến 100 |
| `search` | Không có | Tìm theo name hoặc key |
| `status` | Không có | `PLANNING`, `ACTIVE`, `COMPLETED` |
| `view` | `current` | `current`, `archived`; `deleted` chỉ dành cho ADMIN |

ADMIN có thể đọc project đã xóa bằng:

```text
GET /api/projects/:projectId?includeDeleted=true
```

Không ghi access token vào tài liệu, log, issue hoặc ảnh chụp màn hình. Khi kiểm tra API thủ công, ưu tiên Swagger local hoặc browser UI thay vì lưu token trong shell history.

## Quy tắc dữ liệu

- `key` được trim, uppercase và phải gồm 2–10 ký tự `A-Z`, `0-9`.
- `key` là duy nhất và không thay đổi sau khi tạo.
- `name` dài 3–100 ký tự.
- `description` tối đa 2000 ký tự và có thể là `null`.
- `startDate`, `endDate` dùng định dạng `YYYY-MM-DD` và có thể là `null`.
- `endDate` không được trước `startDate`.
- Response chỉ trả owner an toàn gồm `id` và `displayName`.
- Membership chỉ nhận role `MANAGER` hoặc `MEMBER`; owner không nằm trong bảng `project_members`.
- Email khi thêm thành viên được trim, lowercase và phải khớp một tài khoản đã đăng ký.
- Một user chỉ có một membership trong mỗi project.
- Archive hoặc soft delete project khóa mọi mutation membership nhưng vẫn giữ dữ liệu để đọc theo scope.

Validation trên Web giúp phản hồi sớm cho người dùng nhưng không thay thế validation của API.

## Smoke test owner

1. Đăng nhập bằng tài khoản test USER.
2. Mở `/projects` và tạo project mới.
3. Xác nhận key được gợi ý; sửa key thủ công rồi đổi name và xác nhận key không bị ghi đè.
4. Mở chi tiết và cập nhật name, description, ngày bắt đầu/kết thúc.
5. Chuyển `PLANNING → ACTIVE → COMPLETED → ACTIVE`.
6. Archive project và xác nhận project xuất hiện ở tab `Đã lưu trữ`.
7. Restore project và xác nhận project trở lại tab `Hiện tại`.
8. Xóa project bằng dialog xác nhận thông thường.
9. Xác nhận owner không còn đọc được project đã xóa.

## Smoke test membership

Dùng bốn tài khoản DEV riêng: owner, member, user ngoài project và ADMIN.

1. Owner tạo project rồi thêm member bằng email với role `MEMBER`.
2. Xác nhận member thấy project, xem được danh sách thành viên nhưng không thấy action quản lý.
3. Owner đổi role member thành `MANAGER`, reload và xác nhận role mới.
4. Member tự rời project; xác nhận project biến mất và truy cập URL cũ trả `404`.
5. Owner thêm lại member rồi xóa member; xác nhận quyền đọc bị thu hồi ngay.
6. User ngoài project không thấy project và nhận `404` khi truy cập trực tiếp.
7. ADMIN xem được project và danh sách thành viên nhưng không thấy action thêm, đổi role, xóa hoặc rời project.
8. Archive project và xác nhận danh sách membership vẫn đọc được nhưng mọi mutation trả `409 PROJECT_MEMBERSHIP_LOCKED`.

Không dùng endpoint membership như API tìm kiếm tài khoản. Response lỗi khi email không tồn tại phải giữ contract an toàn, không đưa password hash, token hoặc dữ liệu riêng tư vào log.

## Smoke test scope và ADMIN

Dùng ba tài khoản test riêng: owner, user khác và ADMIN.

1. Owner tạo một project.
2. Đăng nhập user khác và xác nhận không thấy hoặc đọc được project đó.
3. Đăng nhập ADMIN và xác nhận thấy project cùng tên owner.
4. Xác nhận ADMIN không phải owner không thấy action chỉnh sửa, trạng thái, archive hoặc xóa.
5. Mở tab `Đã xóa` bằng ADMIN và xác nhận project đã xóa xuất hiện.
6. Đăng xuất rồi đăng nhập actor khác trong cùng browser và xác nhận danh sách cũ không xuất hiện trong lúc tải.

Query keys của Web có actor ID và project cache được xóa khi identity thay đổi. Không persist project QueryClient vào `localStorage`, `sessionStorage` hoặc IndexedDB.

## Lỗi thường gặp

### API trả 401

Access token có thể đã hết hạn. Web phải thử refresh session một lần rồi retry request. Nếu refresh thất bại, đăng nhập lại; không copy token vào persistent storage để “sửa” lỗi.

### API trả 403 khi mở deleted view

`view=deleted` và `includeDeleted=true` chỉ dành cho ADMIN. User thường nhận `403` là đúng contract.

### API trả 404 cho project tồn tại

Backend dùng scoped lookup. Với user không phải owner, `404` tránh tiết lộ project của người khác có tồn tại. Kiểm tra actor hiện tại trước khi kết luận dữ liệu bị mất.

### API trả 409

Các nguyên nhân thường gặp:

- project key đã tồn tại;
- khoảng ngày không hợp lệ;
- lifecycle transition không hợp lệ;
- project đang archive nên không thể chỉnh sửa hoặc chuyển trạng thái.
- membership đã tồn tại;
- project đã archive hoặc xóa nên membership bị khóa.

Sửa input hoặc restore project trước; không bỏ qua business rule ở frontend.

## Verification trước pull request

Sau khi PostgreSQL local healthy, chạy từ root repository:

```bash
pnpm test
NODE_ENV=test SWAGGER_ENABLED=false pnpm test:e2e
pnpm typecheck
pnpm lint
pnpm build
bash infra/docker/api-runtime.test.sh
bash infra/ci/ci-workflow.test.sh
bash infra/ci/deploy-workflow.test.sh
git diff --check
```

Chỉ merge khi toàn bộ lệnh thành công và CI của pull request xanh.

## Rollback boundary

Deploy engine chạy migration trước khi thay API và Web. Nếu candidate application không healthy, engine rollback application images nhưng không tự động revert migration.

Migration project và membership chỉ thêm schema và được thiết kế để release cũ vẫn hoạt động. Không chạy `migration:revert`, không xóa bảng `projects`/`project_members` và không xóa PostgreSQL volume chỉ để rollback UI/API. Xem quy trình đầy đủ tại [runbook triển khai DEV](dev-deployment.md#giới-hạn-rollback-database).

