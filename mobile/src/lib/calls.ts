import { phone } from "./format";
import type { Call } from "./types";

// Who called, as best we know: the name they gave, caller ID, or the number.
export const callerOf = (c: Pick<Call, "caller_name" | "caller_id_name" | "from_number">) =>
  c.caller_name || c.caller_id_name || phone(c.from_number) || "Unknown caller";
