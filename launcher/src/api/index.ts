import { mockApi } from "./mock";
import { httpApi } from "./http";
import type { LauncherApi } from "./types";

// One switch flips the whole app from mock to the real backend.
const useReal = import.meta.env.VITE_USE_REAL_API === "true";
export const api: LauncherApi = useReal ? httpApi : mockApi;
export * from "./types";
