// api/sisi3.js  — JSON 版（不連 Supabase），所有錯誤都回 200

const DEFAULT_RULES_BASE =
  process.env.RULES_BASE_URL ||
  "https://raw.githubusercontent.com/mssstudiohk-source/wedding-sisi-api/main/rules";

export default async function handler(req, res) {
  const wantText =
    (req.query.format || "").toLowerCase() === "text" ||
    (req.headers.accept || "").includes("text/plain");

  function out(payload) {
    try {
      if (wantText) {
        res.setHeader("Content-Type", "text/plain; charset=utf-8");
        return res.status(200).send(String(payload.answer || ""));
      }
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      return res.status(200).json(payload);
    } catch {
      return res.status(200).send(String(payload?.answer || "OK"));
    }
  }

  try {
    const q = String(req.query.question || "").trim();
    const dbg = !!req.query.debug;

    if (!q) {
      return out({
        ok: true,
        answer:
          "你可以咁問：\n- 我想知過大禮要準備啲乜？\n- 搵化妝師有冇推介？\n- 2025 有邊啲法定假期？\n（加上 &format=text 會用純文字分行顯示）",
      });
    }

    const flowUrl = ${DEFAULT_RULES_BASE}/conversation_flow.json;
    const replyUrl = ${DEFAULT_RULES_BASE}/reply_flow.json;

    let flowCfg = null;
    let replyCfg = null;
    try { flowCfg = await fetchJSON(flowUrl); } catch {}
    try { replyCfg = await fetchJSON(replyUrl); } catch {}

    const fallbackFlows = [
      {
        id: "tradition",
        keywords: ["過大禮", "安床", "上頭", "回門"],
        source: ${DEFAULT_RULES_BASE}/traditions/traditions.json,
        template: "tradition_zh",
      },
      {
        id: "makeup_vendors",
        keywords: ["化妝師", "MUA"],
        source: ${DEFAULT_RULES_BASE}/vendors/vendors_makeup.json,
        template: "vendor_card_zh",
      },
      {
        id: "holiday",
        keywords: ["紅日", "公眾假期"],
        source: ${DEFAULT_RULES_BASE}/dates/holidays_2025.json,
        template: "holiday_zh",
      },
    ];

    const flows =
      flowCfg && Array.isArray(flowCfg.flows) && flowCfg.flows.length
        ? flowCfg.flows
        : fallbackFlows;

    if (dbg && !wantText) {
      return out({
        ok: true,
        conversation_ok: !!flowCfg,
        conversation_url: flowUrl,
        conversation_error: flowCfg ? null : "using fallback",
        replyflow_ok: !!replyCfg,
        replyflow_url: replyUrl,
        replyflow_error: replyCfg ? null : "optional / not used here",
        flows,
      });
    }

    const hit = flows.find(f => f.keywords?.some(kw => q.includes(kw))) || null;

    if (!hit) {
      return out({
        ok: true,
        answer:
          "暫時只支援：過大禮 / 安床 / 回門 / 化妝師 / 紅日。\n可試例如：「我想知過大禮要準備啲乜？」",
      });
    }

    let data = null;
    try {
      data = await fetchJSON(hit.source);
    } catch (e) {
      return out({
        ok: false,
        error: "fetch",
        status: e.status || 0,
        preview: e.preview || "",
      });
    }

    if (hit.template === "tradition_zh") {
      const keys = ["過大禮", "安床", "上頭", "回門"];
      const k = keys.find(kk => q.includes(kk));
      const item = k && data && typeof data === "object" ? data[k] : null;

      if (!item) {
        return out({ ok: true, answer: "我識：過大禮 / 安床 / 上頭 / 回門。\n例如：「我想知過大禮要準備啲乜？」" });
      }

      const summary = item.summary_zh || item.summary || "";
      const detailsArr = item.details_zh || item.details || [];
      const notes = item.notes_zh || item.notes || "";

      const numbered = Array.isArray(detailsArr) && detailsArr.length
        ? detailsArr.map((s, i) => ${i + 1}. ${s}).join("\n")
        : "";

      const answer =
        📌 **${k}重點**：${summary || "—"}\n +
        (numbered ? 🧾 **細節**：\n${numbered}\n : "") +
        (notes ? 📝 **備註**：${notes}\n : "");

      return out({ ok: true, flow: hit.id, template: hit.template, source: hit.source, answer });
    }

    if (hit.template === "vendor_card_zh") {
      const items = Array.isArray(data) ? data
        : (data?.items && Array.isArray(data.items)) ? data.items
        : data ? [data] : [];

      if (!items.length) {
        return out({ ok: true, flow: hit.id, template: hit.template, source: hit.source, answer: "未有化妝師資料。" });
      }

      const top = items.slice(0, 3);
      const lines = top.map((v, idx) => {
        const name = v.name_zh || v.name || v.name_en || MUA ${idx + 1};
        const style = v.description || v.style || "";
        const services = Array.isArray(v.services) ? v.services : [];
        const price = v.price_range_hkd || v.price || "";
        const location = v.location || "";
        const notes = v.notes_zh || v.notes || "";

        const sv = services.length
          ? \n□ 服務：\n${services.map((s, i) => `   ${i + 1}. ${s}).join("\n")}`
          : "";

        return (
          💄 **${name}**\n +
          (style ? ✨ 風格：${style}\n : "") +
          (sv || "") +
          (price ? 💰 價錢範圍：${price}\n : "") +
          (location ? 📍 地區：${location}\n : "") +
          (notes ? 📝 備註：${notes}\n : "")
        ).trimEnd();
      });

      return out({ ok: true, flow: hit.id, template: hit.template, source: hit.source, answer: lines.join("\n\n") });
    }

    if (hit.template === "holiday_zh") {
      const arr = Array.isArray(data) ? data : [];
      const rows = arr
        .map(d => ({ ...d, _t: Date.parse(d.date || d.date_gregorian || "") }))
        .filter(d => !Number.isNaN(d._t))
        .sort((a, b) => a._t - b._t)
        .slice(0, 3)
        .map((d, i) => ${i + 1}. ${d.date || d.date_gregorian} － ${d.name || d.name_zh || ""});

      const answer = rows.length ? 📅 **2025 近期紅日**：\n${rows.join("\n")} : "暫時搵唔到 2025 紅日資料。";
      return out({ ok: true, flow: hit.id, template: hit.template, source: hit.source, answer });
    }

    return out({
      ok: true,
      answer:
        "暫時只支援：過大禮 / 安床 / 回門 / 化妝師 / 紅日。\n再試下？例如：「搵化妝師」或「我想知過大禮要準備啲乜？」",
    });
  } catch (e) {
    return res.status(200).json({ ok: false, fatal: String(e?.stack || e) });
  }
}

async function fetchJSON(url) {
  const r = await fetch(url, { cache: "no-store" });
  if (!r.ok) {
    const txt = await r.text().catch(() => "");
    const err = new Error(HTTP ${r.status} ${r.statusText});
    err.status = r.status;
    err.preview = txt.slice(0, 200);
    throw err;
  }
  return await r.json();
}
