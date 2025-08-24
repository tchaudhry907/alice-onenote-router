export default function handler(req, res) {
  const { access_token, refresh_token, id_token } = req.cookies;
  res.status(200).json({
    access_token: access_token ? access_token.slice(0, 20) + "..." : null,
    refresh_token: refresh_token ? refresh_token.slice(0, 20) + "..." : null,
    id_token: id_token ? id_token.slice(0, 20) + "..." : null,
  });
}
