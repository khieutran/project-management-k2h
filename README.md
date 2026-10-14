# Project Management K2H

Hệ thống quản lý dự án của nhóm K2H, được tổ chức theo mô hình monorepo. Repository hiện gồm:

- API viết bằng NestJS và TypeScript.
- Web viết bằng React, Vite và TypeScript.
- PostgreSQL chạy bằng Docker.
- Kiểm tra chất lượng bằng ESLint, Jest, Vitest và TypeScript.
- Môi trường DEV đóng gói bằng Docker Compose.
- CI chạy tự động bằng GitHub Actions khi tạo pull request.
- CD tự động build, publish và triển khai DEV khi có thay đổi trên branch `dev`.

> Dự án đang ở giai đoạn xây dựng nền móng. Môi trường DEV đã có CI/CD tự động; production và các tính năng nghiệp vụ sẽ được thiết kế ở các giai đoạn tiếp theo.

## Công nghệ chính

| Thành phần | Công nghệ |
| --- | --- |
| Runtime | Node.js 24 |
| Package manager | pnpm 12 |
| Backend | NestJS 12 |
| Frontend | React 19, React Router 7, TanStack Query 5, Vite 8 |
| Cơ sở dữ liệu | PostgreSQL 17 |
| ORM | TypeORM |
| Kiểm thử API | Jest, Supertest |
| Kiểm thử Web | Vitest, Testing Library |
| Lint | ESLint |
| Container | Docker, Docker Compose |

## Cấu trúc repository

```text
project-management-k2h/
├── apps/
│   ├── api/                 # Ứng dụng NestJS
│   └── web/                 # Ứng dụng React/Vite
├── packages/
│   └── config/              # Cấu hình ESLint và TypeScript dùng chung
├── docs/
│   └── runbooks/            # Tài liệu vận hành môi trường
├── infra/
│   ├── ci/                  # Contract tests cho GitHub Actions
│   ├── deploy/              # Deploy engine và rollback tests
│   ├── docker/              # Compose cho local và DEV
│   └── nginx/               # Cấu hình Nginx của máy chủ DEV
├── .github/
│   └── workflows/           # GitHub Actions
├── .env.example             # Mẫu biến môi trường
├── package.json             # Scripts dùng chung của workspace
└── pnpm-workspace.yaml      # Khai báo pnpm workspace
```

## Yêu cầu trước khi bắt đầu

Máy phát triển cần có:

- Git.
- Node.js phiên bản `24.x`.
- Corepack và pnpm phiên bản `12.x`.
- Docker Engine và Docker Compose v2.

Kiểm tra phiên bản:

```bash
node --version
pnpm --version
docker --version
docker compose version
```

Repository có file `.nvmrc`. Nếu sử dụng `nvm`, có thể cài và chọn đúng Node.js bằng:

```bash
nvm install
nvm use
corepack enable
pnpm --version
```

Lần đầu chạy pnpm, Corepack có thể hỏi quyền tải đúng phiên bản được khai báo trong `package.json`. Chọn `Y` để tiếp tục.

## Thiết lập môi trường local

Dự án sử dụng mô hình hybrid khi phát triển:

- PostgreSQL chạy trong Docker.
- API và Web chạy trực tiếp trên máy để hỗ trợ hot reload và debug thuận tiện.

### 1. Clone repository

```bash
git clone <URL_REPOSITORY>
cd project-management-k2h
```

### 2. Tạo file biến môi trường

```bash
cp .env.example .env
```

Mở `.env` và thay `POSTGRES_PASSWORD=change-me` bằng mật khẩu chỉ dùng trên máy local. Không commit file `.env` hoặc mật khẩu thật lên Git.

Các biến mặc định:

```dotenv
NODE_ENV=development
API_PORT=3000
SWAGGER_ENABLED=true

JWT_ACCESS_SECRET=change-me-local-jwt-secret-minimum-32-characters
JWT_ACCESS_TTL_SECONDS=900
REFRESH_TOKEN_PEPPER=change-me-local-refresh-pepper-minimum-32-characters
REFRESH_TOKEN_TTL_SECONDS=604800
AUTH_COOKIE_SECURE=false
AUTH_COOKIE_SAME_SITE=lax

AUTH_REGISTER_RATE_LIMIT=3
AUTH_REGISTER_RATE_TTL_SECONDS=3600
AUTH_LOGIN_RATE_LIMIT=5
AUTH_LOGIN_RATE_TTL_SECONDS=60
AUTH_REFRESH_RATE_LIMIT=20
AUTH_REFRESH_RATE_TTL_SECONDS=60

POSTGRES_HOST=127.0.0.1
POSTGRES_PORT=5432
POSTGRES_HOST_PORT=5432
POSTGRES_DB=project_management
POSTGRES_USER=project_management
POSTGRES_PASSWORD=change-me
```

