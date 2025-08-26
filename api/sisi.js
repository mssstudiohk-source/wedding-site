// v4
const BASE = process.env.RULES_BASE_URL || "";
const url = (n) => BASE.replace(/\/$/, "") + "/" + n;

async function load(name) {
  const r = await fetch(url(name), { cache: "no-store" });
  const t = await r.text();
  if (!r.ok) return null;
  try { return JSON.parse(t); } catch { return null; }
}

export default async function handler(req, res) {
  const q = (req.query.question || "").trim();
  if (!q) return res.status(200).json({ ok: true, tip: "用 /api/sisi?question=過大禮 測試" });

  const traditions = await load("traditions.json");

  if (traditions && typeof traditions === "object") {
    for (const key of Object.keys(traditions)) {
      if (q.includes(key)) {
        const t = traditions[key] || {};
        const details = Array.isArray(t.details) && t.details.length ? \n- ${t.details.join("\n- ")} : "";
        return res.status(200).json({ ok: true, answer: 重點：${t.summary || ""}${details} });
      }
    }
  }

  return res.status(200).json({ ok: true, answer: "呢個版本只測固定答案。試問：過大禮 / 安床 / 回門" });
}
