// lib/constants.js
// Centralized constants used across the Alice OneNote Router

// Default section where daily logs should be created/appended.
// You can set this in Vercel as an environment variable: ONE_NOTE_INBOX_SECTION_ID.
// Example: 0-824A10198D31C608!scfd7de0686df4aa1bc663dd4e7769585
export const ONE_NOTE_INBOX_SECTION_ID =
  process.env.ONE_NOTE_INBOX_SECTION_ID || "";

// Add other constants here if needed later.
// Example:
// export const DAILY_LOG_TITLE_PREFIX = "Daily Log — ";
