import "server-only";
import { AsyncLocalStorage } from "node:async_hooks";

// The Redial app's access token for the current request. Only the mobile API
// (src/app/api/mobile) sets it, after checking the token; while it's set,
// createClient() and getUser() act as that member instead of reading cookies,
// so the web's reads and actions work unchanged for the app. Every other
// route ignores Authorization headers.
const store = new AsyncLocalStorage<string>();

export const runAsMobile = <T>(token: string, fn: () => Promise<T>) => store.run(token, fn);
export const mobileToken = () => store.getStore() ?? null;
