// api/sisi.js  —  無 500 保底版 + 對話引擎 + 傳統/紅日/vendor handoff（ESM）

const DEFAULT_RULES_BASE =
  process.env.RULES_BASE_URL ||
  "https://raw.githubusercontent.com/mssstudiohk-source/wedding-sisi-api/main/rules";

const GUIDE_URL = `${DEFAULT_RULES_BASE}/dialog/guide.json`;

// ---------------- 小工具 ----------------
async function fetchJSON(url) {
  const r = await fetch(url, { cache: "no-store" });
  if (!r.ok) {
    const txt = await r.text().catch(() => "");
    const e = new Error(`HTTP ${r.status}`);
    e.status = r.status;
    e.preview = txt.slice(0, 200);
    throw e;
  }
  return await r.json();
}

// 統一輸出（支援 text / json），永不 500
function out({ res, wantText, ...payload }) {
  if (wantText) {
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    return res.status(200).send(String(payload.answer || ""));
  }
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  return res.status(200).json(payload);
}

// ---------------- 對話引擎 ----------------
async function handleGuide(req, res, wantText) {
  // 入口條件：?guide=1 或問句含「開始/對話/help/menu」
  const q = String(req.query.question || "");
  const guideMode =
    req.query.guide === "1" || /(開始|對話|help|menu)/i.test(q);

  if (!guideMode) return null;

  let flow;
  try {
    flow = await fetchJSON(GUIDE_URL);
  } catch (e) {
    return out({ res, wantText, ok: false, answer: "對話流程讀取不到 🙈" });
  }

  const steps = Array.isArray(flow?.steps) ? flow.steps : [];
  const byId = Object.fromEntries(steps.map((s) => [s.id, s]));

  const stepId = String(req.query.step || "greeting");
  const step = byId[stepId] || byId["greeting"];

  // handoff：交返主功能（把 req.query.question 改好）
  if (step?.type === "handoff") {
    const intent = String(req.query.intent || "");
    if (intent.startsWith("trad_")) {
      req.query.question = intent.replace("trad_", ""); // 過大禮/安床/上頭/回門
      return { handoff: "tradition" };
    }
    if (intent.startsWith("vendor_")) {
      req.query.question = intent.replace("vendor_", ""); // 化妝師
      return { handoff: "vendor" };
    }
  }
  if (stepId === "handoff_date") {
    const date = String(req.query.answer || "").trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return out({
        res,
        wantText,
        ok: true,
        answer: "日期格式唔啱，試下 2025-09-13 🙏",
      });
    }
    req.query.question = `紅日 ${date}`; // 交畀紅日分支
    req.query.format = req.query.format || "text";
    return { handoff: "lunar" };
  }

  // 普通 say/ask：輸出步驟 + 選項 URL
  let answer = step.content || "";
  if (Array.isArray(step.options) && step.options.length) {
    const base = req.url.split("?")[0];
    const mk = (extra) =>
      `${base}?guide=1${req.query.format ? `&format=${req.query.format}` : ""}${extra}`;
    const lines = step.options.map((opt, i) => {
      const href = mk(
        `&step=${encodeURIComponent(opt.next || "greeting")}${
          opt.intent ? `&intent=${encodeURIComponent(opt.intent)}` : ""
        }`
      );
      return `${i + 1}. ${opt.label} → ${href}`;
    });
    answer += `\n\n${lines.join("\n")}`;
  } else if (step.type === "ask") {
    const base = req.url.split("?")[0];
    const example = `${base}?guide=1&step=${encodeURIComponent(
      step.next
    )}&answer=2025-09-13${req.query.format ? `&format=${req.query.format}` : ""}`;
    answer += `\n\n（例如把答案放網址：${example}）`;
  }

  return out({ res, wantText, ok: true, guide: true, step: step.id, answer });
}

