// lib/constants.js

// The default Notebook we target for indexing/searching.
// You can override via Vercel env: ONE_NOTE_NOTEBOOK_NAME
export const ONE_NOTE_NOTEBOOK_NAME =
  process.env.ONE_NOTE_NOTEBOOK_NAME || "AliceChatGPT";

// The Inbox section where /api/onenote/log creates today's page.
// You can override via Vercel env: ONE_NOTE_INBOX_SECTION_ID
export const ONE_NOTE_INBOX_SECTION_ID =
  process.env.ONE_NOTE_INBOX_SECTION_ID ||
  // Your known Inbox fallback:
  "0-824A10198D31C608!scfd7de0686df4aa1bc663dd4e7769585";

// Base URL of this app (used by some debug/links). Optional.
export const APP_BASE_URL =
  process.env.APP_BASE_URL || "https://alice-onenote-router.vercel.app";

// Optional: storage key for token dump in KV (used by diagnostics convenience)
export const MSAUTH_STORAGE_KEY = process.env.MSAUTH_STORAGE_KEY || "msauth:default";
