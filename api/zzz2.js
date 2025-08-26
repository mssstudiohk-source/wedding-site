// api/zzz2.js — ultra-safe, 不會 500
function origin(req) {
  const proto = String(req.headers["x-forwarded-proto"] || "https").split(",")[0];
  const host  = String(req.headers["x-forwarded-host"]  || req.headers.host || "").split(",")[0];
  return ${proto}://${host};
}

export default async function handler(req, res) {
  try {
    const base = origin(req);
    const url  = ${base}/rules/traditions.json;
    const info = {
      ok: true,
      ver: "zzz2-v2",
      base,
      url,
      fetchType: typeof fetch // 看看 runtime 有沒有 fetch
    };

    // 無參數：只回基本資料
    if (!req.query || !("test" in req.query)) {
      return res.status(200).json({ ...info, tip: "加 ?test=1 會嘗試讀 /rules/traditions.json" });
    }

    // 只在 test=1 時嘗試抓檔
    if (req.query.test === "1") {
      if (typeof fetch !== "function") {
        return res.status(200).json({ ...info, note: "fetch not available in this runtime" });
      }
      try {
        const r = await fetch(url, { cache: "no-store" });
        const txt = await r.text();
        let kind = "unknown", keys = [];
        try {
          const j = JSON.parse(txt);
          kind = Array.isArray(j) ? "array" : typeof j;
          keys = kind === "object" ? Object.keys(j).slice(0, 5) : [];
        } catch (e) {
          return res.status(200).json({ ...info, status: r.status, okHTTP: r.ok, preview: txt.slice(0,120), parseError: String(e) });
        }
        return res.status(200).json({ ...info, status: r.status, okHTTP: r.ok, kind, keys });
      } catch (e) {
        return res.status(200).json({ ...info, fetchError: String(e) });
      }
    }

    // 其他值：照回 info
    return res.status(200).json(info);
  } catch (e) {
    return res.status(200).json({ ok: false, ver: "zzz2-v2", fatal: String(e) });
  }
}
