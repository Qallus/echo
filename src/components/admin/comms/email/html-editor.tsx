"use client";

import { useImperativeHandle, useRef } from "react";
import CodeMirror, { EditorView, type ReactCodeMirrorRef } from "@uiw/react-codemirror";
import { html } from "@codemirror/lang-html";
import { useTheme } from "next-themes";

const extensions = [html(), EditorView.lineWrapping];
export type HtmlEditorHandle = { insert: (token: string) => void };

// HTML mode: a full-width code editor with HTML highlighting. The fields row
// above it inserts merge fields at the cursor through `handle`.
export function HtmlEditor({ value, onChange, handle }: { value: string; onChange: (v: string) => void; handle?: React.Ref<HtmlEditorHandle> }) {
  const ref = useRef<ReactCodeMirrorRef>(null);
  const { resolvedTheme } = useTheme();
  useImperativeHandle(handle, () => ({
    insert: (token: string) => {
      const view = ref.current?.view;
      if (!view) { onChange(value + token); return; }
      const { from, to } = view.state.selection.main;
      view.dispatch({ changes: { from, to, insert: token }, selection: { anchor: from + token.length } });
      view.focus();
    },
  }), [onChange, value]);
  return (
    <section className="min-w-0 space-y-2 p-3">
      <div className="overflow-hidden rounded-xl border">
        <CodeMirror ref={ref} value={value} onChange={onChange} extensions={extensions} theme={resolvedTheme === "dark" ? "dark" : "light"} height="calc(100dvh - 17rem)" minHeight="480px"
          basicSetup={{ foldGutter: true, highlightActiveLine: true }} aria-label="Template HTML" />
      </div>
      <p className="text-xs text-muted-foreground">Scripts are removed. If there&apos;s no <code>{"{{unsubscribe_url}}"}</code> link, an Unsubscribe footer is added when it&apos;s sent. Use the eye button to preview.</p>
    </section>
  );
}