Nếu cổng `5432` trên máy đang được ứng dụng khác sử dụng, đổi đồng thời hai biến sau, ví dụ:

```dotenv
POSTGRES_PORT=5433
POSTGRES_HOST_PORT=5433
```

`POSTGRES_HOST_PORT` là cổng PostgreSQL được mở trên máy; `POSTGRES_PORT` là cổng API local dùng để kết nối tới PostgreSQL.

### 3. Cài dependencies

```bash
pnpm install
```

### 4. Khởi động PostgreSQL

```bash
pnpm db:up
pnpm db:ps
```

Container PostgreSQL phải có trạng thái `healthy` trước khi chạy API hoặc E2E test.

### 5. Chạy migrations

```bash
pnpm db:migration:show
pnpm db:migration:run
```

Repository hiện có migration cho user, refresh session và project. `migration:show` phải kết nối được đúng database; chạy `migration:run` trước lần khởi động ứng dụng đầu tiên và sau khi pull code có migration mới.

### 6. Khởi động API và Web

```bash
pnpm dev
```

Các địa chỉ mặc định:

| Dịch vụ | Địa chỉ |
| --- | --- |
| Web | `http://localhost:5173` |
| API health | `http://localhost:3000/api/health` |
| Swagger | `http://localhost:3000/api/docs` |
| Đăng ký | `http://localhost:5173/register` |
| Đăng nhập | `http://localhost:5173/login` |

Vite tự chuyển tiếp các request bắt đầu bằng `/api` sang API tại `127.0.0.1:3000`.

Kiểm tra nhanh API:

```bash
curl -i http://127.0.0.1:3000/api/health
```

Kết quả thành công có dạng:

```json
{
  "status": "ok",
  "database": "up",
  "environment": "development"
}
```

## Authentication local

Luồng xác thực hiện có:

```text
Đăng ký hoặc đăng nhập
    ↓
Access token chỉ được giữ trong memory của Web
    ↓
Refresh token nằm trong HttpOnly cookie
    ↓
Reload trang → Web gọi refresh → khôi phục phiên
    ↓
Đăng xuất → revoke session, clear cookie và clear auth state
```

Các route Web:

| Route | Quyền truy cập | Chức năng |
| --- | --- | --- |
| `/register` | Guest | Tạo tài khoản mới |
| `/login` | Guest | Đăng nhập |
| `/` | Authenticated | Home xác nhận phiên và hiển thị safe user |
| `/projects` | Authenticated | Danh sách project theo quyền của người dùng |
| `/projects/new` | Authenticated | Tạo project mới |
| `/projects/:projectId` | Owner hoặc ADMIN | Chi tiết project |
| `/projects/:projectId/edit` | Owner | Chỉnh sửa project |

Kiểm tra thủ công:

1. Mở `http://localhost:5173/register` và tạo tài khoản.
2. Xác nhận ứng dụng chuyển về Home và chỉ hiển thị tên, email, role.
3. Reload trang và xác nhận phiên được khôi phục.
4. Đăng xuất và xác nhận ứng dụng chuyển về Login.
5. Đăng nhập lại bằng tài khoản vừa tạo.

Request `POST /api/auth/refresh` trả `401` trước khi người dùng đăng nhập là hành vi bình thường. Không lưu access token hoặc refresh token vào `localStorage`, `sessionStorage`, log, issue hoặc ảnh chụp màn hình.

Xem contract, xử lý sự cố và smoke test tại [runbook authentication](docs/runbooks/authentication.md).

## Quản lý dự án

Mỗi người dùng đã đăng nhập có thể tạo project và trở thành owner. Owner có quyền cập nhật, chuyển trạng thái, archive, restore và xóa mềm project của mình.

ADMIN có read scope toàn hệ thống để xem project của mọi owner và danh sách đã xóa. ADMIN không tự động có quyền mutate project của người khác.

Vòng đời project:

```text
PLANNING → ACTIVE → COMPLETED
                ↑        │
                └────────┘
```

Web sử dụng TanStack Query với cache key chứa actor ID. Project cache được xóa khi logout hoặc đổi identity và không được persist trong browser storage.

Xem API contract, permission matrix, smoke test và xử lý sự cố tại [runbook quản lý dự án](docs/runbooks/project-management.md).

## Quản lý PostgreSQL local

Các lệnh thường dùng:

```bash
pnpm db:up      # Khởi động PostgreSQL
pnpm db:ps      # Xem trạng thái container
pnpm db:logs    # Theo dõi log PostgreSQL
pnpm db:down    # Dừng và xóa container, giữ lại dữ liệu
```

Dữ liệu được lưu trong Docker volume nên không mất khi chạy `pnpm db:down`.

