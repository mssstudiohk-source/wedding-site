// api/sisi.js
// Node.js Runtime on Vercel (>= 18/20/22)

const DEFAULT_RULES_BASE =
  process.env.RULES_BASE_URL ||
  "https://raw.githubusercontent.com/mssstudiohk-source/wedding-sisi-api/main/rules";

export default async function handler(req, res) {
// 迷你對話進入點
const guided = await handleGuide(req, res, out, wantText);
if (guided) {
  // 如果 guided 是 handoff 就繼續去你原有邏輯；如果已 out() 了就 return。
  if (!guided.handoff) return; // 已經輸出
  // 否則掉頭去處理傳統/紅日/vendor —— 你下面現成的代碼會用到 req.query.question
}
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
    if (!q) {
      return out({
        ok: true,
        answer:
          "你可以咁問：\n- 我想知過大禮要準備啲乜？\n- 搵化妝師有冇推介？\n- 2025 有邊啲法定假期？",
      });
    }

    // ----------------- Router 判斷 -----------------
    const intent = pickIntent(q);
    if (!intent) {
      return out({
        ok: true,
        answer:
          "我而家識：通勝擇日 / 化妝師 / 紅日。\n你可以試下：\n- 紅日 2025-09-13\n- 2025-09-13 適唔適合結婚？\n- 搵化妝師",
      });
    }

    // ---------- 根據 flow 決定讀邊個資料 ----------
    let data = null;
    try {
      data = await fetchJSON(intent.source);
    } catch (e) {
      return out({
        ok: false,
        error: "fetch error",
        detail: String(e),
      });
    }

    // ---------- tradition ----------
    if (intent.template === "tradition_zh") {
      const keys = ["過大禮", "安床", "上頭", "回門"];
      const k = keys.find((kk) => q.includes(kk));
      const item = k && data && typeof data === "object" ? data[k] : null;

      if (!item) {
        return out({
          ok: true,
          answer: "我識：過大禮 / 安床 / 上頭 / 回門。",
        });
      }

      const summary = item.summary_zh || item.summary || "";
      const detailsArr = item.details_zh || item.details || [];
      const notes = item.notes_zh || item.notes || "";

      const numbered =
        Array.isArray(detailsArr) && detailsArr.length
          ? detailsArr.map((s, i) => `${i + 1}. ${s}`).join("\n")
          : "";

      const answer =
        `📌 **${k}重點**：${summary}\n` +
        (numbered ? `🧾 **細節**：\n${numbered}\n` : "") +
        (notes ? `📝 **備註**：${notes}` : "");

      return out({ ok: true, flow: intent.flow, answer });
    }

    // ---------- vendor ----------
    if (intent.template === "vendor_card_zh") {
      const items = Array.isArray(data)
        ? data
        : data && Array.isArray(data.items)
        ? data.items
        : [];
      if (!items.length) {
        return out({ ok: true, answer: "未有化妝師資料。" });
      }

      const top = items.slice(0, 3);
      const lines = top.map((v, idx) => {
        const name = v.name_zh || v.name_en || `MUA ${idx + 1}`;
        const style = v.description || "";
        const services = Array.isArray(v.services) ? v.services : [];
        const price = v.price_range_hkd || "";
        const location = v.location || "";

        return (
          `💄 **${name}**\n` +
          (style ? `✨ 風格：${style}\n` : "") +
          (services.length
            ? `□ 服務：${services.map((s, i) => `${i + 1}. ${s}`).join(" / ")}\n`
            : "") +
          (price ? `💰 價錢範圍：${price}\n` : "") +
          (location ? `📍 地區：${location}` : "")
        ).trimEnd();
      });

      return out({ ok: true, flow: intent.flow, answer: lines.join("\n\n") });
    }

// ===== 迷你對話引擎（放在 handler 內，主判斷之前） =====
const GUIDE_URL = `${DEFAULT_RULES_BASE}/dialog/guide.json`;

async function handleGuide(req, res, out, wantText) {
  // 入口條件：query.guide=1 或者 問句包含「開始」「對話」「help」
  const q = String(req.query.question || "");
  const guideMode =
    req.query.guide === "1" || /(開始|對話|help|menu)/i.test(q);

  if (!guideMode) return null; // 不處理，交返主程式

  // 讀流程
  let flow;
  try {
    flow = await fetchJSON(GUIDE_URL);
  } catch (_) {
    return out({ ok: false, answer: "對話流程暫時讀取不到 🙈" });
  }

  const steps = Array.isArray(flow?.steps) ? flow.steps : [];
  const byId = Object.fromEntries(steps.map(s => [s.id, s]));

  // 取當前 step（預設 greeting）
  const stepId = String(req.query.step || "greeting");
  const step = byId[stepId] || byId["greeting"];

  // Handoff：把意圖交回主功能
  if (step?.type === "handoff") {
    const intent = String(req.query.intent || "");
    // 1) 傳統禮儀
    if (intent.startsWith("trad_")) {
      const k = intent.replace("trad_", ""); // 過大禮/安床/上頭/回門
      req.query.question = k; // 直接重用你現有傳統邏輯
      return { handoff: "tradition" };
    }
    // 2) Vendor
    if (intent.startsWith("vendor_")) {
      const k = intent.replace("vendor_", ""); // 化妝師
      req.query.question = k;
      return { handoff: "vendor" };
    }
    // 3) 紅日/擇日（由 ask_date 來）
    if (stepId === "handoff_date") {
      // 用戶會以 ?answer=2025-09-13 傳入
      const date = String(req.query.answer || "").trim();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return out({ ok: true, answer: "日期格式唔啱，試下 2025-09-13 🙏" });
      }
      // 交畀 lunar.js 的查詢邏輯：直接把 question 改成 「紅日 2025-09-13」
      req.query.question = `紅日 ${date}`;
      req.query.format = req.query.format || "text";
      return { handoff: "lunar" };
    }
  }

  // 普通「say」或「ask」：輸出步驟 + next link（文字 or JSON）
  if (!step) return out({ ok: false, answer: "對話流程未就緒 🙈" });

  // 文字模式：把 options 變成可點擊 URL
  let answer = step.content || "";
  if (Array.isArray(step.options) && step.options.length) {
    const base = req.url.split("?")[0];
    const baseQS = (extra) =>
      `${base}?guide=1${req.query.format ? `&format=${req.query.format}` : ""}${extra}`;

    const lines = step.options.map((opt, i) => {
      const href = baseQS(`&step=${encodeURIComponent(opt.next || "greeting")}${opt.intent ? `&intent=${encodeURIComponent(opt.intent)}` : ""}`);
      return `${i + 1}. ${opt.label} → ${href}`;
    });
    answer += `\n\n${lines.join("\n")}`;
  } else if (step.type === "ask") {
    const base = req.url.split("?")[0];
    const example = `${base}?guide=1&step=${encodeURIComponent(step.next)}&answer=2025-09-13${req.query.format ? `&format=${req.query.format}` : ""}`;
    answer += `\n\n（例如把答案放網址：${example}）`;
  }

  return out({
    ok: true,
    guide: true,
    step: step.id,
    answer
  });
}


    
    // ---------- holiday ----------
    if (intent.template === "holiday_zh") {
      const arr = Array.isArray(data) ? data : [];
      const rows = arr
        .map((d) => ({
          ...d,
          _t: Date.parse(d.date || d.date_gregorian || ""),
        }))
        .filter((d) => !Number.isNaN(d._t))
        .sort((a, b) => a._t - b._t)
        .slice(0, 3)
        .map(
          (d, i) =>
            `${i + 1}. ${d.date || d.date_gregorian} － ${d.name || d.name_zh}`
        );

      return out({
        ok: true,
        flow: intent.flow,
        answer: rows.length
          ? `📅 **近期紅日**：\n${rows.join("\n")}`
          : "暫時搵唔到紅日資料。",
      });
    }

    // ---------- fallback ----------
    return out({
      ok: true,
      answer:
        "暫時只支援：過大禮 / 安床 / 回門 / 化妝師 / 紅日。",
    });
  } catch (e) {
    return res.status(200).json({ ok: false, fatal: String(e) });
  }
}

