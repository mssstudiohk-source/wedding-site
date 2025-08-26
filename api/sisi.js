const BASE = process.env.RULES_BASE_URL; // e.g. https://raw.githubusercontent.com/.../rules

async function getJSON(name) {
  const url = BASE.replace(/\/$/, "") + "/" + name;
  const r = await fetch(url, { cache: "no-store" });
  const text = await r.text();         // 先用 text，方便出錯時顯示
  if (!r.ok) {
    throw new Error(Fetch ${name} failed: ${r.status} ${text.slice(0,120)});
  }
  try {
    return JSON.parse(text);
  } catch (e) {
    throw new Error(Parse ${name} failed: ${e.message}. Preview: ${text.slice(0,120)});
  }
}

function isoIn(text) {
  const m = (text || "").match(/\d{4}-\d{2}-\d{2}/);
  return m ? m[0] : null;
}

export default async function handler(req, res) {
  try {
    if (!BASE) return res.status(500).json({ ok:false, error:"RULES_BASE_URL missing" });

    // 1) 取用戶問題
    const body = await readBody(req);
    const q = (req.method === "POST" ? body?.question : req.query.question || "").trim();
    if (!q) return res.status(400).json({ ok:false, error:"請加 question 參數，例如 /api/sisi?question=過大禮" });

    // 2) 載入四個規則檔（並行）
    const [traditions, holidays, specials, options] = await Promise.all([
      getJSON("traditions.json"),
      getJSON("holidays_2025.json"),
      getJSON("special_days.json"),
      getJSON("options_catalog.json")
    ]);

    // 3) 固定答案：過大禮 / 安床 / 回門
    if (traditions && typeof traditions === "object") {
      for (const key of Object.keys(traditions)) {
        if (q.includes(key)) {
          const t = traditions[key] || {};
          const details = Array.isArray(t.details) && t.details.length
            ? \n\n- ${t.details.join("\n- ")}
            : "";
          const notes = t.notes ? \n\n備註：${t.notes} : "";
          return res.status(200).json({ ok:true, answer:重點：${t.summary || ""}${details}${notes} });
        }
      }
    }

    // 4) 紅日 / 特別日
    const date = isoIn(q);
    if (q.includes("紅日") || q.includes("假期") || date) {
      if (date) {
        const flags = [
          ...(Array.isArray(holidays) ? holidays.filter(h => h.date === date) : []),
          ...(Array.isArray(specials) ? specials.filter(s => s.date === date) : [])
        ];
        const ans = flags.length
          ? ${date}： + flags.map(f => ${f.label}（${f.kind}）).join("、")
          : ${date} 非已知公眾假期/特別日。;
        return res.status(200).json({ ok:true, answer: ans });
      }
      return res.status(200).json({
        ok:true,
        answer: "2025 部分公眾假期：\n" +
          (Array.isArray(holidays) ? holidays.slice(0,6).map(h => ${h.date} ${h.label}).join("\n") : "（尚未載入）")
      });
    }

    // 5) 常見選項
    if (q.includes("婚禮形式") || q.includes("有咩選擇")) {
      const list = options?.wedding_types || [];
      return res.status(200).json({ ok:true, answer:常見形式：${list.join("、")} });
    }

    // 6) 默認回覆（未接 OpenAI 前）
    return res.status(200).json({
      ok:true,
      answer:"我可以幫你查傳統、紅日、以及提供常見選項。可以講下你想問邊一部分？"
    });

  } catch (e) {
    // << 這裡會把真正錯誤字串回給你，方便定位 >>
    return res.status(500).json({ ok:false, error:String(e) });
  }
}

async function readBody(req) {
  if (req.method !== "POST") return null;
  const chunks = [];
  for await (const c of req) chunks.push(c);
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8")); }
  catch { return null; }
}
