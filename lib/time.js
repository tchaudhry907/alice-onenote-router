// lib/time.js
export function nowInTZ(tz = process.env.USER_TZ || 'America/New_York') {
  const d = new Date();
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  // "MM/DD/YYYY, HH:MM:SS"
  const parts = fmt.formatToParts(d).reduce((o, p) => (o[p.type] = p.value, o), {});
  return {
    iso: new Date(new Intl.DateTimeFormat('en-US', { timeZone: tz }).format(d)).toISOString(),
    stamp: `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second}`,
    tz,
  };
}
