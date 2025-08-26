// api/zzz2.js
export default function handler(req, res) {
  const proto = String(req.headers["x-forwarded-proto"] || "https").split(",")[0];
  const host  = String(req.headers["x-forwarded-host"]  || req.headers.host || "").split(",")[0];
  const base  = ${proto}://${host};
  const url   = ${base}/rules/traditions.json;
  res.status(200).json({ ok: true, ver: "zzz2-v1", base, url, fetchType: typeof fetch });
}
