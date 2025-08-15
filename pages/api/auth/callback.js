// pages/api/auth/callback.js
export default async function handler(req, res) {
  const { code, error, error_description } = req.query || {};
  if (error) {
    res
      .status(400)
      .send(`<pre>OAuth error: ${error}\n${error_description || ""}</pre>`);
    return;
  }
  if (!code) {
    res.status(400).send("<pre>Missing ?code= in callback</pre>");
    return;
  }
  res
    .status(200)
    .send(
      `<pre>Got authorization code.\nWe can now exchange it for tokens (next step).</pre>`
    );
}
