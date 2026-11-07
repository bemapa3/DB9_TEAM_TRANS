# STATE — DB9_TEAM TRANS

> Trạng thái DUY NHẤT của project. Cập nhật cuối mỗi phiên. Giữ file ngắn: xoá dòng cũ không còn đúng.

**Cập nhật:** 2026-11-08 · **Bởi:** Claude · **Version:** 6.4.6

## Bản đồ module

🔒 Khoá = chạy tốt, đã test, không sửa nếu không bắt buộc · 🔧 Đang làm · ⏳ Chưa làm

| # | Module | File | Trạng thái | Kiểm chứng bằng |
|---|---|---|---|---|
| 1 | Dịch tin đến (cache theo nội dung, quét tin gần màn hình, thử lại khi lỗi) | `extension/content.js` (cuối file) | 🔧 đã chạy trên Teams thật (v6.4.5), chờ kiểm v6.4.6 | `tests/test_scroll_virtual_mock.js` + Teams thật |
| 2 | Sidebar + preview (lazy theo frame, theo sự kiện từ v6.4.6) | `extension/content.js` | 🔧 chờ test Teams thật | test mock |
| 3 | Ctrl+Enter dịch + gửi (giữ quote) | `extension/content.js` | 🔧 chờ test Teams thật | — |
| 4 | Dịch Gemini + dự phòng Google + badge | `extension/background.js`, `options.*` | 🔧 chờ chủ kiểm tra key | `tests/test_background_gemini.js` |
| 5 | OCR / glossary cũ | `extension/background.js` | 🔒 | `node --check` |

## NEXT_STEP

1. Chủ test tay trên Teams Web (Load unpacked thư mục `extension/`):
   a) mở 1 chat có tin tiếng Anh/Nhật → có dòng 🇻🇳 dưới tin; tin nhiều dòng → dòng dịch xuống dòng đúng như tin gốc (v6.4.2);
   b) bấm vào ô chat → sidebar hiện **1 cái**;
   c) gõ 2 dòng tiếng Việt → preview giữ 2 dòng;
   d) Ctrl+Enter → tin gửi đi là bản dịch (toast ✅ Đã gửi);
   e) Reply có trích dẫn → Ctrl+Enter → quote giữ nguyên, chỉ phần mình gõ được dịch;
   f) Tin có reaction → emoji không đè dòng dịch, dòng dịch không có chữ "tương tác".
   Hỏng bước nào → F12 → Console, lọc `TTR`, bật `TTR_DEBUG = true` trong content.js nếu cần, gửi Claude log + toast hiện ra.
2. Đạt → đánh 🔒 module 1–3.
3. Việc để sau (chờ chủ quyết): thay dịch vụ dịch chính thức; nối/bỏ OCR + từ điển.

## ⏳ Chưa kiểm chứng / đang vướng

- Chưa chạy trên Teams thật. Thư mục cũ `teams-ext\` + file zip cần chuyển vào `_ARCHIVE\` (phiên Claude không chuyển được file).

## File sửa trong phiên gần nhất

- v6.4.6: `extension/content.js` (preview theo sự kiện, MutationObserver chỉ khung chat, IntersectionObserver gắn khung cuộn + dịch trước ±400px, nghỉ khi tab ẩn), `tests/test_scroll_virtual_mock.js` (mới), `tests/test_background_gemini.js` (sửa Google giả + ca nhận nhầm `vi`), `AGENTS.md`, `manifest.json`, `versions.json`.
- v6.4.5: `extension/content.js` (viết lại phần dịch tin đến: cache theo nội dung, throttle, thử lại, `data-ttr-state`, dịch đoạn song song, so toàn bộ nội dung), `extension/background.js` (`translateGoogle`: nhận nhầm `vi` → dịch lại `sl=en`), `manifest.json`, `versions.json`.

## Ý tưởng sau (không làm khi chưa được giao)

- Ctrl+Enter: dịch trước bằng Gemini khi ngừng gõ ~1,5s → bấm là gửi ngay (tốn thêm lượt Gemini).

