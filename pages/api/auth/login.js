// pages/api/auth/login.js
import { getRedirectUri } from "@/lib/graph";

export default function handler(req, res) {
  const params = new URLSearchParams({
    client_id: process.env.MS_CLIENT_ID,
    response_type: "code",
    redirect_uri: getRedirectUri(),
    response_mode: "query",
    scope: process.env.MS_SCOPES || "offline_access Notes.ReadWrite User.Read",
    prompt: "select_account"
  });
  const tenant = process.env.MS_TENANT || "common";
  const url = `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/authorize?${params}`;
  res.writeHead(302, { Location: url }).end();
}
