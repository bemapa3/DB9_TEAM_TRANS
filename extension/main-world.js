// ============================================================
// main-world.js — DB9 Team Translator (chạy trong MAIN world của trang Teams)
// Lý do: content script (ISOLATED) không truy cập được CKEditor instance.
// CKEditor 5 gắn instance vào ô soạn: element.ckeditorInstance
// (https://ckeditor.com/docs/ckeditor5/latest/framework/how-tos.html)
// Nhận lệnh 'ttr:replace' (detail = JSON string), thay phần tự gõ bằng bản dịch
// qua model của CKEditor (giữ khối trích dẫn), trả 'ttr:replace:done'.
// ============================================================
(() => {
    'use strict';
    if (window.__ttrMainWorld) return;
    window.__ttrMainWorld = true;

    function reply(id, data) {
        document.dispatchEvent(new CustomEvent('ttr:replace:done', { detail: JSON.stringify({ id, ...data }) }));
    }

    function findEditorInstance() {
        const active = document.activeElement;
        const el = active && active.closest ? active.closest('.ck-editor__editable') : null;
        return el && el.ckeditorInstance ? el.ckeditorInstance : null;
    }

    function isQuoteModelNode(editor, node, quoteSel) {
        if (!node.is || !node.is('element')) return false;
        if (node.name === 'blockQuote') return true;
        try {
            const viewEl = editor.editing.mapper.toViewElement(node);
            const dom = viewEl && editor.editing.view.domConverter.mapViewToDom(viewEl);
            return !!(dom && dom.nodeType === 1 && (dom.matches(quoteSel) || dom.querySelector(quoteSel)));
        } catch (_) {
            return false;
        }
    }

    function replaceOwnText(req) {
        const editor = findEditorInstance();
        if (!editor) return { ok: false, reason: 'no-instance' };

        const model = editor.model;
        const root = model.document.getRoot();
        const children = Array.from(root.getChildren());
        const own = children.filter(n => !isQuoteModelNode(editor, n, req.quoteSel));
        if (!own.length) return { ok: false, reason: 'no-own-blocks' };
        if (!model.schema.checkChild(root, 'paragraph')) return { ok: false, reason: 'no-paragraph' };

        const lines = String(req.text || '').replace(/\r\n/g, '\n').split('\n');
        const insertIndex = own[0].index;

        model.change(writer => {
            for (const node of own) writer.remove(node);
            lines.forEach((line, i) => {
                const p = writer.createElement('paragraph');
                if (line) writer.insertText(line, p);
                writer.insert(p, root, insertIndex + i);
            });
            const last = root.getChild(insertIndex + lines.length - 1);
            if (last) writer.setSelection(last, 'end');
        });
        return { ok: true };
    }

    document.addEventListener('ttr:replace', (e) => {
        let req;
        try { req = JSON.parse(e.detail); } catch (_) { return; }
        try {
            reply(req.id, replaceOwnText(req));
        } catch (err) {
            reply(req.id, { ok: false, reason: 'error: ' + (err && err.message) });
        }
    });
})();
