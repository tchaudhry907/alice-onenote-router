// lib/auth.js
// Authentication helpers for Microsoft identity + Graph API

import { refreshAccessToken } from './graph';

// Minimal cookie reader (no external dependency)
function getCookie(req, name) {
  const cookieHeader = req.headers?.cookie || '';
  const cookies = Object.fromEntries(
    cookieHeader.split(';').map(c => {
      const [k, ...v] = c.trim().split('=');
      return [k, decodeURIComponent(v.join('='))];
    })
  );
  return cookies[name] || null;
}

// Extract access token from cookies/session
export async function getAccessToken(req, res) {
  try {
    const token = getCookie(req, 'access_token');
    if (token) return token;

    // Try refresh if no cookie
    const refresh = getCookie(req, 'refresh_token');
    if (refresh) {
      const newToken = await refreshAccessToken(refresh);
      return newToken;
    }

    return null;
  } catch (err) {
    console.error('getAccessToken error:', err);
    return null;
  }
}

// Middleware to enforce authentication in API routes
export async function requireAuth(req, res, next) {
  const token = await getAccessToken(req, res);
  if (!token) {
    res.status(401).json({ ok: false, error: 'Not authenticated' });
    return;
  }
  req.accessToken = token;
  if (typeof next === 'function') {
    return next(req, res);
  }
  return token;
}
