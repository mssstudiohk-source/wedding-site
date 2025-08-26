// api/sisi3.js  — ultra-safe diagnostics (ESM)
// 不依賴環境變數；先檢查路由OK，再嘗試 fetch /rules/traditions.json

function originFrom(req) {
  // 在 Vercel，這兩個 header 會提供正確的協定與 host（反代下）
  const proto = String(req.headers["x-forwarded-proto"] || "https").split(",")[0];
  const host  = String(req.headers["x-forwarded-host"]  || req.headers.host || "").split(",")[0];
  return ${proto}://${host};
}

export default async function handler(req, res) {
  const out = { ok: true, stage: "start" };

  try {
    // A) 路由活著
    out.stage = "route-ok";
    out.method = req.method;
    out.now = Date.now();

    // 如果只是打 /api/sisi3，直接回基本訊息
    if (!req.query || Object.keys(req.query).length === 0) {
      out.tip = "測試抓取：/api/sisi3?test=rules";
      out.example = "/api/sisi3?test=rules";
      return res.status(200).json(out);
    }

    // B) 計算本站 origin
    const base = originFrom(req);
    out.stage = "have-origin";
    out.origin = base;

    // 只在 ?test=rules 時做抓取
    if (req.query.test === "rules") {
      const url = ${base}/rules/traditions.json;
      out.stage = "fetching";
      out.url = url;

      try {
        const r = await fetch(url, { cache: "no-store" });
        const text = await r.text();
        out.stage  = "fetched";
        out.status = r.status;
        out.okHTTP = r.ok;
        out.preview = (text || "").slice(0, 120);

        // 嘗試 parse（出錯都唔會 throw）
        try {
          const j = JSON.parse(text);
          out.stage = "parsed";
          out.kind  = Array.isArray(j) ? "array" : typeof j;
          out.keys  = out.kind === "object" ? Object.keys(j).slice(0, 5) : [];
        } catch (e) {
          out.stage = "parse-failed";
          out.parseError = String(e);
        }
      } catch (e) {
        out.stage = "fetch-failed";
        out.fetchError = String(e);
      }
    }

    return res.status(200).json(out);
  } catch (e) {
    // 永不 500
    return res.status(200).json({ ok: false, stage: out.stage, fatal: String(e) });
  }
}
