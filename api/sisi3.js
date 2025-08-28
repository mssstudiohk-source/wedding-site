// api/sisi3.js — smoke test，確保 endpoint 可載入
export default function handler(req, res) {
  res.status(200).json({
    ok: true,
    route: "/api/sisi3",
    node: process.version,
    ts: Date.now()
  });
}
