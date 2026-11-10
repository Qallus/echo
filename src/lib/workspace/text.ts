// Plain text (light Markdown) -> a TipTap document, for docs written through
// the MCP. Understands "#"/"##"/"###" headings, "- " bullets, "1. " numbered
// items and "- [ ] " / "- [x] " tasks; everything else becomes paragraphs.

type Node = Record<string, unknown>;
const para = (text: string): Node => ({ type: "paragraph", content: text ? [{ type: "text", text }] : [] });

export function textToDoc(input: string): Node {
  const content: Node[] = [];
  let list: { type: string; items: Node[] } | null = null;
  const push = (type: string, item: Node) => {
    const open = list && list.type === type ? list : { type, items: [] as Node[] };
    if (open !== list) { list = open; content.push({ type, content: open.items }); }
    open.items.push(item);
  };
  for (const raw of input.replace(/\r\n?/g, "\n").split("\n")) {
    const line = raw.trimEnd();
    const task = line.match(/^\s*[-*] \[( |x|X)\] (.*)$/);
    const bullet = line.match(/^\s*[-*] (.*)$/);
    const numbered = line.match(/^\s*\d+[.)] (.*)$/);
    const heading = line.match(/^(#{1,3}) (.*)$/);
    if (task) push("taskList", { type: "taskItem", attrs: { checked: task[1] !== " " }, content: [para(task[2])] });
    else if (bullet) push("bulletList", { type: "listItem", content: [para(bullet[1])] });
    else if (numbered) push("orderedList", { type: "listItem", content: [para(numbered[1])] });
    else {
      list = null;
      if (heading) content.push({ type: "heading", attrs: { level: heading[1].length }, content: [{ type: "text", text: heading[2] }] });
      else if (line.trim()) content.push(para(line.trim()));
    }
  }
  return { type: "doc", content: content.length ? content : [para("")] };
}
