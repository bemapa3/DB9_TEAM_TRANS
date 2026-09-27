# AGENTS.md — DB9_TEAM TRANS

> Đọc file này + `docs/STATE.md` + mục mới nhất `CHANGELOG.md` là đủ để làm tiếp. **Không đọc lại git.**
> Luật chung: `..\AGENTS.md`.

## 1. Project

- **Tên hiển thị:** DB9 Team Translator (extension Chrome/Edge)
- **Làm gì:** dịch song ngữ trên Microsoft Teams Web cho team DB9: tin đến (EN/JA/…) → dịch VI ngay dưới tin; tin đang gõ (VI) → preview EN/JA; Ctrl+Enter copy bản dịch.
- **GitHub:** github.com/bemapa3/DB9_TEAM_TRANS (chưa tạo)

## 2. Phần mềm & ngôn ngữ

| Nền tảng | Ngôn ngữ / API | Tài liệu chính thức |
|---|---|---|
| Chrome/Edge, Teams Web (không chạy Teams Desktop) | JavaScript, Manifest V3 (content script + service worker) | https://developer.chrome.com/docs/extensions/reference/manifest |

## 3. File quan trọng

| File | Vai trò |
|---|---|
| `extension/manifest.json` | Quyền, host, version (nguồn version của extension) |
| `extension/content.js` | Sidebar preview, Ctrl+Enter copy, dịch tin đến trong khung chat |
| `extension/main-world.js` | Chạy MAIN world: thay chữ qua `ckeditorInstance.model` khi Ctrl+Enter (nhận/trả sự kiện `ttr:replace`) |
| `extension/background.js` | Dịch: Gemini API (key trong `chrome.storage.local`) → lỗi thì Google `translate_a/single`; badge trạng thái; OCR (OCR.space demo key) |
| `extension/options.html/.js` | Trang Cài đặt: key, model, kiểm tra key, trạng thái |
| `tests/test_content_mock.js`, `tests/test_quote_send_mock.js`, `tests/test_background_gemini.js` | Test content.js trên trang Teams giả (Playwright + Chromium) |
| `docs/TEAMS_DESKTOP.md` | Vì sao không chạy trên Teams Desktop + cách dùng PWA |

## 4. Chạy & kiểm chứng

```powershell
node --check extension\content.js; node --check extension\background.js
npm i -D playwright ; node tests\test_content_mock.js   # cần Chromium của Playwright
```
Kết quả đúng: `errors: []`, `sidebarBeforeFocus: false`, 2 badge (EN + JA, không có tin VI), preview giữ xuống dòng, `counts.iframe: 0`.
Test tay trên Teams thật: xem `docs/STATE.md`.

## 5. Cài vào trình duyệt

`chrome://extensions` → Developer mode → **Load unpacked** → chọn `J:\!!_BAOTAPCODE\DB9_TEAM TRANS\extension`.

## 6. Phát hành

Theo luật chung mục 7. Version tăng ở `extension/manifest.json` + `versions.json`. Không cần build.

## 7. Quy ước riêng

- Teams dùng CKEditor: chèn DOM/`insertText` + bấm Gửi làm Teams gửi lại bản gốc (v5.x). Từ v6.2 thay chữ qua **model CKEditor** (`main-world.js`), dự phòng **sự kiện paste** và **chỉ gửi sau khi kiểm tra ô chat khớp bản dịch**; không khớp thì chỉ copy.
- Selector Teams (`data-tid=...`) dễ đổi theo bản Teams → khi hỏng, ghi vào `docs/LESSONS.md`.
- **Không bao giờ ghi API key vào code/git.** Key chỉ nhập ở trang Cài đặt.
