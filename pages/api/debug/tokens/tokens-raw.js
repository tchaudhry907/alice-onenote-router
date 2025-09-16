import { getSession } from "next-auth/react";

export default async function handler(req, res) {
  // security check
  if (req.headers["x-admin-key"] !== process.env.ADMIN_KEY) {
    return res.status(401).json({ error: "unauthorized" });
  }

  const session = await getSession({ req });
  if (!session?.tokens) {
    return res.status(400).json({ error: "no tokens in session" });
  }

  res.json(session.tokens);
}
