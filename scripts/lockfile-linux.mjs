// Re-resolves package-lock.json on Linux (in Docker). npm on Windows leaves
// out Linux-only optional packages (@emnapi/*), and then `npm ci` in the
// production image (Coolify) refuses the lock file.
//   npm run lock:linux    (after any npm install / uninstall; needs Docker)

import { execFileSync } from "node:child_process";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
execFileSync("docker", [
  "run", "--rm", "-v", `${root}:/app`, "-w", "/app", "node:24-alpine",
  "npm", "install", "--package-lock-only", "--no-audit", "--no-fund",
], { stdio: "inherit" });
console.log("package-lock.json re-resolved for Linux.");
