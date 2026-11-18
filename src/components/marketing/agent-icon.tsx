import type { SVGProps } from "react";

// A person wearing a headset (Live Agents), drawn to match lucide icons:
// 24x24, 2px round strokes, currentColor.
export function AgentIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <circle cx="12" cy="8" r="4" />
      <path d="M6.5 9.5V8a5.5 5.5 0 0 1 11 0v1.5" />
      <path d="M17.5 10v1a3 3 0 0 1-3 3h-1.5" />
      <path d="M4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1" />
    </svg>
  );
}

// A team of three (Live Agents as a group): a larger person in front with
// one on each side, matching lucide's 24x24, 2px round strokes.
export function TeamIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <circle cx="12" cy="7.5" r="3" />
      <circle cx="4.5" cy="10" r="2.2" />
      <circle cx="19.5" cy="10" r="2.2" />
      <path d="M6.5 20.5a5.5 5.5 0 0 1 11 0" />
      <path d="M1.5 18.5a3.6 3.6 0 0 1 4.6-3.4" />
      <path d="M22.5 18.5a3.6 3.6 0 0 0-4.6-3.4" />
    </svg>
  );
}
