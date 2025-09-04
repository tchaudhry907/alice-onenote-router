// /pages/api/redis/index.js
export default function handler(req, res) {
  res.status(200).json({
    ok: true,
    routes: [
      '/api/redis/ping',
      '/api/redis/get?key=foo',
      '/api/redis/set?key=foo&value=bar&ex=60',
      '/api/redis/ttl?key=foo',
      '/api/redis/del?key=foo',
      '/api/redis/expire?key=foo&seconds=120',
      '/api/redis/debug'
    ],
  });
}
