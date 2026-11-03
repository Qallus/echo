"use client";

import { useEffect, useRef, useState } from "react";
import { EditorContent, useEditor, useEditorState, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Placeholder } from "@tiptap/extensions";
import { TaskItem } from "@tiptap/extension-task-item";
import { TaskList } from "@tiptap/extension-task-list";
import {
  Bold, Code2, Heading1, Heading2, Heading3, Italic, Link2, List, ListChecks, ListOrdered, Minus, Quote, Redo2, Strikethrough, Underline, Undo2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { saveWorkspaceContent } from "@/lib/admin/actions/workspace";
import { cn } from "@/lib/utils";

// Rich-text editor for workspace pages. Saves a second after typing stops,
// and before the tab closes.
export function WorkspaceEditor({ docId, initial, editable }: { docId: string; initial: Record<string, unknown>; editable: boolean }) {
  const [status, setStatus] = useState<"saved" | "saving" | "unsaved" | string>("saved");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pending = useRef(false);

  const editor = useEditor({
    immediatelyRender: false,
    editable,
    content: initial,
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] }, link: { openOnClick: !editable, autolink: true, defaultProtocol: "https" } }),
      Placeholder.configure({ placeholder: "Write something, or type to start…" }),
      TaskList, TaskItem.configure({ nested: true }),
    ],
    onUpdate: ({ editor: e }) => {
      pending.current = true;
      setStatus("unsaved");
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => void save(e), 1000);
    },
  });

  async function save(e: Editor) {
    if (!pending.current) return;
    pending.current = false;
    setStatus("saving");
    const r = await saveWorkspaceContent(docId, e.getJSON(), e.getText({ blockSeparator: "\n" }));
    setStatus(r.error ?? "saved");
  }

  useEffect(() => {
    const warn = (ev: BeforeUnloadEvent) => { if (pending.current) ev.preventDefault(); };
    window.addEventListener("beforeunload", warn);
    return () => {
      window.removeEventListener("beforeunload", warn);
      if (timer.current) clearTimeout(timer.current);
      if (pending.current && editor) void saveWorkspaceContent(docId, editor.getJSON(), editor.getText({ blockSeparator: "\n" }));
    };
  }, [docId, editor]);

  return (
    <div className="space-y-3">
      {editable && editor && <Toolbar editor={editor} status={status} />}
      <EditorContent editor={editor} className="min-h-[50vh] text-[0.95rem]" />
    </div>
  );
}

function Toolbar({ editor, status }: { editor: Editor; status: string }) {
  const s = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e.isActive("bold"), italic: e.isActive("italic"), underline: e.isActive("underline"), strike: e.isActive("strike"),
      h1: e.isActive("heading", { level: 1 }), h2: e.isActive("heading", { level: 2 }), h3: e.isActive("heading", { level: 3 }),
      bullet: e.isActive("bulletList"), ordered: e.isActive("orderedList"), task: e.isActive("taskList"),
      quote: e.isActive("blockquote"), code: e.isActive("codeBlock"), link: e.isActive("link"),
      undo: e.can().undo(), redo: e.can().redo(),
    }),
  });
  const c = () => editor.chain().focus();
  const link = () => {
    if (s.link) { c().unsetLink().run(); return; }
    const url = prompt("Link address");
    if (url) c().extendMarkRange("link").setLink({ href: /^(https?:|mailto:|tel:|\/)/i.test(url) ? url : `https://${url}` }).run();
  };
  const tools: ([string, typeof Bold, () => void, boolean] | "|")[] = [
    ["Bold", Bold, () => c().toggleBold().run(), s.bold],
    ["Italic", Italic, () => c().toggleItalic().run(), s.italic],
    ["Underline", Underline, () => c().toggleUnderline().run(), s.underline],
    ["Strikethrough", Strikethrough, () => c().toggleStrike().run(), s.strike],
    "|",
    ["Heading 1", Heading1, () => c().toggleHeading({ level: 1 }).run(), s.h1],
    ["Heading 2", Heading2, () => c().toggleHeading({ level: 2 }).run(), s.h2],
    ["Heading 3", Heading3, () => c().toggleHeading({ level: 3 }).run(), s.h3],
    "|",
    ["Bulleted list", List, () => c().toggleBulletList().run(), s.bullet],
    ["Numbered list", ListOrdered, () => c().toggleOrderedList().run(), s.ordered],
    ["Checklist", ListChecks, () => c().toggleTaskList().run(), s.task],
    "|",
    ["Quote", Quote, () => c().toggleBlockquote().run(), s.quote],
    ["Code block", Code2, () => c().toggleCodeBlock().run(), s.code],
    ["Link", Link2, link, s.link],
    ["Divider", Minus, () => c().setHorizontalRule().run(), false],
  ];
  return (
    <div className="sticky top-14 z-10 flex flex-wrap items-center gap-0.5 rounded-xl border bg-card/95 p-1 backdrop-blur md:top-2">
      {tools.map((t, i) => t === "|" ? <span key={i} className="mx-1 h-5 w-px bg-border" /> : (
        <Button key={t[0]} type="button" size="icon-sm" variant={t[3] ? "secondary" : "ghost"} aria-label={t[0]} title={t[0]} aria-pressed={t[3]} onClick={t[2]}>
          {(() => { const Icon = t[1]; return <Icon />; })()}
        </Button>
      ))}
      <span className="mx-1 h-5 w-px bg-border" />
      <Button type="button" size="icon-sm" variant="ghost" aria-label="Undo" title="Undo" disabled={!s.undo} onClick={() => c().undo().run()}><Undo2 /></Button>
      <Button type="button" size="icon-sm" variant="ghost" aria-label="Redo" title="Redo" disabled={!s.redo} onClick={() => c().redo().run()}><Redo2 /></Button>
      <span className={cn("ml-auto px-2 text-xs", status === "saved" || status === "saving" || status === "unsaved" ? "text-muted-foreground" : "text-destructive")}>
        {status === "saved" ? "Saved" : status === "saving" ? "Saving…" : status === "unsaved" ? "Unsaved changes" : status}
      </span>
    </div>
  );
}
