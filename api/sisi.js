// v2
export default function handler(req, res) {
  const base = process.env.RULES_BASE_URL || null;
  res.status(200).json({ ok: true, v: 2, base_present: !!base });
}
