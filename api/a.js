export default function handler(req, res) {
  const h = req.headers || {};
  const proto = String(h["x-forwarded-proto"] || "https").split(",")[0];
  const host  = String(h["x-forwarded-host"] || h.host || "").split(",")[0];
  const base  = ${proto}://${host};
  const url   = $[base]/rules/traditions.json;
  res.status(200).json({ ok: true, base, url, ver: "b-v1"});
}