// ----------------- router function -----------------
function pickIntent(q) {
  const text = q.trim().toLowerCase();

  if (/過大禮|安床|上頭|回門/.test(q))
    return {
      flow: "tradition",
      template: "tradition_zh",
      source: `${DEFAULT_RULES_BASE}/traditions/traditions.json`,
    };

  if (/(化妝師|mua)/i.test(q))
    return {
      flow: "makeup_vendors",
      template: "vendor_card_zh",
      source: `${DEFAULT_RULES_BASE}/vendors/vendors_makeup.json`,
    };

  if (/紅日|公眾假期/.test(q))
    return {
      flow: "holiday",
      template: "holiday_zh",
      source: `${DEFAULT_RULES_BASE}/dates/holidays_2025.json`,
    };

  if (/擇日|揀好日子|黃曆|通勝/.test(q))
    return { flow: "lunar", template: "lunar_zh" };

  if (/\b20\d{2}[-/年]\d{1,2}[-/月]\d{1,2}\b/.test(q))
    return { flow: "lunar", template: "lunar_zh" };

  const weddingHits = (q.match(/[婚嫁擺酒儀式]/g) || []).length;
  if (weddingHits >= 2)
    return { flow: "wedding_generic", template: "wedding_info_zh" };

  return null;
}

// ----------------- fetchJSON -----------------
async function fetchJSON(url) {
  const r = await fetch(url, { cache: "no-store" });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return await r.json();
}