### Kết nối bằng DBeaver hoặc pgAdmin 4

PostgreSQL chạy trong Docker vẫn có thể được xem và chỉnh sửa bằng DBeaver hoặc pgAdmin 4. Sử dụng các thông tin trong `.env`:

| Thuộc tính | Giá trị |
| --- | --- |
| Host | `127.0.0.1` |
| Port | Giá trị của `POSTGRES_HOST_PORT` |
| Database | Giá trị của `POSTGRES_DB` |
| Username | Giá trị của `POSTGRES_USER` |
| Password | Giá trị của `POSTGRES_PASSWORD` |

Không sử dụng tên service `postgres` làm host khi kết nối từ DBeaver hoặc pgAdmin chạy trực tiếp trên máy. Tên này chỉ được dùng giữa các container trong cùng Docker network.

## Quản lý migrations

Tạo migration rỗng để viết thủ công:

```bash
pnpm db:migration:create src/database/migrations/TenMigration
```

Sinh migration dựa trên thay đổi entity:

```bash
pnpm db:migration:generate src/database/migrations/TenMigration
```

Xem, chạy hoặc hoàn tác migration gần nhất:

```bash
pnpm db:migration:show
pnpm db:migration:run
pnpm db:migration:revert
```

Luôn đọc lại file migration được sinh tự động trước khi commit.

## Kiểm tra chất lượng

Chạy toàn bộ các bước kiểm tra từ thư mục gốc:

```bash
pnpm lint
pnpm typecheck
pnpm test
NODE_ENV=test SWAGGER_ENABLED=false pnpm test:e2e
pnpm build
```

Lưu ý:

- `pnpm test:e2e` cần PostgreSQL local đang chạy và có trạng thái `healthy`.
- API test dùng Jest; Web test dùng Vitest.
- Không bỏ qua lỗi lint, typecheck hoặc test trước khi tạo pull request.

Có thể chạy riêng từng ứng dụng:

```bash
pnpm --filter @project-management/api test --runInBand
pnpm --filter @project-management/web test
pnpm --filter @project-management/api build
pnpm --filter @project-management/web build
```

## Chạy toàn bộ stack bằng Docker Compose

Chế độ này dùng để smoke-test các image và cấu hình gần với môi trường DEV:

```bash
docker compose \
  --env-file .env \
  -f infra/docker/compose.dev.yml \
  up -d --build
```

Kiểm tra trạng thái:

```bash
docker compose \
  --env-file .env \
  -f infra/docker/compose.dev.yml \
  ps
```

Các địa chỉ khi chạy DEV Compose:

| Dịch vụ | Địa chỉ trên máy host |
| --- | --- |
| Web | `http://127.0.0.1:8080` |
| API health | `http://127.0.0.1:3000/api/health` |
| Swagger | `http://127.0.0.1:3000/api/docs` |

PostgreSQL của DEV Compose không mở cổng ra máy host. API kết nối tới PostgreSQL thông qua Docker network nội bộ.

Dừng stack:

```bash
docker compose \
  --env-file .env \
  -f infra/docker/compose.dev.yml \
  down
```

Không thêm tùy chọn `-v` nếu không có chủ đích xóa volume và toàn bộ dữ liệu PostgreSQL của stack này.

## Kiểm tra hợp đồng Docker Compose

Hai script sau kiểm tra cấu trúc, biến môi trường, healthcheck và nguyên tắc không công khai PostgreSQL:

```bash
bash infra/docker/compose.local.test.sh
bash infra/docker/compose.dev.test.sh
```

## Swagger

Swagger chỉ được bật khi:

```dotenv
SWAGGER_ENABLED=true
```

Khi bật, tài liệu API nằm tại `/api/docs`. Nên đặt `SWAGGER_ENABLED=false` ở những môi trường không cần công khai tài liệu API.

## Quy trình Git đề xuất

Không code trực tiếp trên `main` hoặc `dev`. Mỗi thay đổi nên được thực hiện trên một branch riêng:

```bash
git switch dev
git pull
git switch -c <loai>/<ten-ngan-gon>
```

Ví dụ tên branch:

- `feat/project-board`
- `fix/login-validation`
- `chore/update-tooling`
- `docs/update-readme`

Trước khi push:

```bash
pnpm lint
pnpm typecheck
pnpm test
NODE_ENV=test SWAGGER_ENABLED=false pnpm test:e2e
pnpm build
git diff --check
```

Sau đó push branch và tạo pull request vào `dev`. Pull request phải vượt qua CI và được review trước khi merge.

## CI/CD với GitHub Actions

Workflow `.github/workflows/ci.yml` chạy trên GitHub-hosted runner khi:

