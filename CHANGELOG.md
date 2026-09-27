# Changelog — DB9_TEAM TRANS

Mỗi bản = 1 git tag `vX.Y.Z`. Nguồn version: `versions.json` + `extension/manifest.json`. Mục mới nhất ở TRÊN CÙNG.

## v6.4.0 — 2026-09-28

### ✅ Đã làm
- **Tiết kiệm lượt Gemini:** chỉ tin gửi đi (Ctrl+Enter) dịch bằng Gemini; tin đến và Preview dùng Google. Sidebar ghi rõ "Preview (Google) — Ctrl+Enter gửi bản Gemini".
- **Chống đè chữ bằng đo thực tế:** sau khi hiện dòng dịch, dò lưới 15 điểm trên dòng dịch; có phần tử Teams (reaction, nút…) nằm đè thì đẩy dòng dịch xuống, nếu phần tử đó bám theo thì chừa lề bên phía nó đứng. Kiểm lại mỗi khi khung chat thay đổi (reaction thêm sau).
- Kiểm chứng: test trang giả có "reaction" đè lên chữ dịch — tắt bản sửa thì chữ bị đè, bật thì không; test background: tin đến dùng Google, tin gửi dùng Gemini, 429 → Google; 2 test cũ vẫn đạt.

### ⏳ Chưa làm / chưa kiểm chứng
- Chống đè chưa kiểm trên Teams thật (vị trí reaction của Teams là suy đoán; cách đo không phụ thuộc tên class nên áp dụng chung).
- Tin do chính mình gửi (bằng tiếng Anh) vẫn được dịch ngược sang tiếng Việt.

## v6.3.0 — 2026-09-28

### ✅ Đã làm
- Dịch bằng **Gemini API** (mặc định `gemini-3.5-flash-lite`): prompt riêng cho studio archviz, giữ giọng văn/emoji/xuống dòng, dùng bảng thuật ngữ sẵn có, không dịch tên phần mềm.
- Tự **dự phòng Google Translate** khi Gemini lỗi: 429 (hết lượt) nghỉ 1 phút; key/model sai nghỉ 10 phút; timeout 15 giây.
- Báo hết key: dấu **!** trên icon (cam = 429, đỏ = key/model lỗi), toast 1 lần khi đổi trạng thái, sidebar ghi "Gemini ✨ / Google".
- Trang **Cài đặt** (bấm icon extension): nhập key + model, nút "Kiểm tra key", trạng thái, số lần dịch hôm nay, link AI Studio xem giới hạn.
- Key lưu `chrome.storage.local`, không nằm trong code/git. Key dạng `AQ.` gửi qua header `x-goog-api-key` (endpoint gốc).
- Kiểm chứng: test background với API giả (`tests/test_background_gemini.js`) PASS: gọi Gemini đúng header, 429 → Google + badge cam + toast, sau đó nghỉ; 2 test content vẫn đạt.

### ⏳ Chưa làm / chưa kiểm chứng
- Chưa gọi Gemini thật (máy cloud bị chặn mạng tới Google): key + tên model `gemini-3.5-flash-lite` cần chủ bấm "Kiểm tra key".

## v6.2.0 — 2026-09-28

### ✅ Đã làm
- Ctrl+Enter thay chữ **qua model của CKEditor** (file mới `extension/main-world.js`, chạy ở MAIN world, lấy `element.ckeditorInstance` theo tài liệu CKEditor 5). Teams gửi đúng những gì model chứa nên không còn bị gửi lại bản gốc. Không lấy được instance → tự dùng cách paste của v6.1.
- Giữ khối trích dẫn khi thay (bỏ qua phần tử model `blockQuote` hoặc phần tử có DOM khớp selector quote).
- Kiểm chứng: 2 test cũ vẫn đạt (đường dự phòng); test CKEditor giả: quote giữ nguyên, 2 dòng tự gõ được thay bằng 2 dòng bản dịch, 0 lỗi.

### ⏳ Chưa làm / chưa kiểm chứng
- Chưa chạy trên Teams thật: chưa biết Teams có gắn `ckeditorInstance` vào ô soạn hay không (ô soạn Teams có class `ck-editor__editable_inline`, đúng loại CKEditor 5).

## v6.1.0 — 2026-09-28

### ✅ Đã làm
- Ctrl+Enter = **dịch rồi gửi luôn**: thay phần mình gõ bằng bản dịch qua sự kiện paste (để editor cập nhật đúng dữ liệu), kiểm tra ô chat khớp bản dịch rồi mới bấm Gửi; không khớp thì không gửi, quay về copy.
- Trả lời có **trích dẫn (quote)**: không dịch phần trích dẫn, chỉ thay phần mình gõ, giữ nguyên khối quote khi gửi. Tin đến có trích dẫn cũng chỉ dịch phần mới.
- Không dịch dòng cảm xúc ("1 Laugh reaction" → trước đây ra "1 tương tác Cười lớn").
- Dòng dịch có khoảng trống phía dưới khi tin có reaction → emoji không đè chữ dịch.
- Kiểm chứng: 2 test Playwright trên trang giả (`tests/`) đều 0 lỗi; test quote: gửi đi = quote giữ nguyên + bản dịch.

### ⏳ Chưa làm / chưa kiểm chứng
- Chưa chạy trên Teams thật. Trang test dùng ô soạn giả, **không phải CKEditor thật** (máy cloud không tải được CKEditor) → việc Teams nhận paste + nút Gửi cần chủ test.
- Selector reaction/quote/nút Gửi là suy đoán theo tên thuộc tính Teams; sai thì cần 1 đoạn HTML (Inspect) để sửa.

## v6.0.0 — 2026-09-28

### ✅ Đã làm
- Đổi tên hiển thị: **DB9 Team Translator**; đưa về chuẩn `_TEMPLATE_PROJECT` (code trong `extension/`).
- Chống chạy trùng: sidebar + preview chỉ tạo ở frame có ô chat được focus (trước đây tạo ở mọi iframe do `all_frames`).
- Preview và Ctrl+Enter **giữ xuống dòng** (trước đây gộp hết thành 1 dòng trước khi dịch).
- Dịch được tin **tiếng Nhật/Trung/Hàn** đến (trước đây bị bỏ qua vì không có chữ Latin, và bị nhận nhầm là dòng tên người).
- Preview chỉ gọi API khi ngừng gõ 0,7 giây (giảm số lần gọi Google).
- Ctrl+Enter chỉ bị chặn khi đang ở ô chat (trước đây chặn toàn Teams).
- Xoá ~330 dòng code chết (chuỗi tự bấm Gửi của v5.x, hàm khai báo trùng).
- Sửa chữ trên sidebar: "Ctrl+Enter = copy bản dịch → Ctrl+A, Ctrl+V → Gửi"; version trên sidebar lấy từ manifest.
- Tắt debug log (trước đây ghi nội dung chat ra console).
- Kiểm chứng: `node --check` 2 file; test Playwright trên trang giả: 0 lỗi, 1 sidebar ở frame chính, 0 ở iframe, badge EN + JA, preview giữ xuống dòng.

### ⏳ Chưa làm / chưa kiểm chứng
- Chưa chạy trên Teams Web thật.
- Sidebar giờ chỉ hiện khi bấm vào ô chat (không hiện ngay khi mở Teams).
- Dịch qua endpoint Google không chính thức + OCR key demo `helloworld`: rủi ro bị chặn và gửi nội dung chat ra ngoài — chưa xử lý.
- OCR ảnh và panel Từ điển có ở background nhưng chưa có nút gọi; glossary gần như không tác dụng — chưa xử lý.
