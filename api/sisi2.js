// api/sisi3.js
// Joey 的簡易規則引擎版（Node 22 / Vercel）
// - 支援：過大禮 / 安床 / 回門（傳統）
// - 支援：化妝師 Vendors 卡片（多間，分行輸出）
// - 支援：紅日簡單列出（可再擴充）
// - ?format=text 只輸出文字；?debug=1 會多回傳 debug 資訊

export default async function handler(req, res) {
  try {
    const q = (req.query.question || req.query.q || "").trim();
    const wantText = (req.query.format || "").toLowerCase() === "text";
    const debugMode = req.query.debug === "1";

    if (!q) {
      return out({
        res,
        wantText,
        ok: true,
        answer:
          "可以問我：過大禮 / 安床 / 回門 / 化妝師 / 紅日。\n例如：「我想知過大禮要準備啲乜？」",
      });
    }

    // 你可在 Vercel > Project > Settings > Environment Variables 設定 RULES_BASE_URL
    const BASE =
      process.env.RULES_BASE_URL ||
      "https://raw.githubusercontent.com/mssstudiohk-source/wedding-sisi-api/main/rules";

    // ---------- 共用小工具 ----------
    const fetchJSON = async (path) => {
      const url = `${BASE}/${path.replace(/^\//, "")}`;
      const r = await fetch(url, { cache: "no-store" });
       (!r.ok) {
        const txt = await r.text().catch(() => "");
        throw new Error(`Fetch fail ${r.status} ${url} :: ${txt.slice(0, 200)}`);
      }
      return { url, json: await r.json() };
    };

    const includesAny = (text, words) =>
      words.some((w) => text.includes(w));

    // ---------- 格式化（Formatter） ----------
    // 1) 傳統（過大禮 / 安床 / 回門）
    const tradition_zh = (t) => {
      let lines = [];
      if (t.summary_zh || t.summary)
        lines.push(`📌 重點：${t.summary_zh || t.summary}`);
      const ds = t.details_zh || t.details || [];
      if (Array.isArray(ds) && ds.length) {
        lines.push("📋 細節：");
        lines = lines.concat(ds.map((d, i) => `${i + 1}. ${d}`));
      }
      if (t.notes_zh || t.notes) lines.push(`📝 備註：${t.notes_zh || t.notes}`);
      return lines.join("\n");
    };

    // 2) Vendor 卡片（化妝師）
    const vendor_card_zh = (arr) => {
      if (!Array.isArray(arr) || !arr.length) return "未有化妝師資料。";
      return arr
        .map((v) => {
          return [
            `💄 **${v.name_zh || v.name_en || ""}**`,
            v.description ? `✨ 風格：${v.description}` : "",
            Array.isArray(v.services) && v.services.length
              ? `📋 服務：\n${v.services
                  .map((s, i) => `${i + 1}. ${s}`)
                  .join("\n")}`
              : "",
            v.price_range_hkd ? `💰 價錢範圍：${v.price_range_hkd}` : "",
            v.location ? `📍 地區：${v.location}` : "",
            v.contact?.ig ? `📸 IG：${v.contact.ig}` : "",
            v.contact?.website ? `🔗 網站：${v.contact.website}` : "",
            v.notes_zh ? `📝 備註：${v.notes_zh}` : "",
          ]
            .filter(Boolean)
            .join("\n");
        })
        .join("\n\n"); // vendor 與 vendor 之間空一行
    };

    // 3) 紅日（簡單列 3 個）
    const holidays_zh = (arr) => {
      const list = Array.isArray(arr) ? arr.slice(0, 3) : [];
      if (!list.length) return "暫時未有資料。";
      return (
        "📅 最近紅日：\n" +
        list
          .map(
            (d, i) =>
              `${i + 1}. ${d.date || d.day || ""} — ${d.name_zh || d.name || ""}`
          )
          .join("\n")
      );
    };

    // ---------- 流程匹配 ----------
    // Tradition
    if (includesAny(q, ["過大禮", "安床", "回門"])) {
      const { url, json } = await fetchJSON("traditions/traditions.json");

      // 用關鍵字直接取對應 key
      const hit = ["過大禮", "安床", "回門"].find((k) => q.includes(k));
      const t =
        json?.[hit] ||
        {}; /* 兼容你文件是 { "過大禮": {...}, "安床": {...}, ... } 的結構 */

      const answer = tradition_zh(t);
      return out({
        res,
        wantText,
        ok: true,
        flow: "tradition",
        template: "tradition_zh",
        source: url,
        answer,
      });
    }

    // 化妝師 Vendor
    if (includesAny(q, ["化妝師", "MUA", "化粧師"])) {
      let data, url;
      try {
        const r1 = await fetchJSON("vendors/vendors_makeup.json");
        url = r1.url;
        data = r1.json;
      } catch {
        const r2 = await fetchJSON("vendors/vendors_makeup22.json"); // 兼容你另一個檔名
        url = r2.url;
        data = r2.json;
      }

      const answer = vendor_card_zh(data);
      return out({
        res,
        wantText,
        ok: true,
        flow: "makeup_vendors",
        template: "vendor_card_zh",
        source: url,
        answer,
      });
    }

    // 紅日 / 公眾假期
    if (includesAny(q, ["紅日", "公眾假期"])) {
      const { url, json } = await fetchJSON("dates/holidays_2025.json");
      const answer = holidays_zh(json);
      return out({
        res,
        wantText,
        ok: true,
        flow: "holiday",
        template: "holiday_zh",
        source: url,
        answer,
      });
    }

    // 未命中 → 提示
    return out({
      res,
      wantText,
      ok: true,
      answer:
        "暫時只支援：過大禮 / 安床 / 回門 / 化妝師 / 紅日。\n可試例句：「我想知過大禮要準備啲乜？」",
    });
  } catch (e) {
    // 永不 500：任何錯都以 200 回應，方便前端
    return res.status(200).json({
      ok: false,
      fatal: String(e),
    });
  }
}

/* 內部輸出工具 --------------------------------- */
function out({ res, wantText, ...payload }) {
  if (wantText) {
    // 讓瀏覽器用純文字模式顯示，\n 會變成換行
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    return res.status(200).send(payload.answer || "");
  }

  // JSON 模式（預設）
  return res.status(200).json(payload);
}
