# AGENTS.md

## Ngôn ngữ

- Giao tiếp và báo cáo bằng tiếng Việt.
- Giữ nguyên tiếng Anh cho class, API, field, enum, migration, service,
  command và tên file kỹ thuật.

## Inventory source of truth

Khi làm việc liên quan đến Quản lý Kho và Hàng Hóa, phải đọc theo thứ tự:

1. `docs/Nghiep_Vu_Quan_Ly_Kho_Va_Hang_Hoa_Da_Chot.docx`
   - Nguồn chuẩn cao nhất về nghiệp vụ.

2. `docs/HVTPOSIMS_Inventory_CodeX_Implementation_Roadmap.md`
   - Nguồn chuẩn về batch, phạm vi triển khai, dependency và Definition of Done.

3. Source code hiện tại
   - Dùng để xác định trạng thái kỹ thuật thực tế.

Nếu source code hoặc Roadmap mâu thuẫn với tài liệu nghiệp vụ đã chốt,
không tự suy diễn. Hãy báo rõ mâu thuẫn trước khi triển khai.

## Quy tắc triển khai

- Chỉ triển khai batch được nêu rõ trong prompt hiện tại.
- Không tự chuyển sang batch tiếp theo.
- Không sửa ngoài phạm vi nếu chưa báo cáo.
- Backend validation là lớp bảo vệ cuối cùng.
- Không truy cập database chéo microservice.
- Giữ backward compatibility với dữ liệu lịch sử khi có thể.
- Không tự chạy test, build, Docker, commit hoặc push nếu prompt không yêu cầu.

## Lệnh bị cấm

Không sử dụng:

- `docker compose down -v`
- `docker system prune --volumes`
- `git reset --hard`
- `git clean -fd`
- force push
- xóa database hoặc volume

## Báo cáo

Cuối mỗi phản hồi phải có:

1. Tóm tắt thay đổi.
2. File đã sửa.
3. Migration hoặc schema change.
4. Phần chưa làm hoặc cần xác nhận.
5. Rủi ro còn lại.
6. `Bạn nên làm gì tiếp theo`.