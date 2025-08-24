export default function handler(req, res) {
  const must = ['APP_BASE_URL','REDIRECT_URI','MS_CLIENT_ID','MS_TENANT','ENCRYPTION_SECRET'];
  const env = Object.fromEntries(
    must.map(k => [k, Boolean(process.env[k])])
  );
  env.MS_CLIENT_SECRET = Boolean(process.env.MS_CLIENT_SECRET);
  env.baseUrl = process.env.APP_BASE_URL || null;
  env.redirectUri = process.env.REDIRECT_URI || null;
  res.status(200).json({ ok: must.every(k => !!process.env[k]), env });
}
