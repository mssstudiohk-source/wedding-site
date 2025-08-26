// api/zzz2.js — ultra-safe 靜態檔讀取
function origin(req) {
  const proto = String(req.headers["x-forwarded-proto"] || "https").split(",")[0];
  const host  = String(req.headers["x-forwarded-host"]  || req.headers.host || "").split(",")[0];
  return ${proto}://${host};
}

export default async function handler(req, res) {
  try {
    const base = origin(req);
    const test = req.query.test;

    // 無參數：永遠 200
    if (!test) {
      return res.status(200).json({ ok:true, ver:"zzz2-v1", base, tip:"加 ?test=1 會嘗試讀 /rules/traditions.json" });
    }

    // 帶 test=1：嘗試抓 /rules/traditions.json（不 throw）
    const url = ${base}/rules/traditions.json;
    const r   = await fetch(url, { cache: "no-store" });
    const txt = await r.text();

    let kind = "unknown", keys = [];
    try {
      const j = JSON.parse(txt);
      kind = Array.isArray(j) ? "array" : typeof j;
      keys = kind === "object" ? Object.keys(j).slice(0,5) : [];
    } catch (e) {
      // 解析錯誤都唔 throw，照樣回 JSON
    }

    return res.status(200).json({
      ok: r.ok, status: r.status, url, kind, keys, preview: txt.slice(0,120)
    });
  } catch (e) {
    return res.status(200).json({ ok:false, fatal:String(e) });
  }
}
