import traditions from "../rules/traditions.json" assert { type: "json" };
import holidays from "../rules/holidays_2025.json" assert { type: "json" };
import specialDays from "../rules/special_days.json" assert { type: "json" };

export default async function handler(req, res) {
  const q = (req.method === "POST"
    ? await readBody(req).then(b => b?.question || "")
    : (req.query.question || "")).trim();

  // ...（你的邏輯）
}

async function readBody(req) {
  const bufs = []; for await (const c of req) bufs.push(c);
  try { return JSON.parse(Buffer.concat(bufs).toString("utf-8")); }
  catch { return null; }
}
