// No imports needed; fetch JSON at runtime from GitHub RAW
const base = process.env.RULES_BASE_URL;

async function getJSON(name) {
  const url = `${base}/${name}`;
  const r = await fetch(url, { cache: "no-store" });
  if (!r.ok) throw new Error(`Load failed: ${name}`);
  return await r.json();
}

function findIsoDate(text) {
  const m = (text || "").match(/\d{4}-\d{2}-\d{2}/);
  return m ? m[0] : null;
}

export default async function handler(req, res) {
  try {
    const body = await readBody(req);
    const q = (req.method === "POST" ? body?.question : req.query.question || "").trim();

    if (!q) return res.status(400).json({ ok: false, error: "Missing question" });

    // Load only what we need
    const [traditions, holidays, specials, options] = await Promise.all([
      getJSON("traditions.json"),
      getJSON("holidays_2025.json"),
      getJSON("special_days.json"),
      getJSON("options_catalog.json")
    ]);

    // 1) 固定答案：過大禮 / 安床 / 回門
    for (const key of Object.keys(traditions)) {
      if (q.includes(key)) {
        const t = traditions[key];
        const details = Array.isArray(t.details) && t.details.length ? `\n\n- ${t.details.join("\n- ")}` : "";
        return res.status(200).json({ ok: true, answer: `重點：${t.summary}${details}` });
      }
    }

    // 2) 紅日 / 特別日
    const iso = findIsoDate(q);
    if (q.includes("紅日") || q.includes("假期") || iso) {
      const flags = [
        ...holidays.filter(h => h.date === iso),
        ...specials.filter(s => s.date === iso)
      ];
      if (iso) {
        return res.status(200).json({
          ok: true,
          answer: flags.length
            ? `${iso}：` + flags.map(f => `${f.label}（${f.kind}）`).join("、")
            : `${iso} 非已知公眾假期/特別日。`
        });
      }
      return res.status(200).json({
        ok: true,
        answer: "2025 部分公眾假期：\n" + holidays.slice(0, 6).map(h => `${h.date} ${h.label}`).join("\n")
      });
    }

    // 3) 選項示例
    if (q.includes("婚禮形式") || q.includes("有咩選擇")) {
      return res.status(200).json({ ok: true, answer: `常見形式：${options.wedding_types.join("、")}` });
    }

    // 4) 默認回覆（你可接 OpenAI）
    return res.status(200).json({
      ok: true,
      answer: "我可以幫你查傳統、紅日、選項與流程。可以再講清楚你想問邊方面？"
    });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message });
  }
}

async function readBody(req) {
  if (req.method !== "POST") return null;
  const chunks = [];
  for await (const c of req) chunks.push(c);
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8")); }
  catch { return null; }
}
