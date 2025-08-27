// /api/sisi3.js
export default async function handler(req, res) {
  try {
    const q = (req.query.question || "").trim();
    const debug = req.query.debug;

    const BASE = process.env.RULES_BASE_URL;
    if (!BASE) {
      return res.status(500).json({ ok: false, where: "env", error: "RULES_BASE_URL is required" });
    }

    // 小工具：安全抓 JSON（不 throw，返回 {ok,data,error}）
    const loadJSON = async (rel) => {
      const url = `${BASE}/${rel}`;
      try {
        const r = await fetch(url, { cache: "no-store" });
        if (!r.ok) return { ok: false, error: `HTTP ${r.status}`, url };
        const data = await r.json();
        return { ok: true, data, url };
      } catch (e) {
        return { ok: false, error: String(e), url };
      }
    };

    // Debug 路徑：只檢查 flow 檔有無讀到
    if (debug) {
      const conv = await loadJSON("conversation_flow.json");
      const flows = await loadJSON("reply_flow.json");
      return res.status(200).json({
        ok: conv.ok && flows.ok,
        conversation_ok: conv.ok, conversation_url: conv.url, conversation_error: conv.error || null,
        replyflow_ok: flows.ok, replyflow_url: flows.url, replyflow_error: flows.error || null,
        steps: conv.data?.steps || [],
        flows: flows.data?.flows || []
      });
    }

    // ---- 正常回答邏輯（先做 traditions DEMO）----
    // 1) 命中傳統禮節關鍵字
    const hitKeys = ["過大禮", "安床", "上頭", "回門"];
    const hit = hitKeys.find(k => q.includes(k));
    if (hit) {
      const tj = await loadJSON("traditions/traditions.json");
      if (!tj.ok) {
        return res.status(200).json({
          ok: false, where: "fetch_traditions", url: tj.url, error: tj.error
        });
      }
      const rec = tj.data?.[hit];
      if (!rec) {
        return res.status(200).json({ ok: false, where: "traditions_lookup", error: `No entry for '${hit}'` });
      }

      // 兼容 _zh / 無後綴
      const pick = (obj, key) => obj?.[key + "_zh"] ?? obj?.[key] ?? "";
      const pickList = (obj, key) =>
        Array.isArray(obj?.[key + "_zh"]) ? obj[key + "_zh"]
        : Array.isArray(obj?.[key])      ? obj[key]
        : [];

      const summary = pick(rec, "summary");
      const details = pickList(rec, "details");
      const notes   = pick(rec, "notes");

      const lines = [];
      if (summary) lines.push("重點：" + summary);
      if (details?.length) lines.push("細節：\n- " + details.join("\n- "));
      if (notes) lines.push("備註：" + notes);

      return res.status(200).json({
        ok: true,
        topic: hit,
        answer: lines.join("\n"),
        source: "traditions/traditions.json"
      });
    }

    // 2) 其他（暫時回指引）
    return res.status(200).json({
      ok: true,
      answer: "暫時支援：過大禮／安床／上頭／回門。你可以試問：『過大禮要準備啲乜？』",
    });

  } catch (e) {
    // 任何例外都唔丟 500 純字串，回可讀錯誤
    return res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
}
