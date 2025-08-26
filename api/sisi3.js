export default function handler(req, res) {
  const h = req && req.headers ? req.headers : {};
  const p = String(h["x-forwarded-proto"] || "https").split(",")[0];
  const host = String(h["x-forwarded-host"] || h.host || "").split(",")[0];
  const base = p + "://" + host;
  res.status(200).json({ ok: true, ver: "sisi3-reset", base: base });
}
