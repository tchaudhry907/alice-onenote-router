import { getAccessToken } from '@/lib/msal';
import { getTokenCookie } from '@/lib/cookie';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  try {
    // Body should contain { text: "your log text" }
    const { text } = req.body;
    if (!text) {
      return res.status(400).json({ ok: false, error: 'Missing text' });
    }

    // Get access token from refresh token in Redis
    const token = await getAccessToken();
    if (!token) {
      return res.status(401).json({ ok: false, error: 'Not authenticated' });
    }

    const sectionId = process.env.DEFAULT_SECTION_ID;
    if (!sectionId) {
      return res.status(500).json({ ok: false, error: 'DEFAULT_SECTION_ID not set' });
    }

    // Build OneNote HTML content
    const date = new Date().toISOString();
    const title = `Log — ${date}`;
    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>${title}</title>
        </head>
        <body>
          <p>${text}</p>
        </body>
      </html>
    `;

    // Create page in OneNote
    const response = await fetch(
      `https://graph.microsoft.com/v1.0/me/onenote/sections/${sectionId}/pages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/xhtml+xml'
        },
        body: htmlContent
      }
    );

    if (!response.ok) {
      const error = await response.text();
      return res.status(response.status).json({ ok: false, error });
    }

    const data = await response.json();
    return res.status(201).json({ ok: true, id: data.id, title: data.title, links: data.links });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
}
