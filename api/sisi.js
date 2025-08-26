// api/sisi.js  (v1)
export default function handler(req, res) {
  const q = (req.query.question || "").trim();
  res.status(200).json({ ok: true, v: 1, q });
}
