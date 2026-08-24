# SEP490 - Hệ thống Quản trị Hương Vân Trà

## Inventory / Warehouse Scope

Current Inventory scope separates `Warehouse` and `Shelf` stock, uses `WarehouseQuantityOnHand` for Kho tong and `QuantityOnHand` for Ke Hang/POS sellable stock, and keeps Product master changes behind approval workflows.

Read the acceptance and UAT guide here:

- `docs/inventory-acceptance-guide.md`

#  Hướng dẫn cách build docker 
1. Build lại images (bắt buộc phải rebuild vì đã thay đổi Dockerfile)

  # Đứng tại thư mục gốc backend
  cd D:\FuLearning\SEP\SEP490_G66_HuongVanTra-System\backend\huongvantra_backend

  # Build lại tất cả services, bỏ cache cũ
  docker compose build --no-cache

  ▎ Lần này build sẽ vẫn lâu vì cần pull Alpine base image mới và compile lại từ đầu. Đây là lần cuối cùng mất thời gian
  ▎ như vậy.

  2. Khởi động lại toàn bộ stack

  docker compose up -d

  3. Kiểm tra containers đang chạy

  docker compose ps

  4. Xem log nếu có container bị lỗi

  # Xem log của một service cụ thể
  docker compose logs user-service
  docker compose logs customer-service
  docker compose logs gateway

  ---
  Sau khi build lần đầu xong, quy trình dev hàng ngày sẽ là:

  # Khi thay đổi source code — chỉ rebuild service đó thôi
  docker compose build user-service
  docker compose up -d user-service

  # Hoặc rebuild + restart cùng lúc
  docker compose up -d --build user-service

