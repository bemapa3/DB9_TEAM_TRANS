# DB9 Team Translator

Extension Chrome/Edge dịch song ngữ trên Microsoft Teams Web (VI ↔ EN/JA). Không chạy trên Teams Desktop — xem [docs/TEAMS_DESKTOP.md](docs/TEAMS_DESKTOP.md).

Version hiện tại: xem [`versions.json`](versions.json) · Ghi chú từng bản: [`CHANGELOG.md`](CHANGELOG.md)

## Cài đặt (làm 1 lần)

1. `chrome://extensions` (hoặc `edge://extensions`) → bật Developer mode.
2. Load unpacked → chọn thư mục `extension`.

## Dùng hằng ngày

1. Tin đến tiếng Anh/Nhật tự có dòng 🇻🇳 bên dưới.
2. Bấm vào ô chat → sidebar hiện; gõ tiếng Việt → xem Preview. Nút 🇺🇸/🇯🇵 đổi ngôn ngữ đích.
3. Ctrl+Enter → bản dịch vào clipboard → Ctrl+A, Ctrl+V → Gửi.

## Khi có bản mới

- `chrome://extensions` → bấm ↻ Reload ở DB9 Team Translator, rồi F5 tab Teams.

## Lỗi thường gặp

| Hiện tượng | Cách xử lý |
|---|---|
| Không thấy sidebar | Bấm vào ô soạn tin (sidebar chỉ hiện khi ô chat được focus) |
| Preview "❌ Dịch lỗi" | Google chặn tạm thời / mất mạng — đợi rồi thử lại |
