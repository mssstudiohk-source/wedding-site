import traditions from "../rules/traditions.json" assert { type: "json" };
import holidays from "../rules/holidays_2025.json" assert { type: "json" };
import specialDays from "../rules/special_days.json" assert { type: "json" };
import options from "../rules/options_catalog.json" assert { type: "json" };
import flow from "../rules/reply_flow.json" assert { type: "json" };

// 簡易：檢查是否假期/特別日
function findDayFlags(isoDate) {
  const hs = holidays.filter(h => h.date === isoDate);
  const ss = specialDays.filter(s => s.date === isoDate);
  return [...hs, ...ss];
}

export default async function handler(req, res) {
  const q = (req.method === "POST"
    ? await readBody(req).then(b => b?.question || "")
    : (req.query.question || "")).trim();

  // 1) 固定答案：過大禮/安床/回門
  for (const key of Object.keys(traditions)) {
    if (q.includes(key)) {
      const t = traditions[key];
      return res.json({ ok:true, answer: `重點：${t.summary}\n\n詳情：\n- ${t.details.join("\n- ")}` });
    }
  }

  // 2) 查紅日/特別日（格式：2025-09-09 類）
  const dateMatch = q.match(/\d{4}-\d{2}-\d{2}/);
  if (q.includes("紅日") || q.includes("假期") || dateMatch) {
    if (dateMatch) {
      const flags = findDayFlags(dateMatch[0]);
      if (flags.length) {
        return res.json({ ok:true, answer:
          `${dateMatch[0]} 有：` + flags.map(f => `${f.label}（${f.kind}）`).join("、")
        });
      }
      return res.json({ ok:true, answer:`${dateMatch[0]} 非已知公眾假期/特別日。` });
    } else {
      return res.json({ ok:true, answer:
        `2025 已知假期示例：\n` + holidays.slice(0,5).map(h => `${h.date} ${h.label}`).join("\n")
      });
    }
  }

  // 3) options（示例：用家問「有咩婚禮形式」）
  if (q.includes("婚禮形式") || q.includes("有咩選擇")) {
    return res.json({ ok:true, answer: `常見形式：${options.wedding_types.join("、")}` });
  }

  // 4) 都唔中 → 交比 OpenAI（如果你已接好）
  // const answer = await callOpenAI(q);
  // return res.json({ ok:true, answer });

  return res.json({ ok:true, answer: "我可以幫你查傳統、紅日、選項與流程。可以再講清楚你想問邊方面？" });
}

async function readBody(req) {
  const bufs = [];
  for await (const c of req) bufs.push(c);
  try { return JSON.parse(Buffer.concat(bufs).toString("utf-8")); }
  catch { return null; }
}
