# 🖥️ Teams Translator Pro v5.0 — Hướng dẫn dùng với Teams Desktop

## ⚠️ Vấn đề: Teams Desktop App không hỗ trợ Chrome Extensions

Teams Desktop App (Windows / macOS) được xây dựng trên nền **Electron** — một WebView riêng biệt, **không phải** trình duyệt Chrome/Edge thực sự. Do đó:

- ❌ Extension Chrome/Edge **KHÔNG** được load trong Teams Desktop
- ❌ Không thể inject content scripts
- ❌ Extension sẽ không xuất hiện trong thanh toolbar khi dùng Teams Desktop

---

## ✅ Giải pháp 1: Dùng Teams Web (đơn giản nhất)

1. Mở **Google Chrome** hoặc **Microsoft Edge**
2. Truy cập: [https://teams.microsoft.com](https://teams.microsoft.com)
3. Đăng nhập bằng tài khoản Microsoft 365 của bạn
4. Extension **Teams Translator Pro** sẽ hoạt động bình thường

> 💡 Teams Web hiện tại có đầy đủ tính năng như Desktop App, bao gồm cả cuộc họp video, chia sẻ màn hình, và file.

---

## ✅ Giải pháp 2: Cài Teams như PWA trong Chrome (khuyến nghị)

PWA (Progressive Web App) chạy trong Chrome engine thực sự → Extensions hoạt động được!

### Cách cài:

**Bước 1:** Mở Chrome, truy cập:
```
https://teams.cloud.microsoft
```

**Bước 2:** Nhấn vào menu **⋮** (3 chấm góc phải trên cùng)

**Bước 3:** Chọn **"More tools"** → **"Create shortcut..."**

**Bước 4:** Đặt tên (ví dụ: `Microsoft Teams`), tick ✅ **"Open as window"** → Nhấn **Create**

**Bước 5:** Teams PWA sẽ mở trong cửa sổ riêng → Extension **Teams Translator Pro** vẫn hoạt động!

> 💡 PWA cũng có thể pin vào Taskbar (Windows) hoặc Dock (macOS) như app thông thường.

---

## ✅ Giải pháp 3: Dùng Microsoft Edge với Teams PWA

Microsoft Edge có hỗ trợ PWA tốt hơn:

1. Mở **Edge**, vào [https://teams.cloud.microsoft](https://teams.cloud.microsoft)
2. Menu **...** → **Apps** → **"Install this site as an app"**
3. Đặt tên → Install
4. Extension (đã cài trong Edge) sẽ hoạt động trong Teams PWA window

---

## 📌 So sánh nhanh

| Phương pháp         | Extension hoạt động? | Trải nghiệm          |
|---------------------|----------------------|----------------------|
| Teams Desktop App   | ❌ Không              | Native app           |
| Teams Web (Chrome)  | ✅ Có                 | Tốt, đầy đủ tính năng|
| Teams PWA (Chrome)  | ✅ Có                 | Gần giống native app |
| Teams PWA (Edge)    | ✅ Có                 | Gần giống native app |

---

## 🔧 Cài đặt Extension

1. Mở Chrome/Edge → vào `chrome://extensions/` (hoặc `edge://extensions/`)
2. Bật **Developer mode** (góc phải trên)
3. Nhấn **"Load unpacked"**
4. Chọn thư mục chứa extension (có `manifest.json`)
5. Extension sẽ xuất hiện trong thanh toolbar

---

## 🚀 Tính năng v5.0

- **Sidebar panel** cố định bên phải — xem bản dịch live khi gõ
- **Ctrl+Enter** — dịch và gửi tự động (không cần copy-paste)
- **Từ điển chuyên ngành** — ArchViz + PC Hardware
- **OCR ảnh** — dịch chữ trong ảnh
- Hỗ trợ dịch **EN ↔ VI** và **JA ↔ VI**

---

*Teams Translator Pro v5.0 — i8 Studio AI Research*
