"use client"

import * as React from "react"
import { Input } from "@/components/ui/input"

// "4803527598" -> "(480) 352-7598"; "+14803527598" -> "+1 (480) 352-7598".
// Other country codes keep their digits, grouped loosely. Partial numbers
// format as you type.
export function formatPhone(raw: string): string {
  const intl = raw.trim().startsWith("+")
  let d = raw.replace(/\D/g, "")
  if (intl && !d.startsWith("1")) return `+${d.replace(/(\d{1,3})(\d{0,3})(\d{0,4})(\d*)/, (_, a, b, c, e) => [a, b, c, e].filter(Boolean).join(" "))}`.slice(0, 22)
  const country = d.length > 10 && d.startsWith("1") ? "+1 " : intl ? "+1 " : ""
  if (country) d = d.slice(1)
  d = d.slice(0, 10)
  if (d.length === 0) return intl ? "+" : ""
  if (d.length < 4) return `${country}(${d}`
  if (d.length < 7) return `${country}(${d.slice(0, 3)}) ${d.slice(3)}`
  return `${country}(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`
}

// A phone field that formats US numbers as you type. Controlled
// (value + onChange) or uncontrolled in a form (name + defaultValue).
function PhoneInput({ value, defaultValue, onChange, ...props }: Omit<React.ComponentProps<typeof Input>, "value" | "defaultValue" | "onChange" | "type"> & {
  value?: string; defaultValue?: string | null; onChange?: (value: string) => void
}) {
  const [inner, setInner] = React.useState(() => formatPhone(defaultValue ?? ""))
  const current = value !== undefined ? formatPhone(value) : inner
  return (
    <Input {...props} type="tel" inputMode="tel" autoComplete={props.autoComplete ?? "tel"} value={current}
      onChange={(e) => {
        const next = formatPhone(e.target.value)
        if (value === undefined) setInner(next)
        onChange?.(next)
      }} />
  )
}

export { PhoneInput }
