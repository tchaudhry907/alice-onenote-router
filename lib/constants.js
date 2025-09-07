// Central place for app-wide constants/env fallbacks

// OneNote section where daily logs should be created/appended.
// Prefer setting this in Vercel as ONE_NOTE_INBOX_SECTION_ID.
// Example value (yours): 0-824A10198D31C608!scfd7de0686df4aa1bc663dd4e7769585
export const ONE_NOTE_INBOX_SECTION_ID =
  process.env.ONE_NOTE_INBOX_SECTION_ID || "";
