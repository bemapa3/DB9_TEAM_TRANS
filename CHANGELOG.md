# Changelog — DB9_TEAM TRANS

Mỗi bản = 1 git tag `vX.Y.Z`. Nguồn version: `versions.json` + `extension/manifest.json`. Mục mới nhất ở TRÊN CÙNG.

## v6.4.6 — 2026-11-08

### ✅ Đã làm
- **Gõ chữ không còn bị quét liên tục:** preview trước chạy `setInterval` 250ms đọc `innerText` ô soạn (ép trình duyệt tính lại bố cục 4 lần/giây suốt lúc ô chat được focus). Giờ chỉ chạy theo sự kiện (phím, nhập, dán, cắt, focus) sau khi ngừng gõ 700ms.
- **Bỏ qua thay đổi ngoài khung chat:** chấm online, giờ, "đang gõ" ở danh sách bên trái trước cũng kích hoạt quét; giờ MutationObserver chỉ quét khi thay đổi nằm trong khung chat (hoặc khung chat bị thay khi đổi cuộc trò chuyện). Tab ẩn thì không quét, hiện lại thì quét.
- **Dịch trước tin sắp cuộn tới:** `rootMargin` của IntersectionObserver không có tác dụng trên Teams vì khung chat tự cuộn bên trong (observer theo cửa sổ bị cắt mất) → tin chỉ được dịch khi đã lên màn hình. Giờ gắn observer vào đúng khung cuộn, dịch trước ±400px.
- Bớt `querySelector` lặp: khung chat được nhớ, truyền vào kiểm tra từng tin.
- **Test:** thêm `tests/test_scroll_virtual_mock.js` (danh sách ảo hoá + dựng lại tin + rail đổi liên tục): v6.4.6 PASS, v6.4.4 FAIL (sau khi dựng lại 0/7 tin có dịch) → test bắt đúng lỗi. Sửa `tests/test_background_gemini.js`: Google giả thiếu `ok:true` từ v6.4.3 nên test luôn FAIL; thêm ca Google nhận nhầm `vi` → phải dịch lại `sl=en`, tin VI không dấu không bị ép dịch. Cả 4 test PASS (chạy Playwright trong môi trường Claude).
- **Đo CPU** (trang Teams giả, Chrome, 2 lượt/bản): phần extension tốn thêm ~10–20ms script mỗi 5s so với không cài (<0,5% CPU) khi ngồi yên/cuộn/gõ; chỗ khựng khi cuộn chủ yếu do trang tự dựng lại tin.

### ⏳ Chưa làm / chưa kiểm chứng
- ⏳ Kiểm lại trên Teams thật: preview khi gõ, dịch trước khi cuộn, đổi cuộc trò chuyện.
- Dịch trước làm số lượt gọi Google tăng (~gấp đôi khi cuộn nhiều) — gặp 429 thì giảm `rootMargin` hoặc `QUEUE_WORKERS`.

## v6.4.5 — 2026-11-08

### ✅ Đã làm
- **Hết mất dịch khi cuộn:** Teams ảo hoá danh sách tin (cuộn là xoá/dựng lại phần tử) và React hay xoá badge. Bản cũ đánh dấu `processed` vĩnh viễn theo phần tử (đánh dấu cả TRƯỚC khi gọi API) + `unobserve` sau lần đầu → tin dựng lại/badge bị xoá/dịch lỗi không bao giờ được dịch lại. Giờ nhớ bản dịch theo **nội dung tin** (`resultByText`), mỗi lượt quét tin gần màn hình thiếu badge thì chèn lại từ bộ nhớ (không gọi API) hoặc xếp hàng; Teams gắn lại đúng phần tử cũ thì theo dõi lại.
- **Dịch lỗi thì thử lại** giãn cách 2s → 4s → … tối đa 60s; Console in `[TTR] dịch thất bại: <lý do>` (trước im lặng). Sau khi reload extension → toast nhắc F5.
- **Bớt lag:** bỏ quét toàn bộ tin với `getComputedStyle`/`innerText` mỗi lần DOM đổi; chỉ xét tin gần màn hình, chỉ đọc lại chữ khi nội dung đổi, bỏ qua thay đổi DOM do chính extension; debounce (có lúc không chạy vì Teams đổi DOM liên tục) → throttle ~3 lần/giây. Bỏ log `Registered message nodes`.
- **Dịch nhanh hơn:** tin nhiều đoạn dịch các đoạn song song (trước tuần tự).
- **Câu tiếng Anh mở đầu bằng tên Việt** ("Cường Phạm & Nhật Quang - Please share…") trước không được dịch: Google `sl=auto` nhận nhầm là tiếng Việt → trả nguyên văn, content so 50 ký tự đầu thấy trùng → bỏ. `background.js`: Google báo nhận ra `vi` mà câu có ≥2 từ tiếng Anh thông dụng, không có CJK → dịch lại với `sl=en`. `content.js`: so toàn bộ nội dung thay vì 50 ký tự đầu.
- Tin chỉ có link không gửi đi dịch. Mỗi tin có `data-ttr-state` (`done/queued/fail:N/vi/skip/short`) để kiểm tra bằng DevTools.
- Kiểm chứng: `node --check` 2 file đạt; trên Teams Web thật (teams.live.com) bản trung gian đã dịch được các tin trước đó bị sót khi cuộn tới ("it needs a sidewalk…", "so it's currently 1m wide…", "Bao will model the streetscape…"); gọi Google thật xác nhận `sl=auto` trả `detected: vi` + nguyên văn, `sl=en` dịch đúng.

### ⏳ Chưa làm / chưa kiểm chứng
- ⏳ Kiểm lại trên Teams thật tin "Please share…" sau khi nạp v6.4.5 (cần reload extension + F5).
- Chưa chạy test Playwright (máy chưa cài).

