export default async function handler(req, res) {
  res.status(200).json({
    ok: true,
    routes: [
      "/api/redis/ping",
      "/api/redis/get?key=someKey",
      "/api/redis/set?key=someKey&value=someValue",
      "/api/redis/set?key=expiringKey&value=hello&ttl=60"
    ]
  });
}
