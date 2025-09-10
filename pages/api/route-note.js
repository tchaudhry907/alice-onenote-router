// pages/api/route-note.js

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'Method not allowed' });
    return;
  }

  const bearer = req.headers['authorization'];
  if (!bearer) {
    res.status(401).json({ ok: false, error: 'Missing Authorization' });
    return;
  }

  const { text, mode } = req.body || {};
  if (!text) {
    res.status(400).json({ ok: false, error: 'Missing text' });
    return;
  }

  // 1) Simple intent classifier
  const lower = text.toLowerCase();
  let kind = 'journal';
  if (/\b(breakfast|lunch|dinner|snack|meal|ate|calories)\b/.test(lower)) kind = 'food';
  else if (/\b(workout|gym|run|bike|swim|lift|pushups|squats|exercise)\b/.test(lower)) kind = 'exercise';
  else if (/\b(wine|whisky|beer|tequila|gin|vodka|rum|alcohol)\b/.test(lower)) kind = 'alcohol';
  else if (/\b(car|vehicle|vin|license plate|mileage|tires|model)\b/.test(lower)) kind = 'car';

  // 2) Map intent → notebook + section
  const INTENT_MAP = {
    food:    { notebookName: 'AliceChatGPT', sectionName: 'Food and Nutrition - Meals', titleSuffix: '— Meals' },
    exercise:{ notebookName: 'AliceChatGPT', sectionName: 'Fitness - Workouts',          titleSuffix: '— Workouts' },
    alcohol: { notebookName: 'AliceChatGPT', sectionName: 'Food and Nutrition - Alcohol Notes', titleSuffix: '— Alcohol Notes' },
    car:     { notebookName: 'AliceChatGPT', sectionName: 'Car Related',                titleSuffix: '' },
    journal: { notebookName: 'AliceChatGPT', sectionName: 'Inbox',                      titleSuffix: '' },
  };

  const dest = INTENT_MAP[kind];

  // 3) Title + HTML
  const now = new Date();
  const hhmm = now.toTimeString().slice(0,5);
  const dateStr = now.toISOString().split('T')[0];

  const title = (kind === 'car')
    ? '🚗 Car — Primary'
    : `🗓 ${dateStr} ${dest.titleSuffix}`.trim();

  const html = (kind === 'car')
    ? `<h3>🚗 Car — Primary</h3><p>${text}</p>`
    : `<p><b>${hhmm}</b> — ${text}</p>`;

  // 4) Forward to your existing writer (/api/graph/create-read-link)
  const payload = {
    notebookName: dest.notebookName,
    sectionName: dest.sectionName,
    title,
    html,
    mode: mode || (kind === 'car' ? 'upsert-entity' : 'append')
  };

  try {
    const r = await fetch(`${process.env.BASE_URL}/api/graph/create-read-link`, {
      method: 'POST',
      headers: {
        'authorization': bearer,
        'content-type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const body = await r.text();
    let json;
    try { json = JSON.parse(body); }
    catch { json = { ok: false, error: 'Bad upstream', raw: body }; }

    res.status(r.status).json(json);
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
}