## v6.4.4 — 2026-10-20

### ✅ Đã làm
- **Ctrl+Enter nhanh hơn với tin nhiều đoạn:** trước tách tin theo dòng trống, mỗi đoạn gọi Gemini 1 lượt nối tiếp (3 đoạn = chờ 3 lượt). Giờ gửi cả tin 1 lượt Gemini (prompt đã yêu cầu giữ xuống dòng). Tin đến/preview (Google) vẫn tách đoạn như cũ.
- **Đo thời gian:** toast "✅ Đã gửi" + Console (`[TTR] Ctrl+Enter: dịch Xs (engine) · thay+gửi Ys`) để biết chậm ở Gemini hay ở bước gửi.
- Kiểm chứng: `node --check` 2 file đạt. Đọc tài liệu Gemini (ai.google.dev/gemini-api/docs/thinking): model mặc định `gemini-3.5-flash-lite` đã ở mức thinking thấp nhất (minimal) → không phải nguyên nhân, không sửa.

### ⏳ Chưa làm / chưa kiểm chứng
- ⏳ Chưa kiểm trên Teams thật; chưa đo Gemini thật (cần key). Cần xem Gemini có giữ đúng dòng trống giữa các đoạn không.
- Nếu Gemini thật chậm (>2s): cách tiếp theo là dịch trước bằng Gemini khi ngừng gõ (tốn thêm lượt) — chờ thày quyết.

## v6.4.3 — 2026-10-20

### ✅ Đã làm
- **Dịch tin đến nhanh hơn:** hàng đợi trước chạy tuần tự từng tin (+80ms nghỉ) và dịch từ tin CŨ NHẤT trên cùng → tin mới nhất ở cuối khung chat phải chờ cả màn hình dịch xong. Giờ chạy 4 tin song song, tin mới nhất trước, bỏ nghỉ 80ms.
- **Google có timeout 8 giây + kiểm HTTP lỗi:** trước không có timeout → 1 lượt treo làm đứng cả hàng đợi.
- Kiểm chứng: đo Google `translate_a/single` thật ~0,2s/lượt (không phải nguồn chậm); `node --check` 2 file đạt.

### ⏳ Chưa làm / chưa kiểm chứng
- ⏳ Chưa kiểm trên Teams thật; chưa chạy test Playwright (máy chưa cài).
- 4 lượt song song có thể làm Google trả 429 nếu mở kênh rất nhiều tin — gặp thì giảm `QUEUE_WORKERS`.
- Ctrl+Enter (Gemini) chưa đo được tốc độ (cần key của thày).

## v6.4.2 — 2026-10-07

### ✅ Đã làm
- **Dòng dịch tin đến giữ xuống dòng như chat gốc:** `getIncomingText` trước đây gộp mọi khoảng trắng thành 1 dấu cách → giờ duyệt DOM, mỗi khối (`p`/`div`/`li`) = 1 dòng, `<br>` = xuống dòng, đoạn trống = dòng trống (vẫn bỏ quote/reaction). Dòng dịch thêm `white-space:pre-wrap`.
- Tin đến dịch qua `translateStructuredText` (theo từng đoạn). Nếu Google trả về lệch số dòng so với bản gốc → tự dịch lại từng dòng (không áp dụng cho Gemini).
- Kiểm chứng: `node --check` đạt; trang Teams giả chạy trong trình duyệt (Google giả cố tình gộp dòng): tin 5 dòng + 1 dòng trống → dòng dịch đủ 5 dòng + 1 dòng trống, quote không bị dịch, tin VI không có badge, console không lỗi.

### ⏳ Chưa làm / chưa kiểm chứng
- ⏳ Chưa kiểm trên Teams thật (cấu trúc DOM tin nhiều dòng của Teams là suy đoán `p`/`br`; cách duyệt dựa trên `display` nên không phụ thuộc tên thẻ).
- Chưa chạy 3 test Playwright trong `tests/` (máy chưa cài `playwright`); `test_content_mock.js` đã thêm 1 tin nhiều dòng.
- Tin nhiều dòng tốn nhiều lượt gọi Google hơn (1 lượt/đoạn, tệ nhất 1 lượt/dòng).

## v6.4.1 — 2026-10-01

### ✅ Đã làm
- **Sửa reaction đè dòng dịch:** Teams để khối reaction (`__reactions`, cao 0px, nội dung tràn) là con cuối của bong bóng → dòng dịch giờ được chèn TRƯỚC khối này thay vì append ở cuối. Bỏ CSS `margin-bottom:26px` khi có reaction.
- **Sửa bong bóng chat bị kéo dài:** bỏ cách "chừa lề ngang" trong `fixBadgeOverlap` (lề bằng bề rộng reaction > bề rộng dòng dịch → chữ dồn 1 cột). Chỉ còn đẩy xuống (tối đa 60px), chỉ tính phần tử nhỏ (≤160px, ≤48px cao).
- **Không dịch nhầm dòng tên người gửi:** selector khung tin đổi `[class*="fui-ChatMessage"]` → `.fui-ChatMessage, .fui-ChatMyMessage` (cũ khớp cả `__author`, `__timestamp`…).
- Kiểm chứng trên Teams Web thật (teams.cloud.microsoft): append cuối → 6 điểm bị Toolbar/Button đè; chèn trước reaction → 0 điểm. 94/94 khung tin tìm đúng `chat-pane-message`. Chủ xác nhận hết lỗi.

### ⏳ Chưa làm / chưa kiểm chứng
- Chưa chạy lại 3 test mock (`tests/`) sau bản sửa.
- Tin do chính mình gửi (bằng tiếng Anh) vẫn được dịch ngược sang tiếng Việt.

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
