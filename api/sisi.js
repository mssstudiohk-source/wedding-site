const BASE = process.env.RULES_BASE_URL; // 例如 https://raw.githubusercontent.com/.../rules

async function getJSON(name) {
  const url = BASE.replace(/\/$/, "") + "/" + name;
  const r = await fetch(url, { cache: "no-store" });
  if (!r.ok) throw new Error(Load failed: ${name} (${r.status}));
  return await r.json();
}

function isoIn(text) {
  const m = (text || "").match(/\d{4}-\d{2}-\d{2}/);
  return m ? m[0] : null;
}

export default async function handler(req, res) {
  try {
    // 1) 收問題
    const body = await readBody(req);
    const q = (req.method === "POST" ? body?.question : req.query.question || "").trim();
    if (!q) return res.status(400).json({ ok: false, error: "Missing question" });

    // 2) 讀規則（只讀一次，並行）
    const [traditions, holidays, specials, options] = await Promise.all([
      getJSON("traditions.json"),
      getJSON("holidays_2025.json"),
      getJSON("special_days.json"),
      getJSON("options_catalog.json")
    ]);

    // 3) 固定答案（過大禮 / 安床 / 回門）
    for (const key of Object.keys(traditions)) {
      if (q.includes(key)) {
        const t = traditions[key];
        const details = Array.isArray(t.details) && t.details.length ? \n\n- ${t.details.join("\n- ")} : "";
        const notes = t.notes ? \n\n備註：${t.notes} : "";
        return res.status(200).json({ ok: true, answer: 重點：${t.summary}${details}${notes} });
      }
    }

    // 4) 紅日 / 特別日（可輸入 2025-09-09）
    const date = isoIn(q);
    if (q.includes("紅日") || q.includes("假期") || date) {
      if (date) {
        const flags = [
          ...holidays.filter(h => h.date === date),
          ...specials.filter(s => s.date === date)
        ];
        const ans = flags.length
          ? ${date}： + flags.map(f => ${f.label}（${f.kind}）).join("、")
          : ${date} 非已知公眾假期/特別日。;
        return res.status(200).json({ ok: true, answer: ans });
      }
      // 沒指定日期 → 給數個示例
      return res.status(200).json({
        ok: true,
        answer: "2025 部分公眾假期：\n" + holidays.slice(0, 6).map(h => ${h.date} ${h.label}).join("\n")
      });
    }

    // 5) 常見選項
    if (q.includes("婚禮形式") || q.includes("有咩選擇")) {
      return res.status(200).json({ ok: true, answer: 常見形式：${options.wedding_types.join("、")} });
    }

    // 6) 其餘（如果你已接 OpenAI，可在此呼叫）
    // const ai = await callOpenAI(q);
    // return res.status(200).json({ ok: true, answer: ai });

    return res.status(200).json({
      ok: true,
      answer: "我可以幫你查傳統、紅日、以及提供常見選項。可以講下你想問邊一部分？"
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
