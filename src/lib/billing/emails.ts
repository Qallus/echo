import "server-only";
import { money } from "./catalog";
import { sendEmail, siteUrl } from "@/lib/notify/senders";

type Order = { id: string; number: number; email: string | null; currency: string; subtotal: number; discount: number; tax: number; total: number; kind: string; created_at: string; receipt_url: string | null };
type Line = { description: string; quantity: number; amount: number; interval: string | null };

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

// Order confirmation / renewal receipt, in the Echo email style.
export async function sendOrderEmail(order: Order, lines: Line[]) {
  if (!order.email) return;
  const m = (c: number) => money(c, order.currency);
  const date = new Date(order.created_at).toLocaleDateString("en-US", { dateStyle: "long" });
  const title = order.kind === "renewal" ? `Your Echo renewal receipt (#${order.number})` : `Thanks for your order (#${order.number})`;
  const url = siteUrl(`/orders/${order.id}`);
  const rows = lines.map((l) => `<tr>
    <td style="padding:10px 0;border-bottom:1px solid #f0f0f0;font-size:14px">${esc(l.description)}${l.quantity > 1 ? ` <span style="color:#737373">× ${l.quantity}</span>` : ""}${l.interval ? ` <span style="color:#737373">(per ${l.interval})</span>` : ""}</td>
    <td style="padding:10px 0;border-bottom:1px solid #f0f0f0;font-size:14px;text-align:right">${m(l.amount)}</td></tr>`).join("");
  const sum = (label: string, value: number, bold = false) => value || bold ? `<tr><td style="padding:6px 0;font-size:14px;color:${bold ? "#0a0a0a" : "#737373"};${bold ? "font-weight:600" : ""}">${label}</td><td style="padding:6px 0;font-size:14px;text-align:right;${bold ? "font-weight:600" : ""}">${m(value)}</td></tr>` : "";

  const html = `<!doctype html><html><body style="margin:0;background:#f5f5f5;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#0a0a0a">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border:1px solid #e5e5e5;border-radius:16px">
<tr><td style="padding:28px 32px 0;font-weight:600;letter-spacing:.2em;font-size:15px">ECHO</td></tr>
<tr><td style="padding:20px 32px 0;font-size:20px;font-weight:600">${esc(title)}</td></tr>
<tr><td style="padding:8px 32px 0;font-size:14px;color:#737373">Order #${order.number} · ${date}</td></tr>
<tr><td style="padding:20px 32px 0"><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table></td></tr>
<tr><td style="padding:12px 32px 0"><table role="presentation" width="100%" cellpadding="0" cellspacing="0">
${sum("Subtotal", order.subtotal)}${order.discount ? sum("Discount", -order.discount) : ""}${sum("Tax", order.tax)}${sum("Total paid", order.total, true)}
</table></td></tr>
<tr><td style="padding:24px 32px 0"><a href="${esc(url)}" style="display:inline-block;background:#0a0a0a;color:#fff;text-decoration:none;font-size:14px;font-weight:600;padding:12px 20px;border-radius:10px">View receipt</a></td></tr>
<tr><td style="padding:28px 32px;font-size:12px;color:#737373">Questions about this charge? Reply to this email or write to jwaters@qallus.co. Manage your plan any time from Billing in Echo.<br>Qallus LLC · Echo</td></tr>
</table></td></tr></table></body></html>`;

  const text = [title, `Order #${order.number} · ${date}`, "", ...lines.map((l) => `${l.description}${l.quantity > 1 ? ` × ${l.quantity}` : ""}  ${m(l.amount)}`), "", `Total paid: ${m(order.total)}`, "", `Receipt: ${url}`].join("\n");
  const res = await sendEmail(order.email, title, html, text);
  if (!res.ok) console.error("order email", order.id, res.error);
}
