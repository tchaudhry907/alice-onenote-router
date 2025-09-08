import type { NextApiRequest, NextApiResponse } from 'next'
import { getKv, setKv } from '@/lib/kv'
import { refreshTokensIfNeeded, getAccessTokenFromKv } from '@/lib/auth'
import { appendToDailyLog } from '@/lib/onenote'

/**
 * POST /api/chat/log
 * Body: { text: string }
 * Headers: x-chat-relay-secret: <CHAT_RELAY_SECRET>
 *
 * Appends `text` to today's Daily Log page in OneNote.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST')
      return res.status(405).json({ ok: false, error: 'Method not allowed' })
    }

    const secret = req.headers['x-chat-relay-secret']
    if (!secret || secret !== process.env.CHAT_RELAY_SECRET) {
      return res.status(401).json({ ok: false, error: 'Unauthorized' })
    }

    const { text } = (req.body ?? {}) as { text?: string }
    if (!text || typeof text !== 'string' || !text.trim()) {
      return res.status(400).json({ ok: false, error: 'Missing text' })
    }

    // Ensure tokens in KV are fresh
    const refreshed = await refreshTokensIfNeeded()
    const accessToken = await getAccessTokenFromKv()
    if (!accessToken) {
      return res.status(401).json({ ok: false, error: 'No access token available after refresh' })
    }

    // Append
    const { pageId, title } = await appendToDailyLog(accessToken, text.trim())

    return res.status(200).json({
      ok: true,
      pageId,
      title,
      refreshed,
    })
  } catch (err: any) {
    return res.status(500).json({
      ok: false,
      error: err?.message || 'Internal error',
      detail: err?.response?.data ?? err?.detail ?? null,
    })
  }
}
