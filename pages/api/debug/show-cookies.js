// pages/api/debug/show-cookies.js

export default function handler(req, res) {
  try {
    // Show cookies object directly
    res.status(200).json({
      cookies: req.cookies || {},
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
