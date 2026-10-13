# Runbook triển khai môi trường DEV

Tài liệu này hướng dẫn cấu hình, theo dõi, kiểm tra và xử lý sự cố cho quá trình triển khai Project Management K2H lên môi trường DEV.

Môi trường DEV hiện được truy cập tại:

```text
https://dev.kiotrandev.tech
```

Luồng triển khai tự động:

```text
Merge hoặc push vào dev
        ↓
Reusable CI
        ↓
Build API và Web images
        ↓
Push images lên GHCR
        ↓
Self-hosted runner trên Azure VM
        ↓
Migration PostgreSQL
        ↓
Recreate API và Web
        ↓
Docker health check
        ↓
Public health check qua Cloudflare
        ↓
Promote hoặc rollback
```

Workflow triển khai nằm tại `.github/workflows/deploy-dev.yml`. Deploy engine nằm tại `infra/deploy/deploy-dev.sh`.

## GitHub Environment dev

Trong GitHub repository, vào:

```text
Settings → Environments → dev
```

### Deployment branches

Environment `dev` chỉ cho phép branch `dev`. Không cho phép branch tính năng hoặc pull request deploy trực tiếp lên máy DEV.

### Environment variables

Tạo các Environment Variables sau:

| Tên | Giá trị |
| --- | --- |
| `COMPOSE_PROJECT_NAME` | `project-management-k2h-dev` |
| `DEPLOY_PATH` | `/opt/project-management-k2h/deploy` |
| `DEV_BASE_URL` | `https://dev.kiotrandev.tech` |
| `POSTGRES_DB` | `project_management` |
| `POSTGRES_USER` | `project_management` |
| `SWAGGER_ENABLED` | `true` |
| `AUTH_REGISTER_RATE_LIMIT` | `3` |
| `AUTH_REGISTER_RATE_TTL_SECONDS` | `3600` |
| `AUTH_LOGIN_RATE_LIMIT` | `5` |
| `AUTH_LOGIN_RATE_TTL_SECONDS` | `60` |
| `AUTH_REFRESH_RATE_LIMIT` | `20` |
| `AUTH_REFRESH_RATE_TTL_SECONDS` | `60` |

Đây là cấu hình không nhạy cảm nên được lưu dưới dạng Environment Variables, không phải secrets.

### Environment secrets

Tạo Environment Secret:

| Tên | Nội dung |
| --- | --- |
| `POSTGRES_PASSWORD` | Mật khẩu PostgreSQL mạnh của môi trường DEV |

Mật khẩu phải dài từ 24 đến 128 ký tự và chỉ dùng các ký tự thuộc tập:

```text
A-Z a-z 0-9 . _ ~ ! @ % + = : , -
```

Không sử dụng khoảng trắng, `#`, `$`, dấu nháy hoặc ký tự xuống dòng. Không ghi mật khẩu vào workflow, repository, Docker image, job summary hoặc ảnh chụp màn hình.

### GHCR permissions

Workflow sử dụng `GITHUB_TOKEN` do GitHub Actions cấp:

- Job build cần `packages: write`.
- Job deploy cần `packages: read`.
- Không tạo Personal Access Token nếu `GITHUB_TOKEN` đã đọc và ghi được package của repository.

Các image DEV:

```text
ghcr.io/tvkhieu1998/project-management-k2h-api
ghcr.io/tvkhieu1998/project-management-k2h-web
```

Mỗi release dùng immutable tag `sha-<full-40-character-commit-sha>`. Không sử dụng tag `latest`.

## Theo dõi deployment

Vào tab GitHub Actions và chọn workflow `Deploy DEV`. Một lần triển khai hợp lệ có các job:

1. `Validate DEV deployment ref`.
2. `Reuse application CI`.
3. `Build and publish DEV images`.
4. `Deploy DEV release`.

Job deploy chỉ chạy trên self-hosted runner có các label `self-hosted`, `Linux`, `X64` và `dev`.

Cuối job deploy có summary gồm các trường an toàn:

```text
DEPLOYMENT_STATUS
MIGRATION_STATUS
DOCKER_HEALTH_STATUS
PUBLIC_HEALTH_STATUS
ROLLBACK_STATUS
DEPLOYED_SHA
```

Summary không được chứa mật khẩu hoặc toàn bộ file `.env`.

Có thể kiểm tra lịch sử deployment tại `GitHub repository → Environments → dev` và kiểm tra image tại trang Packages của repository hoặc tài khoản GitHub.

## Kiểm tra release đang chạy

SSH vào Azure VM, sau đó chuyển sang user triển khai:

```bash
sudo -iu deploy
```

Chuyển tới thư mục deployment:

```bash
cd /opt/project-management-k2h/deploy
```

Xem full commit SHA đang được công nhận là current release:

```bash
cat current-release
```

Lệnh này chỉ đọc SHA, không chứa secret.

Xem trạng thái container:

```bash
docker compose \
  --project-name project-management-k2h-dev \
  --env-file .env \
  -f compose.yml \
  ps
```

Xem tên image đã resolve mà không in toàn bộ environment:

```bash
docker compose \
  --project-name project-management-k2h-dev \
  --env-file .env \
  -f compose.yml \
  config --images
```

Xem log API và Web:

```bash
docker compose \
  --project-name project-management-k2h-dev \
  --env-file .env \
  -f compose.yml \
  logs --tail 100 api web
```

Theo dõi log liên tục:

```bash
docker compose \
  --project-name project-management-k2h-dev \
  --env-file .env \
  -f compose.yml \
  logs --follow api web
```

Nhấn `Ctrl+C` để dừng theo dõi log. Thao tác này không dừng container.

Kiểm tra public Web:

```bash
curl --fail --silent --show-error \
  --output /dev/null \
  https://dev.kiotrandev.tech/
```

Kiểm tra API và database:

```bash
curl --fail --silent --show-error \
  https://dev.kiotrandev.tech/api/health
```

Kết quả API khỏe mạnh phải chứa:

```json
{
  "status": "ok",
  "database": "up"
}
```

Không chạy `cat .env` vì file này chứa mật khẩu PostgreSQL.

## Deploy thủ công

Cách deploy thủ công được hỗ trợ là chạy `workflow_dispatch`, không chạy tùy ý các lệnh deploy trực tiếp trên VM.

Trên GitHub:

1. Mở tab `Actions`.
2. Chọn workflow `Deploy DEV`.
3. Chọn `Run workflow`.
4. Chọn branch `dev`.
5. Nhấn `Run workflow`.
6. Theo dõi đủ bốn job cho tới khi hoàn tất.

Workflow từ chối deploy nếu ref không phải `refs/heads/dev`. Manual workflow vẫn deploy chính xác commit SHA của branch `dev`, không sử dụng code chưa commit trên máy cá nhân.

Trước khi chạy thủ công, xác nhận:

- CI của commit đang xanh.
- Self-hosted runner đang online.
- GitHub Environment `dev` có đủ variables và secret.
- Không có deployment khác đang chạy.

Concurrency group `deploy-dev` đảm bảo các lần triển khai DEV được xử lý tuần tự và không tự hủy deployment đang chạy.

Không sửa `.env` trực tiếp trên VM để tạo một cấu hình lâu dài. Nguồn cấu hình chính phải nằm trong GitHub Environment `dev`.

## Runner offline

Đầu tiên kiểm tra trên GitHub tại `Repository → Settings → Actions → Runners`. Runner DEV phải có trạng thái `Idle` hoặc `Active`, không phải `Offline`.

Trên Azure Portal, kiểm tra VM `vm-project-management-dev` đang ở trạng thái `Running`.

SSH vào VM và tìm service của GitHub Actions runner:

```bash
sudo systemctl list-unit-files |
  grep '^actions\.runner'
```

Sau khi xác định đúng tên service, kiểm tra trạng thái:

