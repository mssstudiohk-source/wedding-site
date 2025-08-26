export default function handler(req, res) {
  try {
    const h = req && req.headers ? req.headers : {};
    const protoRaw = (h["x-forwarded-proto"] || "https") + "";
    const hostRaw  = (h["x-forwarded-host"]  || h.host || "") + "";

    const proto = protoRaw.split(",")[0];
    const host  = hostRaw.split(",")[0];

    const base = (proto ? proto : "https") + "://" + host;
    const url  = base + "/rules/traditions.json";

    res.status(200).json({ ok: true, ver: "b-v2", proto, host, base, url });
  } catch (e) {
    res.status(200).json({ ok: false, ver: "b-v2", error: String(e) });
  }
}
