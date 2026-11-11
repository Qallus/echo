"use client";

import { createContext, useContext } from "react";
import type { BuilderContext } from "@/lib/flows/data";

// What the block forms can pick from (recordings, lines, Directory contacts,
// extensions, other call trees), loaded once by the Call Tree page.
const Ctx = createContext<BuilderContext>({ recordings: [], lines: [], directory: [], extensions: [], flows: [] });

export const BuilderProvider = Ctx.Provider;
export const useBuilder = () => useContext(Ctx);
