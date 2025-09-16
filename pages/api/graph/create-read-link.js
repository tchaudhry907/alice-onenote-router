// pages/api/graph/create-read-link.js
import { graphGET, graphPOST } from '@/lib/auth';

// paste this helper at the top
async function withRefresh(req, res, fn) {
  try {
    return await fn();
  } catch (e) {
    if (e?.message === 'REFRESHED' && e.__tokens) {
      // TODO: set cookies, then retry fn()
      // (I can give you exact cookie-setting code if you want to paste)
      return await fn();
    }
    throw e;
  }
}

export default async function handler(req, res) {
  try {
    const { notebookName, sectionName, title, html } = req.body;

    const result = await withRefresh(req, res, async () => {
      // lookup sectionId from names (via graphGET)
      // then post page HTML (via graphPOST)
    });

    res.status(200).json({ ok: true, result });
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err) });
  }
}
