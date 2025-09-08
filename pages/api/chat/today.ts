import type { NextApiRequest, NextApiResponse } from 'next'
import { refreshTokensIfNeeded, getAccessTokenFromKv } from '@/lib/auth'
import { getTodaysPageId, getPlainTextForPage } from '@/lib/onenote'

/**
 * GET /api/chat/today
 * Headers: x-chat-relay-secret: <CHAT_RELAY_SECRET>
 *
 * Returns today's page text.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method !== 'GET') {
      res.setHeader('Allow', 'GET')
      return res.status(405).json({ ok: false, error: 'Method not allowed' })
    }

    const secret = req.headers['x-chat-relay-secret']
    if (!secret || secret !== process.env.CHAT_RELAY_SECRET) {
      return res.status(401).json({ ok: false, error: 'Unauthorized' })
    }

    await refreshTokensIfNeeded()
    const accessToken = await getAccessTokenFromKv()
    if (!accessToken) {
      return res.status(401).json({ ok: false, error: 'No access token available after refresh' })
    }

    const pageId = await getTodaysPageId(accessToken)
    if (!pageId) return res.status(404).json({ ok: false, error: 'No page for today yet' })

    const { text, length } = await getPlainTextForPage(accessToken, pageId)
    return res.status(200).json({ ok: true, pageId, length, text })
  } catch (err: any) {
    return res.status(500).json({
      ok: false,
      error: err?.message || 'Internal error',
      detail: err?.response?.data ?? err?.detail ?? null,
    })
  }
}