// ---------------- 主處理 ----------------
export default async function handler(req, res) {
  const q = String(req.query.question || "").trim();
  const wantText =
    (req.query.format || "").toLowerCase() === "text" ||
    (req.headers.accept || "").includes("text/plain");

  try {
    // 1) 對話引擎（如啟動會先處理）
    const guided = await handleGuide(req, res, wantText);
    if (guided && !guided.handoff) return; // 已經輸出完畢
    // 若 guided?.handoff 存在，落去由功能分支處理 req.query.question

    // 2) PING
    if (!q) {
      return out({
        res,
        wantText,
        ok: true,
        answer: "🎉 API OK! 試 /api/sisi?question=過大禮&format=text 或 /api/sisi?guide=1",
      });
    }

    // 3) 傳統（過大禮 / 安床 / 上頭 / 回門）
    const TRAD_KEYS = ["過大禮", "安床", "上頭", "回門"];
    if (TRAD_KEYS.some((k) => q.includes(k))) {
      const url = `${DEFAULT_RULES_BASE}/traditions/traditions.json`;
      let data;
      try {
        data = await fetchJSON(url);
      } catch (e) {
        return out({
          res,
          wantText,
          ok: false,
          error: "fetch-trad",
          status: e.status || 0,
          preview: e.preview || "",
        });
      }
      const hitKey = TRAD_KEYS.find((k) => q.includes(k));
      const t = hitKey && data && typeof data === "object" ? data[hitKey] : null;
      if (!t) {
        return out({
          res,
          wantText,
          ok: true,
          answer: "我識：過大禮 / 安床 / 上頭 / 回門。試：「我想知過大禮要準備啲乜？」",
        });
      }
      const summary = t.summary_zh || t.summary || "";
      const details = Array.isArray(t.details_zh || t.details) ? t.details_zh || t.details : [];
      const notes = t.notes_zh || t.notes || "";
      const numbered = details.length ? details.map((s, i) => `${i + 1}. ${s}`).join("\n") : "";
      const answer =
        `📌 **${hitKey}重點**：${summary || "—"}\n` +
        (numbered ? `🧾 **細節**：\n${numbered}\n` : "") +
        (notes ? `📝 **備註**：${notes}\n` : "");
      return out({
        res,
        wantText,
        ok: true,
        flow: "tradition",
        answer,
      });
    }

    // 4) 紅日 / 擇日（例如：紅日 2025-09-13）
    if (q.startsWith("紅日")) {
      const m = q.match(/(\d{4}-\d{2}-\d{2})/);
      const date = m?.[1] || "";
      const url = `${DEFAULT_RULES_BASE}/dates/holidays_2025.json`;
      let rows = [];
      try {
        rows = await fetchJSON(url);
      } catch (e) {
        // 即使 holiday 讀唔到，後面仍可照出格式
      }
      // 這裡只示範輸出你 lunar.js 的格式（假設你已把當日資料放到 DB）
      const answer =
        `🗓️ 要求：${date || "（未提供日期）"}\n` +
        `五行：泉中水\n` +
        `十二神：建日\n` +
        `沖煞：沖兔（巳卯）\n` +
        `星神：玉堂（吉星）\n` +
        `✅ 宜（主）：祭祀、出行、掃舍、餘事勿取\n` +
        `⛔ 忌（主）：諸事不宜`;
      return out({ res, wantText, ok: true, flow: "holiday", answer });
    }

    // 5) Vendor（化妝師）
    if (q.includes("化妝師") || /MUA/i.test(q)) {
      const url = `${DEFAULT_RULES_BASE}/vendors/vendors_makeup.json`;
      let data;
      try {
        data = await fetchJSON(url);
      } catch (e) {
        return out({
          res,
          wantText,
          ok: false,
          error: "fetch-vendor",
          status: e.status || 0,
          preview: e.preview || "",
        });
      }
      const items = Array.isArray(data)
        ? data
        : data?.items && Array.isArray(data.items)
        ? data.items
        : [];
      if (!items.length) {
        return out({
          res,
          wantText,
          ok: true,
          flow: "vendor",
          answer: "未有化妝師資料。",
        });
      }
      const top = items.slice(0, 3);
      const lines = top.map((v, i) => {
        const name = v.name_zh || v.name || v.name_en || `MUA ${i + 1}`;
        const style = v.description || v.style || "";
        const services = Array.isArray(v.services) ? v.services : [];
        const price = v.price_range_hkd || v.price || "";
        const location = v.location || "";
        const notes = v.notes_zh || v.notes || "";
        const sv = services.length
          ? `\n□ 服務：\n${services.map((s, j) => `   ${j + 1}. ${s}`).join("\n")}`
          : "";
        return (
          `💄 **${name}**\n` +
          (style ? `✨ 風格：${style}\n` : "") +
          (sv || "") +
          (price ? `💰 價錢範圍：${price}\n` : "") +
          (location ? `📍 地區：${location}\n` : "") +
          (notes ? `📝 備註：${notes}\n` : "")
        ).trimEnd();
      });
      return out({
        res,
        wantText,
        ok: true,
        flow: "vendor",
        answer: lines.join("\n\n"),
      });
    }

    // 6) 未命中
    return out({
      res,
      wantText,
      ok: true,
      answer:
        "我可以幫你：過大禮 / 安床 / 上頭 / 回門、紅日、化妝師。\n可試：「過大禮要準備啲乜？」或用 /api/sisi?guide=1 開始對話。",
    });
  } catch (e) {
    // 永不 500
    return out({
      res,
      wantText,
      ok: false,
      fatal: String(e?.stack || e),
    });
  }
}
