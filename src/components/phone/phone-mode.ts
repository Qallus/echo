"use client";

import { createContext, useContext } from "react";

// Which part of the phone a page shows on small screens: the keypad, the
// call log (recents), or both (desktop, and pages without phone tabs).
export type PhoneMode = "both" | "pad" | "log";
export const PhoneModeContext = createContext<PhoneMode>("both");
export const usePhoneMode = () => useContext(PhoneModeContext);
