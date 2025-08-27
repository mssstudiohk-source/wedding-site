// /api/sisi3.js
export default async function handler(req, res) {
  try {
    const q = (req.query.question || "").trim();
    const debug = req.query.debug;
    const BASE = process.env.RULES_BASE_URL;
    if (!BASE) return res.status(500).json({ ok:false, error:"RULES_BASE_URL is required" });

    const loadJSON = async rel => {
      const url = `${BASE}/${rel}`;
      try {
        const r = await fetch(url, { cache: "no-store" });
        if (!r.ok) return { ok:false, url, status:r.status };
        return { ok:true, url, data: await r.json() };
      } catch (e) { return { ok:false, url, error:String(e) }; }
    };

    // 讀 flows
    const flowsRes = await loadJSON("reply_flow.json");
    if (!flowsRes.ok) return res.status(200).json({ ok:false, where:"reply_flow", ...flowsRes });
    const flows = flowsRes.data?.flows || [];

    // Debug：確認讀到
    if (debug) return res.status(200).json({ ok:true, flows_url: flowsRes.url, flows_count: flows.length });

    // 找到第一個匹配的 flow（關鍵字包含就算）
    const flow = flows.find(f => (f.keywords||[]).some(k => q.includes(k)));
    if (!flow) {
      return res.status(200).json({
        ok:true,
        answer:"暫時支援：過大禮 / 安床 / 上頭 / 回門；化妝師；2025紅日。你可以試問：「過大禮要準備啲乜？」"
      });
    }

    // 抓 source JSON
    const srcRes = await loadJSON(flow.source);
    if (!srcRes.ok) return res.status(200).json({ ok:false, where:"source", ...srcRes });

    // ——— 格式化（重點：用 template 決定用邊個 formatter）———
    const tpl = flow.template || "plain";

    const formatters = {
// 1) 傳統禮儀 (過大禮 / 安床 / 回門)
const tradition_zh = (t) => {
  let lines = [];
  if (t.summary_zh) lines.push(`📌 重點：${t.summary_zh}`);
  if (Array.isArray(t.details_zh) && t.details_zh.length) {
    lines.push("📋 細節：");
    lines = lines.concat(t.details_zh.map((d, i) => `${i+1}. ${d}`));
  }
  if (t.notes_zh) lines.push(`📝 備註：${t.notes_zh}`);
  return lines.join("\n");
};

// 2) 化妝師 Vendor Card 中文
const vendor_card_zh = (data) => {
  return data.map(v => {
    return [
      `💄 **${v.name_zh || v.name_en || ""}**`,
      v.description ? `✨ 風格：${v.description}` : "",
      v.services?.length ? `📋 服務：${v.services.map((s,i)=>`${i+1}. ${s}`).join("\n")}` : "",
      v.price_range_hkd ? `💰 價錢範圍：${v.price_range_hkd}` : "",
      v.location ? `📍 地區：${v.location}` : "",
      v.contact?.ig ? `📸 IG: ${v.contact.ig}` : "",
      v.contact?.website ? `🔗 網站: ${v.contact.website}` : "",
      v.notes_zh ? `📝 備註：${v.notes_zh}` : ""
    ].filter(Boolean).join("\n");
  }).join("\n\n");  // 每個 vendor 之間空一行
};
    // 3) 2025 紅日：列出最近三個
      holiday_zh: () => {
        const list = Array.isArray(srcRes.data) ? srcRes.data : [];
        if (!list.length) return "未有假期資料。";
        const today = new Date().toISOString().slice(0,10);
        const upcomings = list.filter(d => (d.date||"") >= today).slice(0,3);
        if (!upcomings.length) return "2025 年內沒有之後的紅日。";
        return upcomings.map(d => `${d.date}（${d.name_zh || d.name || ""}）`).join("\n");
      },

      // 預設：直接 JSON
      plain: () => JSON.stringify(srcRes.data).slice(0, 800)
    };

    const formatter = formatters[tpl] || formatters.plain;
    const answer = formatter();

    return res.status(200).json({
      ok: true,
      flow: flow.id,
      template: tpl,
      source: srcRes.url,
      answer
    });

  } catch (e) {
    return res.status(500).json({ ok:false, error: e?.message || String(e) });
  }
}
