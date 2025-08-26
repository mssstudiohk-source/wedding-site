// api/zzz.js
export default function handler(req, res) {
  res.status(200).json({ ok: true, version: "zzz-v1", now: Date.now() });
}
