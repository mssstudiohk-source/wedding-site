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
      // 1) 傳統禮節：從 object 取中英欄位
      tradition_zh: () => {
        const keys = ["過大禮","安床","上頭","回門"];
        const hit = keys.find(k => q.includes(k));
        const rec = srcRes.data?.[hit];
        if (!rec) return `未搵到「${hit}」資料。`;

        const pick = (obj, k) => obj?.[k + "_zh"] ?? obj?.[k] ?? "";
        const pickList = (obj, k) => Array.isArray(obj?.[k + "_zh"]) ? obj[k + "_zh"] : (Array.isArray(obj?.[k]) ? obj[k] : []);

        const summary = pick(rec, "summary");
        const details = pickList(rec, "details");
        const notes   = pick(rec, "notes");

        const out = [];
        if (summary) out.push(`重點：${summary}`);
        if (details.length) out.push("細節：\n- " + details.join("\n- "));
        if (notes) out.push(`備註：${notes}`);
        return out.join("\n");
      },

// 2) 化妝師（或其他 Vendor）卡片輸出
if (flow.template === "vendor_card_zh") {
  try {
    // 支援兩種格式：[{...}] 或 { items:[...] }
    const list = Array.isArray(data) ? data
               : (data && Array.isArray(data.items)) ? data.items
               : [];

    if (!Array.isArray(list)) throw new Error("vendor data is not an array");

    const lines = list.map((v) => {
      const name = (v.name_zh || v.name_en || "").trim();
      const parts = [];
      if (v.description) parts.push(`📌 ${v.description}`);
      if (Array.isArray(v.services) && v.services.length) parts.push(`✨ 服務：${v.services.join("、")}`);
      if (v.price_range_hkd) parts.push(`💰 價錢範圍：${v.price_range_hkd}`);
      if (v.location) parts.push(`📍 地區：${v.location}`);
      if (v.contact && v.contact.ig) parts.push(`📷 IG：${v.contact.ig}`);
      if (v.notes_zh) parts.push(`📝 備註：${v.notes_zh}`);
      return `💄 **${name}**\n${parts.join("\n")}`;
    });

    return res.status(200).json({
      ok: true,
      flow: flow.id,
      template: flow.template,
      answer: lines.join("\n\n")
    });
  } catch (e) {
    return res.status(200).json({
      ok: false,
      where: "vendor_card_zh",
      error: String(e)
    });
  }
}
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
