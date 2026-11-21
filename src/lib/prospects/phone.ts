// Business numbers for prospecting are US/Canada (NANP). Normalize to E.164
// and reject anything that can't be a real number before it costs a lookup:
// area code and exchange can't start with 0 or 1, and no 555-01xx test numbers.
export function prospectE164(raw: string): string | null {
  const d = raw.replace(/[^\d]/g, "");
  const ten = d.length === 10 ? d : d.length === 11 && d.startsWith("1") ? d.slice(1) : null;
  if (!ten) return null;
  if (!/^[2-9]\d{2}[2-9]\d{6}$/.test(ten)) return null;
  if (/^\d{3}55501\d{2}$/.test(ten)) return null;
  return `+1${ten}`;
}

export const prettyPhone = (e164: string) => e164.replace(/^\+1(\d{3})(\d{3})(\d{4})$/, "($1) $2-$3");