- Tạo hoặc cập nhật pull request vào `dev` hoặc `main`.
- Chạy thủ công bằng `workflow_dispatch`.

CI thực hiện:

1. Cài đúng phiên bản Node.js và pnpm.
2. Cài dependencies theo lockfile.
3. Chạy lint và typecheck.
4. Chạy unit test và E2E test với PostgreSQL service riêng.
5. Build API và Web.
6. Kiểm tra hợp đồng Docker Compose.
7. Build các Docker image DEV.

Workflow `.github/workflows/deploy-dev.yml` chạy khi:

- Có commit được push hoặc merge vào branch `dev`.
- Thành viên chạy thủ công bằng `workflow_dispatch` trên branch `dev`.

Luồng CD thực hiện:

1. Xác nhận deployment ref là `refs/heads/dev`.
2. Gọi lại reusable CI mà không build trùng Docker image.
3. Build API và Web image.
4. Gắn tag bất biến `sha-<full-commit-sha>` và publish lên GHCR.
5. Chạy migration trên self-hosted DEV runner.
6. Recreate API và Web rồi kiểm tra Docker health và public health.
7. Promote candidate khi thành công hoặc rollback application khi health check lỗi.

Workflow `dev-runner-smoke-test.yml` chỉ dùng để xác nhận self-hosted runner của máy DEV hoạt động.

Developer không cần `POSTGRES_PASSWORD` hoặc các secrets của DEV để cài dependencies, chạy PostgreSQL local, API, Web hoặc test trên máy cá nhân. Local sử dụng file `.env` riêng được tạo từ `.env.example`.

Hướng dẫn cấu hình, theo dõi deployment, rollback và xử lý sự cố nằm trong [runbook triển khai DEV](docs/runbooks/dev-deployment.md).

## Môi trường DEV

Môi trường DEV hiện được truy cập qua:

```text
https://dev.kiotrandev.tech
```

Luồng truy cập:

```text
Người dùng
    ↓ HTTPS
Cloudflare Tunnel
    ↓
Nginx trên Azure VM
    ├── /api/*  → API
    └── /*      → Web
```

Azure VM không mở cổng HTTP công khai. Cloudflare Tunnel là điểm vào của lưu lượng web; SSH vẫn được giới hạn bởi Network Security Group và firewall.

Mỗi commit được merge hoặc push vào `dev` sẽ đi qua CI, được build thành hai GHCR images dùng cùng full commit SHA, sau đó tự động triển khai bằng self-hosted runner trên Azure VM.

Deploy engine chạy migration trước khi thay application containers, kiểm tra health hữu hạn và tự động rollback API/Web về canonical current release nếu candidate không khỏe mạnh. Migration database không được tự động revert.

Xem quy trình vận hành đầy đủ tại [docs/runbooks/dev-deployment.md](docs/runbooks/dev-deployment.md).

## Bảo mật và quản lý secrets

- Không commit `.env`, private key, file `.pem`, token hoặc mật khẩu vào repository.
- Chỉ commit `.env.example` với giá trị minh họa không nhạy cảm.
- Không đưa secrets vào Docker image hoặc ghi trực tiếp trong workflow.
- Secrets của DEV phải được quản lý bằng GitHub Environment hoặc cơ chế secrets phù hợp.
- Không mở cổng PostgreSQL ra Internet.
- Khi chia sẻ log hoặc ảnh chụp màn hình, phải che token, mật khẩu và thông tin nhạy cảm.

## Phạm vi hiện tại

Foundation hiện đã cung cấp:

- pnpm monorepo.
- NestJS API và React Web.
- Environment validation.
- PostgreSQL và TypeORM.
- Health endpoint kiểm tra cả API và database.
- Swagger có thể bật hoặc tắt theo môi trường.
- Unit test, E2E test, lint, typecheck và build.
- Docker image và DEV Compose.
- CI kiểm tra nền móng ứng dụng.
- CD tự động publish immutable images lên GHCR và triển khai DEV.
- Deploy engine hỗ trợ migration, health check, promotion và rollback application.
- Đăng ký, đăng nhập, refresh rotation, đăng xuất và endpoint current user.
- JWT authentication, role guard, rate limiting và error contract an toàn.
- React AuthProvider, protected routes và giao diện Login/Register/Home.
- Project API với owner scope, ADMIN read-only toàn hệ thống và soft delete.
- React UI cho danh sách, tìm kiếm, lọc, phân trang, tạo, chi tiết và chỉnh sửa project.
- TanStack Query cache được cô lập theo authenticated actor.

Các phần chưa thuộc phạm vi hiện tại:

- Trang quản trị người dùng, project membership và quản lý công việc.
- Hạ tầng production, backup và disaster recovery.
- Monitoring, logging tập trung và cảnh báo production.
