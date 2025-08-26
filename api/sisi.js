const BASE = process.env.RULES_BASE_URL; // e.g. https://raw.githubusercontent.com/<user>/<repo>/main/rules

const urlOf = (name) => BASE.replace(/\/$/, "") + "/" + name;

// 安全載入：任何錯誤都只回 null，不會 throw
async function tryLoad(name) {
  try {
    const r = await fetch(urlOf(name), { cache: "no-store" });
    const t = await r.text();
    if (!r.ok) return { ok:false, name, status:r.status, preview:t.slice(0,120), data:null };
    const data = JSON.parse(t);
    return { ok:true, name, status:r.status, preview:t.slice(0,60), data };
  } catch (e) {
    return { ok:false, name, status:0, preview:String(e).slice(0,120), data:null };
  }
}

function isoIn(text) {
  const m = (text || "").match(/\d{4}-\d{2}-\d{2}/);
  return m ? m[0] : null;
}

export default async function handler(req, res) {
  if (!BASE) return res.status(500).json({ ok:false, error:"RULES_BASE_URL missing" });

  const body = await readBody(req);
  const q = (req.method === "POST" ? body?.question : req.query.question || "").trim();
  if (!q) return res.status(400).json({ ok:false, error:"請加 question，例如 /api/sisi?question=過大禮" });

  // 診斷模式：/api/sisi?question=__status
  if (q === "__status") {
    const [a,b,c,d] = await Promise.all([
      tryLoad("traditions.json"),
      tryLoad("holidays_2025.json"),
      tryLoad("special_days.json"),
      tryLoad("options_catalog.json")
    ]);
    return res.status(200).json({ ok:true, base:BASE, files:[a,b,c,d] });
  }

  // 1) 先載「固定答案」，命中就即回
  const tr = await tryLoad("traditions.json");
  if (tr.ok && tr.data && typeof tr.data === "object") {
    for (const key of Object.keys(tr.data)) {
      if (q.includes(key)) {
        const t = tr.data[key] || {};
        const details = Array.isArray(t.details) && t.details.length ? \n\n- ${t.details.join("\n- ")} : "";
        return res.status(200).json({ ok:true, answer:重點：${t.summary || ""}${details}${t.notes ? `\n\n備註：${t.notes} : ""}` });
      }
    }
  }

  // 2) 如果問日期/紅日先載入節日
  const date = isoIn(q);
  if (q.includes("紅日") || q.includes("假期") || date) {
    const [h, s] = await Promise.all([tryLoad("holidays_2025.json"), tryLoad("special_days.json")]);
    if (date) {
      const list = [
        ...(Array.isArray(h.data) ? h.data.filter(x => x.date === date) : []),
        ...(Array.isArray(s.data) ? s.data.filter(x => x.date === date) : [])
      ];
      const ans = list.length
        ? ${date}： + list.map(f => ${f.label}（${f.kind}）).join("、")
        : ${date} 非已知公眾假期/特別日。;
      return res.status(200).json({ ok:true, answer:ans, meta:{ hStatus:h.status, sStatus:s.status } });
    } else {
      const sample = Array.isArray(h.data) ? h.data.slice(0,6).map(x => ${x.date} ${x.label}).join("\n") : "（未載入）";
      return res.status(200).json({ ok:true, answer:2025 部分公眾假期：\n${sample} });
    }
  }

  // 3) 問選項先載入 options
  if (q.includes("婚禮形式") || q.includes("有咩選擇")) {
    const op = await tryLoad("options_catalog.json");
    const list = op.data?.wedding_types || [];
    return res.status(200).json({ ok:true, answer:常見形式：${list.join("、")} });
  }

  // 4) 兜底（未接 OpenAI 前）
  return res.status(200).json({ ok:true, answer:"我可以幫你查傳統、紅日、以及提供常見選項。可以講下你想問邊一部分？" });
}

async function readBody(req) {
  if (req.method !== "POST") return null;
  const bufs = []; for await (const c of req) bufs.push(c);
  try { return JSON.parse(Buffer.concat(bufs).toString("utf8")); } catch { return null; }
}
