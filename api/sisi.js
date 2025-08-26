// v3
const BASE = process.env.RULES_BASE_URL || "";
const url = (n) => BASE.replace(/\/$/, "") + "/" + n;

export default async function handler(req, res) {
  try {
    const r = await fetch(url("traditions.json"), { cache: "no-store" });
    const txt = await r.text();
    return res.status(200).json({
      ok: r.ok, v: 3, status: r.status,
      preview: txt.slice(0, 80) // 應該以 { 或 [ 開頭
    });
  } catch (e) {
    return res.status(200).json({ ok: false, v: 3, error: String(e).slice(0,120) });
  }
}
