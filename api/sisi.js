// api/sisi.js (v4.1)
const BASE = process.env.RULES_BASE_URL || "";
const url = (n) => BASE.replace(/\/$/, "") + "/" + n;

async function safeFetchJSON(name) {
  const out = { name, ok: false, status: 0, kind: null, keys: [], preview: "" };
  try {
    const r = await fetch(url(name), { cache: "no-store" });
    out.status = r.status;
    const text = await r.text();
    out.preview = text.slice(0, 120);
    if (!r.ok) return out;
    const j = JSON.parse(text);
    out.ok = true;
    out.kind = Array.isArray(j) ? "array" : typeof j;
    out.keys = out.kind === "object" ? Object.keys(j).slice(0, 5) : [];
    out.data = j;
    return out;
  } catch (e) {
    out.error = String(e);
    return out;
  }
}

export default async function handler(req, res) {
  try {
    const q = (req.query.question || "").trim();

    if (!BASE) {
      return res.status(200).json({ ok:false, v:"4.1", error:"RULES_BASE_URL missing" });
    }

    // Diagnostics switch
    if (q === "__status") {
      const files = await Promise.all([
        safeFetchJSON("traditions.json"),
        safeFetchJSON("holidays_2025.json"),
        safeFetchJSON("special_days.json"),
        safeFetchJSON("options_catalog.json"),
      ]);
      return res.status(200).json({ ok:true, v:"4.1", base: BASE, files });
    }

    if (!q) {
      return res.status(200).json({ ok:true, v:"4.1", tip:"用 /api/sisi?question=過大禮 測試固定答案" });
    }

    // 1) 固定答案（過大禮/安床/回門）
    const tr = await safeFetchJSON("traditions.json");
    if (!tr.ok) {
      return res.status(200).json({ ok:false, v:"4.1", step:"traditions", detail: tr });
    }
    if (tr.kind !== "object") {
      return res.status(200).json({ ok:false, v:"4.1", step:"traditions-shape", detail: tr.kind });
    }
    for (const key of Object.keys(tr.data)) {
      if (q.includes(key)) {
        const t = tr.data[key] || {};
        const details = Array.isArray(t.details) && t.details.length ? \n- ${t.details.join("\n- ")} : "";
        return res.status(200).json({ ok:true, v:"4.1", answer:重點：${t.summary || ""}${details} });
      }
    }

    // 2) 紅日/特別日（先不開，先把固定答案過關）
    return res.status(200).json({ ok:true, v:"4.1", answer:"呢個版本只測固定答案。試問：過大禮 / 安床 / 回門" });

  } catch (e) {
    // Never 500—always explain
    return res.status(200).json({ ok:false, v:"4.1", fatal:String(e) });
  }
}
