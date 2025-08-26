// api/zzz2.js
export default function handler(req, res) {
  res.status(200).json({ ok: true, ver: "zzz2-zero", fetchType: typeof fetch });
}