```bash
sudo systemctl status \
  actions.runner.<owner>-<repository>.<runner-name>.service \
  --no-pager
```

Khởi động lại runner khi cần:

```bash
sudo systemctl restart \
  actions.runner.<owner>-<repository>.<runner-name>.service
```

Xem log gần nhất:

```bash
sudo journalctl \
  -u actions.runner.<owner>-<repository>.<runner-name>.service \
  -n 100 \
  --no-pager
```

Không chạy lại script đăng ký runner nếu runner vẫn còn được đăng ký trên GitHub. Việc đăng ký lại không cần thiết có thể tạo runner trùng lặp.

Kiểm tra Docker của user `deploy`:

```bash
sudo -iu deploy
docker ps
docker compose version
```

Nếu `docker ps` báo permission denied, chạy `id deploy` và xác nhận user `deploy` thuộc group `docker`.

Ngoài runner, kiểm tra các service phục vụ public traffic:

```bash
sudo systemctl status nginx --no-pager
sudo systemctl status cloudflared --no-pager
```

## Rollback application

Deploy engine tự động rollback API và Web nếu:

- Candidate containers không healthy.
- Public Web không truy cập được.
- Public API health check lỗi.
- Tiến trình nhận `SIGINT` hoặc `SIGTERM` sau khi bắt đầu thay application container.
- Phát hiện marker `deployment-in-progress` từ lần deploy bị gián đoạn.

Rollback application dùng `compose.yml`, `.env` và `current-release` làm canonical current release. Sau khi candidate mới được promote thành công, release cũ được lưu tại:

```text
compose.previous.yml
.env.previous
previous-release
```

### Rollback thủ công trong tình huống khẩn cấp

SSH vào VM và chuyển sang user `deploy`:

```bash
sudo -iu deploy
cd /opt/project-management-k2h/deploy
```

Xác nhận đủ snapshot:

```bash
test -f compose.previous.yml
test -f .env.previous
test -f previous-release
```

Xem SHA sẽ rollback:

```bash
cat previous-release
```

Pull lại previous images nếu chúng không còn trên máy:

```bash
docker compose \
  --project-name project-management-k2h-dev \
  --env-file .env.previous \
  -f compose.previous.yml \
  pull api web
```

Khôi phục API và Web, không xóa PostgreSQL volume:

```bash
docker compose \
  --project-name project-management-k2h-dev \
  --env-file .env.previous \
  -f compose.previous.yml \
  up -d \
  --no-build \
  --remove-orphans \
  --wait \
  api web
```

Kiểm tra public health:

```bash
curl --fail --silent --show-error \
  --output /dev/null \
  https://dev.kiotrandev.tech/

curl --fail --silent --show-error \
  https://dev.kiotrandev.tech/api/health
```

Chỉ sau khi health check thành công, cập nhật canonical files. Trước tiên lưu lại release lỗi:

```bash
ROLLBACK_TIME="$(date -u +%Y%m%dT%H%M%SZ)"

install -m 0644 \
  compose.yml \
  "compose.failed-$ROLLBACK_TIME.yml"

install -m 0600 \
  .env \
  ".env.failed-$ROLLBACK_TIME"

install -m 0644 \
  current-release \
  "failed-release-$ROLLBACK_TIME"
```

Sau đó promote previous snapshot thành current:

```bash
install -m 0644 \
  compose.previous.yml \
  compose.yml

install -m 0600 \
  .env.previous \
  .env

install -m 0644 \
  previous-release \
  current-release
```

Kiểm tra lại:

```bash
cat current-release

docker compose \
  --project-name project-management-k2h-dev \
  --env-file .env \
  -f compose.yml \
  ps
```

Không dùng các lệnh sau trong rollback thông thường:

```text
docker compose down -v
docker volume rm
docker system prune --volumes
```

Các lệnh trên có thể xóa dữ liệu PostgreSQL.

## Giới hạn rollback database

Quy trình tự động chỉ rollback application images và Compose manifest. Quy trình không tự động chạy `migration:revert`.

