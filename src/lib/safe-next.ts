// Only allow same-site relative paths as post-login redirects. Signing in
// lands on the dashboard (/home), not the homepage.
export function safeNext(next: string | null | undefined) {
  if (!next || next === "/" || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return "/home";
  return next;
}
