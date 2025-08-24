const tokenResponse = await fetch(
  `https://login.microsoftonline.com/${process.env.MS_TENANT}/oauth2/v2.0/token`,
  {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.MS_CLIENT_ID,
      client_secret: process.env.MS_CLIENT_SECRET,   // 👈 add this line
      code,
      redirect_uri: process.env.REDIRECT_URI,
      grant_type: "authorization_code",
      code_verifier: storedVerifier, // from your cookie/session
    }),
  }
);
