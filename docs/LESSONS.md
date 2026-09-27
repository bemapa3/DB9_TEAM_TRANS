# LESSONS — DB9_TEAM TRANS

> Bẫy đã gặp và cách tránh. Đọc trước khi sửa phần liên quan. Mỗi bẫy: 🔴 vấn đề → 🟢 cách đúng.

## Bẫy chung của workspace DB9 (giữ nguyên, thêm bẫy riêng ở dưới)

- 🔴 Kaspersky cách ly/chặn ghi `.js/.bat/.html/.ps1` mới → 🟢 báo chủ thêm loại trừ thư mục project, không lách.
- 🔴 Đường dẫn cứng `C:\Users\Admin\…`, `C:\Program Files\Autodesk\…` → 🟢 gom vào 1 chỗ cấu hình; ưu tiên thư mục user (ghi được, không cần Admin).
- 🔴 Mất code, phải dựng lại từ lịch sử chat → 🟢 commit git sau mỗi bước chạy được.
- 🔴 Tool GUI không test được bằng AI → 🟢 ghi "chưa kiểm chứng trên máy thật" + checklist test tay.

### 3ds Max / MaxScript (xoá nếu không dùng)
- 🔴 Gọi thuộc tính Editable Poly trên node khi có modifier → lỗi "Property not found" → 🟢 dùng `node.baseObject`.
- 🔴 UI phụ gọi `.Focus()` / bắt `KeyDown` → mất phím tắt Max → 🟢 chỉ phản hồi Click, để focus cho viewport.
- 🔴 Max nạp bản script cũ từ `Program Files` → 🟢 triển khai vào `(getDir #userStartupScripts)`.

### Photoshop UXP (xoá nếu không dùng)
- 🔴 `manifest.json` `host` dạng mảng → lỗi cài .ccx -4 → 🟢 `host` là object.
- 🔴 Không có `window.prompt`, CSS var/grid/gap hạn chế → 🟢 tự vẽ control.

## Bẫy riêng của project

- _(chưa có)_
