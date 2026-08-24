# CI/CD — Tự động deploy lên VPS

Mỗi khi push code lên nhánh `main`, GitHub Actions tự động SSH vào VPS, pull code mới, build lại Docker image và restart container.

## Cách hoạt động

```
git push origin main
        ↓
GitHub Actions khởi động
        ↓
SSH vào VPS (116.118.3.5)
        ↓
git fetch + reset --hard origin/main   ← đồng bộ code
        ↓
docker compose build                    ← build lại image có thay đổi
        ↓
docker compose up -d                    ← restart container
        ↓
docker image prune -f                   ← dọn image cũ
```

Thời gian: ~5–15 phút tuỳ số service thay đổi (Docker cache lại phần không đổi).

## Secrets cần thiết

Chỉ cần **2 secrets** (đặt tại repo → Settings → Secrets and variables → Actions):

| Secret | Giá trị | Ghi chú |
|--------|---------|---------|
| `VPS_HOST` | `116.118.3.5` | IP của VPS |
| `VPS_SSH_KEY` | Private key `~/.ssh/github_actions_deploy` | Toàn bộ nội dung, gồm cả dòng BEGIN/END |

Các secret `VITE_*` **không cần** cho luồng này — vì build diễn ra trên VPS và Docker Compose đọc trực tiếp từ file `.env` có sẵn ở đó. Để lại cũng không sao (không dùng tới).

## Tạo SSH key (chỉ làm 1 lần, chạy trên VPS)

```bash
ssh-keygen -t ed25519 -C "github-actions-deploy" -f ~/.ssh/github_actions_deploy -N ""
cat ~/.ssh/github_actions_deploy.pub >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/github_actions_deploy
cat ~/.ssh/github_actions_deploy   # copy nội dung này vào secret VPS_SSH_KEY
```

## Sử dụng hàng ngày

```bash
git add .
git commit -m "feat: thêm tính năng X"
git push origin main
```

Xong. Theo dõi tiến trình tại tab **Actions** trên GitHub. Không cần SSH vào VPS nữa.

Muốn deploy lại mà không sửa code: tab **Actions** → chọn workflow *Deploy to VPS* → **Run workflow**.

## Những gì KHÔNG bị ảnh hưởng

- **File `.env` trên VPS** — nằm trong `.gitignore`, không bị `git reset` xoá. Secrets production giữ nguyên.
- **Dữ liệu database** — volume `mysql_data` / `rabbitmq_data` không bị đụng tới. Dữ liệu an toàn qua mỗi lần deploy.

## Lưu ý quan trọng về `git reset --hard`

Workflow dùng `git reset --hard origin/main` để buộc VPS khớp tuyệt đối với GitHub. Hệ quả: **mọi sửa đổi thủ công trên file đã track ở VPS sẽ bị ghi đè**.

Đây là hành vi mong muốn của CI/CD (GitHub là nguồn chân lý duy nhất), nhưng nghĩa là: từ giờ **đừng sửa code trực tiếp trên VPS nữa** — sửa ở máy local, commit, push. File `.env` không bị ảnh hưởng vì untracked.

## Rollback khi deploy lỗi

Cách 1 — quay lại commit trước qua git (khuyến nghị):

```bash
git revert HEAD
git push origin main     # workflow tự chạy lại, deploy bản đã revert
```

Cách 2 — xử lý trực tiếp trên VPS:

```bash
cd /opt/hvt
git reset --hard <commit-hash-cũ>
cd backend/huongvantra_backend
docker compose build && docker compose up -d
```

## Kiểm tra & gỡ lỗi

```bash
docker compose ps                      # tất cả phải Healthy
docker compose logs -f gateway         # log 1 service
docker compose logs --tail=100 mysql   # 100 dòng cuối
```

Nếu workflow báo lỗi SSH: kiểm tra `VPS_SSH_KEY` đã copy đủ cả dòng `-----BEGIN` và `-----END`.
