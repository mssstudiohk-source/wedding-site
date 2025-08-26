// api/zzz2.js  — step2-diagnose, 不 fetch、不做複雜字串
export default function handler(req, res) {
  const out = { ok: true, ver: "zzz2-s2", now: Date.now() };
  try {
    const h = req?.headers ?? {};
    const proto = String(h["x-forwarded-proto"] || "https").split(",")[0];
    const host  = String(h["x-forwarded-host"]  || h.host || "").split(",")[0];
    out.proto = proto;
    out.host  = host;
    out.base  = ${proto}://${host};
  } catch (e) {
    out.error = String(e);
  }
  res.status(200).json(out);
}