Lý do:

- Migration có thể đã thay đổi dữ liệu.
- API release cũ có thể không tương thích với schema mới.
- Revert tự động có thể làm mất dữ liệu.
- Một số migration không thể đảo ngược an toàn.

Mọi migration đưa lên DEV phải ưu tiên backward compatibility:

- Thêm bảng hoặc cột trước khi code sử dụng.
- Tránh xóa hoặc đổi tên cột trong cùng release.
- Tách destructive migration sang giai đoạn riêng.
- Sao lưu dữ liệu trước thay đổi schema có rủi ro.

Nếu migration thất bại, deploy engine dừng trước khi thay API và Web. Nếu migration thành công nhưng application health lỗi, application được rollback nhưng database vẫn giữ schema mới.

Khi xảy ra trường hợp này:

1. Không tự ý chạy `migration:revert`.
2. Lưu lại workflow run, SHA và log lỗi.
3. Xác định release cũ có tương thích với schema mới hay không.
4. Tạo forward-fix migration nếu có thể.
5. Chỉ restore backup hoặc revert khi đã đánh giá tác động dữ liệu.

## Rotate PostgreSQL password

Thay đổi GitHub secret không tự động đổi password của PostgreSQL user trong database đã tồn tại.

Biến `POSTGRES_PASSWORD` của image PostgreSQL chỉ dùng để khởi tạo user khi data directory còn trống. Docker volume hiện có giữ nguyên password cũ.

Vì vậy không được chỉ sửa `POSTGRES_PASSWORD` trong GitHub rồi deploy lại. Làm như vậy sẽ khiến API dùng password mới trong khi database vẫn yêu cầu password cũ.

Quy trình rotate phải được thực hiện trong maintenance window:

1. Thông báo thời gian bảo trì.
2. Xác nhận có backup PostgreSQL hợp lệ.
3. Tạo mật khẩu mới đúng password contract.
4. Kết nối PostgreSQL bằng quyền quản trị hiện tại.
5. Đổi password của database role.
6. Cập nhật GitHub Environment Secret `POSTGRES_PASSWORD`.
7. Chạy lại workflow `Deploy DEV` trên branch `dev`.
8. Kiểm tra container, API health và public health.
9. Thu hồi password cũ khỏi password manager hoặc nơi lưu trữ được phê duyệt.

Ưu tiên đổi password bằng phiên tương tác để password không xuất hiện trong shell history hoặc process list.

Không ghi câu lệnh chứa password thật vào terminal history, GitHub issue, pull request, chat, repository hoặc ảnh chụp màn hình.

Nếu không thể cập nhật database và GitHub secret trong cùng maintenance window, dừng quy trình và lập kế hoạch chuyển đổi riêng. Không xóa PostgreSQL volume để “áp dụng” password mới.

## Các kiểm tra sau deployment

Sau mỗi deployment thành công, kiểm tra public Web và API:

```bash
curl --fail --silent --show-error \
  --output /dev/null \
  https://dev.kiotrandev.tech/

curl --fail --silent --show-error \
  https://dev.kiotrandev.tech/api/health
```

Trên VM:

```bash
sudo -iu deploy
cd /opt/project-management-k2h/deploy

cat current-release

docker compose \
  --project-name project-management-k2h-dev \
  --env-file .env \
  -f compose.yml \
  ps
```

Trên GitHub, xác nhận:

- Workflow `Deploy DEV` thành công.
- Environment `dev` ghi nhận deployment mới.
- Hai GHCR images có cùng tag `sha-<commit>`.
- `DEPLOYED_SHA` trong summary trùng với `current-release`.

## Phạm vi production

Runbook này chỉ áp dụng cho môi trường DEV.

Production hiện chưa được triển khai. Không tái sử dụng trực tiếp cấu hình DEV cho production nếu chưa thiết kế riêng backup, high availability, secret management, approval gate, monitoring, zero-downtime deployment, migration strategy và disaster recovery.
