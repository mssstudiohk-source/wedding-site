// api/b.js — Step 3: 安全 fetch /rules/traditions.json（不會 500）
export default async function handler(req, res) {
  try {
    const h = req && req.headers ? req.headers : {};
    const proto = String(h["x-forwarded-proto"] || "https").split(",")[0];
    const host  = String(h["x-forwarded-host"]  || h.host || "").split(",")[0];
    const base  = (proto ? proto : "https") + "://" + host;
    const url   = base + "/rules/traditions.json";

    // 無參數：只回基本資料（永遠 200）
    if (!req.query || !("test" in req.query)) {
      return res.status(200).json({
        ok: true, ver: "b-v3",
        base, url,
        tip: "加 ?test=1 會嘗試抓 /rules/traditions.json"
      });
    }

    // 檢查 runtime 是否有 fetch
    if (typeof fetch !== "function") {
      return res.status(200).json({
        ok: false, ver: "b-v3", base, url,
        note: "fetch not available in this runtime"
      });
    }

    // 嘗試抓檔（任何錯都不 throw）
    let status = 0, okHTTP = false, txt = "";
    try {
      const r = await fetch(url, { cache: "no-store" });
      status = r.status; okHTTP = r.ok;
      txt = await r.text();
    } catch (e) {
      return res.status(200).json({
        ok: false, ver: "b-v3", base, url,
        fetchError: String(e)
      });
    }

    // 嘗試 JSON.parse（錯誤就回 preview）
    try {
      const j = JSON.parse(txt);
      const kind = Array.isArray(j) ? "array" : typeof j;
      const keys = kind === "object" ? Object.keys(j).slice(0, 5) : [];
      return res.status(200).json({
        ok: okHTTP, ver: "b-v3", base, url, status, kind, keys
      });
    } catch (e) {
      return res.status(200).json({
        ok: okHTTP, ver: "b-v3", base, url, status,
        parseError: String(e), preview: (txt || "").slice(0, 160)
      });
    }
  } catch (e) {
    return res.status(200).json({ ok: false, ver: "b-v3", fatal: String(e) });
  }
}
