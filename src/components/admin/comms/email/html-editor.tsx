"use client";

import { useRef } from "react";
import CodeMirror, { EditorView, type ReactCodeMirrorRef } from "@uiw/react-codemirror";
import { html } from "@codemirror/lang-html";
import { useTheme } from "next-themes";
import { MERGE_FIELDS } from "@/lib/comms/blocks";

const extensions = [html(), EditorView.lineWrapping];

// HTML mode: a code editor with HTML highlighting. Merge fields insert at
// the cursor.
export function HtmlEditor({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const ref = useRef<ReactCodeMirrorRef>(null);
  const { resolvedTheme } = useTheme();
  const insert = (token: string) => {
    const view = ref.current?.view;
    if (!view) { onChange(value + token); return; }
    const { from, to } = view.state.selection.main;
    view.dispatch({ changes: { from, to, insert: token }, selection: { anchor: from + token.length } });
    view.focus();
  };
  return (
    <section className="min-w-0 space-y-2">
      <div className="flex flex-wrap items-center gap-1">
        <h3 className="mr-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">HTML</h3>
        {MERGE_FIELDS.slice(0, 10).map((m) => <button key={m.token} type="button" onClick={() => insert(m.token)} className="rounded border px-1.5 py-0.5 text-[11px] text-muted-foreground hover:bg-muted">{m.label}</button>)}
      </div>
      <div className="overflow-hidden rounded-xl border">
        <CodeMirror ref={ref} value={value} onChange={onChange} extensions={extensions} theme={resolvedTheme === "dark" ? "dark" : "light"} height="640px"
          basicSetup={{ foldGutter: true, highlightActiveLine: true }} aria-label="Template HTML" />
      </div>
      <p className="text-xs text-muted-foreground">Scripts are removed. If there&apos;s no <code>{"{{unsubscribe_url}}"}</code> link, an Unsubscribe footer is added when it&apos;s sent.</p>
    </section>
  );
}