# Lần tới nếu muốn dọn dẹp định kỳ, bạn có thể dùng:

  # Chỉ xóa build cache (an toàn nhất, dùng được cả trên VPS)
  docker builder prune -f

  # Xóa images không dùng + containers đã stop (KHÔNG chạm volumes)
  docker image prune -f
  docker container prune -f

  > REL-01: các lệnh có `--volumes` / `-v` / `docker volume rm` đã được bỏ khỏi README
  > vì chúng xóa data MySQL + RabbitMQ và không thể phục hồi. Nếu thực sự cần reset data
  > **ở máy dev**, xem mục [Reset data (DEV-ONLY)](#reset-data-dev-only). Trên VPS thì
  > tuyệt đối không dùng.

  # Script SQL đã có hvt_inventory_db và grant đủ quyền. Vấn đề là MySQL volume đã được khởi tạo từ trước — file init.sql chỉ chạy một lần duy nhất khi volume còn mới, nên database hvt_inventory_db và quyền cho hvtuser chưa được tạo trong lần này. (lỗi khi chạy migration)

  Cách fix: chạy thủ công lệnh SQL vào container MySQL đang chạy (mật khẩu lấy từ
  `MYSQL_ROOT_PASSWORD` trong `.env`, không hardcode vào README/commit):

  docker compose exec mysql mysql -u root -p -e "
  CREATE DATABASE IF NOT EXISTS \`hvt_inventory_db\`
    CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
  GRANT ALL PRIVILEGES ON \`hvt_inventory_db\`.* TO 'hvtuser'@'%';
  FLUSH PRIVILEGES;
  "

  Sau đó restart inventory-service để nó chạy lại migration:

  docker compose restart inventory-service

  Rồi kiểm tra log:

  docker compose logs -f inventory-service

  Lần này bạn sẽ thấy migration chạy thành công thay vì Access denied.

  ❯ còn cách khác không?

  Có — nhưng cả hai cách còn lại đều **xóa toàn bộ data MySQL**, nên chỉ dùng ở máy dev:
  xem mục [Reset data (DEV-ONLY)](#reset-data-dev-only). Trên VPS/production chỉ dùng lệnh
  `docker compose exec mysql ...` ở trên — đó là cách duy nhất an toàn và giữ được data.

# Nếu muốn build sạch sẽ docker, chạy theo thứ tự sau:

  Bước 1: Dừng và xóa container (KHÔNG kèm -v nên data DB vẫn còn)
  docker compose down

  Bước 2: Xóa image + build cache không dùng
  docker image prune -af
  docker builder prune -f

  ▎ Flag -a xóa cả image còn tag nhưng không được container nào dùng, -f không hỏi xác nhận.
  ▎ Cố tình KHÔNG dùng `docker system prune --volumes`: lệnh đó xóa luôn volume DB.

  Bước 3: Rebuild và chạy lại toàn bộ
  docker compose up -d --build

  ---
  Lưu ý quan trọng: Data trong DB (MySQL, RabbitMQ) vẫn an toàn vì nằm trong volumes,
  miễn là không thêm `-v` / `--volumes` vào bước 1.
========================================================================================================================================================

  Lần đầu (setup một lần duy nhất)

    # 1. Vào thư mục backend
    cd backend/huongvantra_backend

    # 2. Tạo file .env từ mẫu (nếu có r thì thôi)
    cp .env.example .env

    ---
    Chạy dev — không cần rebuild khi sửa code

    docker compose -f docker-compose.yml -f docker-compose.dev.yml up

    Cơ chế:
    - Frontend (port 5173): Vite dev server, bind mount source → save file là browser tự reload (5173: môi trường dev, 3000: môi trường production)
    - Backend ProductService (port 5003): dotnet watch run, bind mount source → save file .cs là service tự restart (~3-5 giây)
    - MySQL, RabbitMQ, Gateway: chạy bình thường từ docker-compose.yml

    Muốn chạy riêng 1 service:
    docker compose -f docker-compose.yml -f docker-compose.dev.yml up product-service

    ---
    Chạy production — build Docker image đầy đủ

    docker compose up --build

    Dùng khi deploy, hoặc khi cần test image production thật sự.

    ---
    Sau khi pull code mới (đang chạy dev)

    Không cần làm gì thêm — dotnet watch và Vite tự detect thay đổi. Trường hợp duy nhất cần restart thủ công là khi thay đổi appsettings.json hoặc thêm NuGet package mới:

    docker compose -f docker-compose.yml -f docker-compose.dev.yml restart product-service

=========================================================================================================================
    Vì docker-compose.dev.yml dùng 2 cơ chế khác nhau cho production vs dev:

    Production (docker-compose.yml)
    product-service → build Dockerfile → runtime image (aspnet:8.0-alpine, ~120MB)
                      code được compile sẵn vào image
                      sửa code → phải docker build lại

    Dev (docker-compose.dev.yml)
    product-service → SDK image (dotnet/sdk:8.0, ~750MB)
                      bind mount source code vào container
                      dotnet watch run theo dõi file → tự rebuild khi save

    Comment có sẵn trong file giải thích lý do để mặc định là comment:

    ▎ SDK image (~750MB) nặng hơn runtime image — chỉ bật service đang làm việc.

    Tức là thiết kế ban đầu là: mỗi developer chỉ uncomment service mình đang làm để tiết kiệm RAM/CPU. Nếu cả team cùng develop ProductService thì uncomment là đúng.

    Nếu bạn muốn revert lại comment để mỗi người tự quyết định, tôi có thể làm vậy — khi đó hướng dẫn cho team sẽ là:

    # Muốn dev ProductService với hot-reload → mở docker-compose.dev.yml, uncomment phần product-service
    # Chỉ cần infra thì không cần uncomment gì
    docker compose -f docker-compose.yml -f docker-compose.dev.yml up

=========================================================================================================================

## Port & truy cập hạ tầng (SEC-05)

Production (`docker-compose.yml`) **chỉ publish 2 port** ra host:

| Port | Service | Ghi chú |
|------|---------|---------|
| `3000` | `web-client` | nginx serve build production |
| `5000` | `gateway` | mọi request của frontend đi qua đây |

MySQL, RabbitMQ và 6 microservice (customer/user/product/order/inventory/audit) **không còn
publish port ra host**. Chúng vẫn gọi nhau bình thường trong `hvt-network` bằng DNS của Docker
(`http://product-service:8080`, `Server=mysql;Port=3306`), nên không ảnh hưởng chức năng.

### Mở port debug ở máy dev

```powershell
cd backend\huongvantra_backend
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d
```

Overlay dev mở lại, bind vào `127.0.0.1` (không ra LAN): MySQL `3307`, RabbitMQ `5672` +
Management UI `15672`, và các service `5001` (customer) / `5002` (user) / `5003` (product) /
`5004` (order) / `5005` (inventory) / `5007` (audit). Frontend dev chạy Vite ở `5173` thay cho `3000`.

Chỉ cần một service:

```powershell
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d product-service
```

### Truy cập DB / RabbitMQ trên VPS

Không còn `mysql -h <vps-ip> -P 3307` được nữa. Hai cách:

1. **Dùng CLI trong container** (mật khẩu lấy từ `.env` trên VPS, đừng dán vào chat/commit):

   ```bash
   cd /opt/hvt/backend/huongvantra_backend
   docker compose exec mysql mysql -u root -p
   ```

2. **SSH tunnel** nếu muốn dùng MySQL Workbench / DBeaver từ máy cá nhân. Vì MySQL không
   publish port ra host VPS nữa, tunnel phải trỏ vào **IP container** trong `hvt-network`:

   ```bash
   # trên VPS: lấy IP container
   docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' hvt-mysql
   ```

   ```powershell
   # trên máy cá nhân (thay 172.x.x.x bằng IP vừa lấy)
   ssh -L 3307:172.x.x.x:3306 <user>@116.118.3.5
   ```

   Sau đó Workbench connect `127.0.0.1:3307`. Lưu ý IP container đổi mỗi lần recreate, nên
   cách 1 vẫn là cách nhanh và ổn định hơn cho việc chạy SQL.

RabbitMQ Management UI (`15672`) chỉ dùng khi debug ở máy dev, không mở trên VPS.

## Reset data (DEV-ONLY)

> **CẢNH BÁO:** mục này xóa vĩnh viễn toàn bộ data MySQL + RabbitMQ. Chỉ chạy trên **máy dev**.
> **TUYỆT ĐỐI không chạy trên VPS/production** — không có backup tự động, data mất là mất.
> Trên VPS, muốn sửa DB thì dùng `docker compose exec mysql ...` (xem mục trên).

Dùng khi DB local lẫn seed cũ (`SKU-DEMO-*`, Matcha/Ceylon, đơn rác) và muốn setup lại từ đầu:

```powershell
cd backend\huongvantra_backend

# DEV-ONLY: -v xóa volume mysql_data + rabbitmq_data
docker compose -f docker-compose.yml -f docker-compose.dev.yml down -v
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d
```

Xóa volume làm `Scripts/init-databases.sql` chạy lại (nó chỉ chạy khi volume còn mới), nên các
database + quyền cho `hvtuser` được tạo đúng. Sau đó seed lại theo các bước C → F bên dưới.

=========================================================================================================================

## Quy trình máy mới / data đang lung tung (chuẩn Hương Vân)

Dùng khi vừa `git pull`, DB local lẫn seed cũ (`SKU-DEMO-*`, Matcha/Ceylon, đơn rác), hoặc muốn setup sạch từ đầu.

### A. Chuẩn bị code

```powershell
cd D:\SEP490_G66_HuongVanTra-System
git pull

# Frontend Cloudinary (nếu import ZIP có ảnh)
cd frontend\huongvantra-web-client
copy .env.example .env
# Điền VITE_CLOUDINARY_CLOUD_NAME + VITE_CLOUDINARY_UPLOAD_PRESET
```

### B. Xóa data cũ (chỉ khi DB lung tung — DEV-ONLY)

Làm theo mục [Reset data (DEV-ONLY)](#reset-data-dev-only) ở trên. Nếu DB local vẫn dùng được
thì **bỏ qua bước này** và đi thẳng sang C.

Đợi containers `healthy` (~1–2 phút). UserService tự seed tài khoản:

| User | Pass | Vai trò |
|------|------|---------|
| `admin` | `123456` | Admin |
| `manager01` | `123456` | Manager |
| `sale01` | `123456` | Sale POS |
| `sale_cod01` | `123456` | Sale COD |
| `warehouse01` | `123456` | Thủ kho |
| `accountant01` | `123456` | Kế toán |

CustomerService tự seed hạng thành viên (Member/Silver/Gold/Diamond).

### C. Seed nền (chưa có Product/SKU)

```powershell
cd D:\SEP490_G66_HuongVanTra-System\backend\huongvantra_backend\Scripts
.\run-seed-hvt-categories.ps1
.\run-seed-hvt-baseline-extras.ps1
```

→ 8 danh mục HVT, 5 KH, 3 NCC, 2 promo (`HVT10` / `HVT50K`).

### D. Catalog Excel (bắt buộc — không seed SQL)

Form **Tải file mẫu** / **Import** không nằm ở **Lịch sử tạo hàng hóa**. Nằm ở trang **Tạo sản phẩm**.

1. Mở FE (thường `http://localhost:5173`).
2. Login `warehouse01` / `123456` (Thủ kho).
3. Menu **Sản phẩm & Số lượng** (với Thủ kho có thể hiện **Hàng hóa**) → nút **Tạo sản phẩm**
   → URL `/inventory/products/create`.
4. Trên trang đó: **Tải file có dữ liệu mẫu** (hoặc **Tải file mẫu** trống).
5. (Tuỳ chọn) ZIP: đúng 1 file `.xlsx` + ảnh `HVT01.jpg`, `HVT01_2.jpg`, …
6. **Import Excel / ZIP** → preview → gửi duyệt.
7. Login `manager01` / `123456` → **Lịch sử tạo hàng hóa** (`/inventory/product-approvals`) → duyệt.
8. Kiểm tra list SP có SKU kiểu `HVT-HUONGTRA-100G`, `NL-TRA-XANH-G`, `BB-HOP-GIAY-HVT`.

### E. Tồn kho theo SkuCode (Phase B)

```powershell
cd D:\SEP490_G66_HuongVanTra-System\backend\huongvantra_backend\Scripts
.\run-seed-inventory-by-sku.ps1
```

Fail nếu thiếu SkuCode → quay lại bước D.

### F. Data thao tác mẫu (tuỳ chọn nhưng nên chạy demo)

```powershell
.\run-seed-hvt-sample-ops.ps1
```

Nạp: map NCC↔SKU, PN Draft/Pending/Completed, BOM, đơn mẫu, ca/quỹ, kiểm kê, trả hàng.

### G. Kiểm chứng nhanh

- `sale01`: quỹ đang Open (nếu đã chạy F) → POS bán `HVT-HUONGTRA-100G`.
- `warehouse01`: tồn Kho/Kệ, phiếu NCC, kiểm kê.
- `accountant01`: xem đơn / giá vốn (read-only).

### Không chạy trên máy sạch

- `run-seed-catalog-inventory.ps1` — tạo catalog Matcha/Ceylon legacy.
- `seed-demo-data.sql` — tạo `SKU-DEMO-*` + đơn demo cũ.
- Soft-delete từng SKU rác nếu vừa reset data ở máy dev — không cần.

## Nạp catalog Hương Vân bằng Excel + ZIP ảnh

Catalog không tự nạp khi `docker compose up`. Luồng chuẩn:

1. Tạo danh mục nền (script).
2. Thủ kho mở **Sản phẩm & Số lượng** → **Tạo sản phẩm** (`/inventory/products/create`) → tải Excel mẫu / Import ZIP → gửi duyệt.
3. Manager mở **Lịch sử tạo hàng hóa** (`/inventory/product-approvals`) để duyệt.

Không tìm nút Import trên trang Lịch sử — trang đó chỉ xem/duyệt yêu cầu đã gửi.

Nếu có ảnh, nén Excel và ảnh thành một file ZIP; tên ảnh phải trùng **Mã sản phẩm** (`HVT01.jpg`, `HVT01_2.jpg`).

Tên và giá bán trong file mẫu được tham khảo từ `https://huongvantra.vn/` (snapshot 08/2026). Giá vốn chỉ là dữ liệu demo, không phải giá vốn thực tế. Trình import yêu cầu **Quy đổi là số nguyên dương** và tự tính **giá SKU quy đổi = giá SKU cơ bản × Quy đổi**, nên các quy cách không theo tỷ lệ tuyến tính (ví dụ hũ sứ 50g) được tách thành sản phẩm riêng.

### Bước 1 — tạo danh mục nền + data phụ trợ đủ dùng

```powershell
# Đảm bảo các service đã start ít nhất một lần (migrate + seed user/tier).
cd backend\huongvantra_backend\Scripts
.\run-seed-hvt-categories.ps1
.\run-seed-hvt-baseline-extras.ps1
```

`run-seed-hvt-baseline-extras.ps1` nạp **đủ dùng, không rác**: 5 khách hàng, 3 NCC, 2 khuyến mãi (`HVT10` / `HVT50K`). Không tạo Product/SKU/Order/Stock demo.

### Bước 2 — tải và import file mẫu

1. Đăng nhập `warehouse01` / `123456` (Thủ kho — role tạo yêu cầu catalog).
2. Vào **Sản phẩm & Số lượng** (menu Thủ kho; nhãn có thể là **Hàng hóa**).
3. Bấm **Tạo sản phẩm** → trang tạo biên bản (`/inventory/products/create`).
4. Trên trang này mới có **Tải file có dữ liệu mẫu**, **Tải file mẫu**, **Import Excel / ZIP**.
5. Chuẩn bị ảnh (tuỳ chọn): `HVT01.jpg`, `HVT01_2.jpg`, … (tối đa 5 ảnh/SP, 5MB/ảnh).
6. Nén đúng 1 file `.xlsx` và các ảnh vào ZIP → Import → kiểm tra preview → gửi duyệt.
7. Đăng nhập `manager01` / `123456` → **Lịch sử tạo hàng hóa** → duyệt yêu cầu.
8. Cấu hình Cloudinary trước khi gửi duyệt nếu ZIP có ảnh.

### Bước 3 — tồn kho (Phase B)

Chỉ chạy **sau khi** catalog Excel đã được duyệt và Product DB có SkuCode `HVT-*` / `NL-*` / `BB-*` của file mẫu.

```powershell
cd backend\huongvantra_backend\Scripts
.\run-seed-inventory-by-sku.ps1
```

Script này:
- **không** tạo Product/SKU;
- lookup `ProductVariants.Id` theo `SkuCode`;
- UPSERT `SkuStocks` + lô `HVT-LOT-*` (Kho) / `HVT-SHELF-*` (Kệ);
- **fail rõ** nếu thiếu SkuCode (chưa import đủ Excel).

Kiểm chứng: màn **Sản phẩm & Số lượng** có tồn Kho/Kệ > 0; POS bán được (ví dụ `HVT-HUONGTRA-100G`).

### Bước 4 — dữ liệu thao tác mẫu (tuỳ chọn)

Sau khi catalog + tồn đã có:

```powershell
cd backend\huongvantra_backend\Scripts
.\run-seed-hvt-sample-ops.ps1
```

Nạp đủ dùng: map NCC↔SKU, phiếu nhập (Draft / PendingApproval / Completed), BOM 2 SKU, 4 đơn mẫu, ca/quỹ, kiểm kê, trả hàng NCC + trả khách. Đơn POS mẫu cũ **không trừ tồn**; PN Completed / THN Completed chỉnh tồn Kho nhẹ. Ca/quỹ seed sẵn phiên Open cho `sale01`.

> Không chạy `run-seed-catalog-inventory.ps1` trên máy mới — path legacy tự tạo catalog Matcha/Ceylon và dễ trùng với Excel.

Tài khoản demo mặc định do UserService seed: `admin` / `sale01` / `sale_cod01` / `manager01` — mật khẩu `123456`.
