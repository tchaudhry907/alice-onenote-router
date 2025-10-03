// lib/msgraph.v6.js
// V6 Graph client used by the cron drain. Side-by-side with legacy lib/msgraph.js.

import { kv } from "@/lib/kv";

// Temporary stub until we wire this up
export function useMsGraphV6() {
  return {
    status: "ok",
    message: "msgraph.v6.js loaded"
  };
}
