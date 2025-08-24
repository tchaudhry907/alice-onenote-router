function kill(name) {
  // kill for all paths (Path=/) and cross‑site safety
  return `${name}=; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=0`;
}

export default async function handler(req, res) {
  res.setHeader("Set-Cookie", [
    kill("state"),
    kill("access_token"),
    kill("refresh_token"),
    kill("session_ok")
  ]);
  res.setHeader("Content-Type", "text/plain");
  res.status(200).send("Cleared state, access_token, refresh_token, session_ok.");
}
