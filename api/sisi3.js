// api/sisi3.js — Version A: 本地假數據，不做任何 fetch

export default async function handler(req, res) {
  const q = String(req.query.question || "").trim();
  const wantText =
    (req.query.format || "").toLowerCase() === "text" ||
    (req.headers.accept || "").includes("text/plain");

  function out(payload) {
    if (wantText) {
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      return res.status(200).send(String(payload.answer || ""));
    }
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    return res.status(200).json(payload);
  }

  try {
    // 假 flows（只支援 過大禮 / 化妝師 / 紅日）
    const flows = [
      { id: "tradition",  keywords: ["過大禮"], template: "tradition_zh" },
      { id: "makeup",     keywords: ["化妝師","MUA"], template: "vendor_card_zh" },
      { id: "holiday",    keywords: ["紅日","公眾假期"], template: "holiday_zh" }
    ];

    if (!q) {
      return out({ ok: true, answer: "示例：過大禮 / 搵化妝師 / 紅日（加 &format=text 分行）" });
    }

    const hit = flows.find(f => f.keywords.some(kw => q.includes(kw)));
    if (!hit) {
      return out({ ok: true, answer: "暫時只支援：過大禮 / 化妝師 / 紅日" });
    }

    if (hit.template === "tradition_zh") {
      // 本地假資料
      const item = {
        summary: "準備禮餅、雙喜酒、海味、四點金等交家禮。",
        details: ["禮餅/嫁女餅", "雙喜酒", "海味/果籃", "四點金/五金"],
        notes: "按兩家習俗微調。"
      };
      const details = item.details.map((s,i)=> ${i+1}. ${s}).join("\n");
      const ans = 重點：${item.summary}\n細節：\n${details}\n備註：${item.notes};
      return out({ ok: true, flow: hit.id, answer: ans });
    }

    if (hit.template === "vendor_card_zh") {
      // 本地假資料（兩個 vendor）
      const items = [
        { name_zh: "Amy Makeup", description: "自然清透底妝", services: ["新娘化妝","試妝"], price_range_hkd: "1500–5000", location: "Kowloon" },
        { name_zh: "Belle Artistry", description: "韓系霧面", services: ["新娘化妝"], price_range_hkd: "1800–4200", location: "HK Island" }
      ];
      const lines = items.map((v,idx)=>{
        const sv = v.services && v.services.length
          ? "\n服務：\n" + v.services.map((s,i)=>`  ${i+1}. ${s}`).join("\n") : "";
        return ${idx+1}. ${v.name_zh}\n風格：${v.description}${sv}\n價錢：${v.price_range_hkd}\n地區：${v.location};
      });
      return out({ ok: true, flow: hit.id, answer: lines.join("\n\n") });
    }

    if (hit.template === "holiday_zh") {
      const rows = ["1. 2025-01-01 — 元旦", "2. 2025-02-01 — 假日A", "3. 2025-03-01 — 假日B"];
      return out({ ok: true, flow: hit.id, answer: rows.join("\n") });
    }

    return out({ ok: true, answer: "模板未支援。" });
  } catch (e) {
    return res.status(200).json({ ok: false, fatal: String(e?.stack || e) });
  }
}
