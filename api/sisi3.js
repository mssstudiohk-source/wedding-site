// api/sisi3.js  — 讀取 /rules 下的 JSON（不依賴 env / GitHub / Supabase）
function hostBase(req) {
  // 以部署域名為 base，例如 https://wedding-sisi-api.vercel.app
  const proto = (req.headers["x-forwarded-proto"] || "https").split(",")[0];
  const host  = (req.headers["x-forwarded-host"]  || req.headers.host || "").split(",")[0];
  return ${proto}://${host};
}

async function loadJSON(url) {
  try {
    const r = await fetch(url, { cache: "no-store" });
    const t = await r.text();
    if (!r.ok) return { ok:false, status:r.status, preview:t.slice(0,120), data:null };
    try {
      return { ok:true, status:r.status, data: JSON.parse(t) };
    } catch (e) {
      return { ok:false, status:r.status, preview:t.slice(0,120), parseError:String(e), data:null };
    }
  } catch (e) {
    return { ok:false, status:0, preview:String(e), data:null };
  }
}

function findISO(s) {
  const m = (s||"").match(/\d{4}-\d{2}-\d{2}/);
  return m ? m[0] : null;
}

export default async function handler(req, res) {
  try {
    const q = (req.method === "POST"
      ? await (async () => { try {
          const chunks=[]; for await (const c of req) chunks.push(c);
          return JSON.parse(Buffer.concat(chunks).toString("utf8")||"{}");
        } catch { return {}; } })().then(b => b?.question || "")
      : (req.query.question || "")
    ).trim();

    const base = hostBase(req);                  // e.g. https://wedding-sisi-api.vercel.app
    const urlOf = (name) => ${base}/rules/${name};

    if (!q) {
      return res.status(200).json({
        ok:true,
        tip:"試：/api/sisi3?question=過大禮 | 2025-09-09 | 有咩婚禮形式",
        files:{ traditions:urlOf("traditions.json"),
                holidays:urlOf("holidays_2025.json"),
                specials:urlOf("special_days.json"),
                options:urlOf("options_catalog.json") }
      });
    }

    // 固定答案：先載 traditions
    const tr = await loadJSON(urlOf("traditions.json"));
    if (tr.ok && tr.data && typeof tr.data === "object") {
      for (const key of Object.keys(tr.data))
