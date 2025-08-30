// api/sisi.js
// Node.js Runtime on Vercel (>= 18/20/22)

const DEFAULT_RULES_BASE =
  process.env.RULES_BASE_URL ||
  "https://raw.githubusercontent.com/mssstudiohk-source/wedding-sisi-api/main/rules";

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
