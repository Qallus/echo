// A localStorage on the phone, backed by SQLite, for the sign-in session and
// small flags (onboarding seen). The web preview uses the browser's own.
import "expo-sqlite/localStorage/install";

export const store = globalThis.localStorage;
