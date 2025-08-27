// api/sisi2.js
// ESM, Node 22 on Vercel
// Always respond 200 with JSON to avoid 500 white screen.

export default async function handler(req, res) {
  // Helper to always JSON 200
  const ok = (obj) => res.status(200).json(obj);

  try {
    // 1) Read user question (q)
    const url = new URL(req.url, "https://dummy.local");
    const q = (url.searchParams.get("question") || "").trim();

    if (!q) {
      return ok({ ok: false, error: "missing question. try /api/sisi3?question=過大禮" });
    }

    // 2) Base to your repo raw JSON (rules folder)
    const BASE =
      "https://raw.githubusercontent.com/mssstudiohk-source/wedding-sisi-api/main/rules";

    // 3) Small helper to fetch JSON safely
    async function fetchJson(u) {
      const r = await fetch(u, { cache: "no-store" });
      if (!r.ok) throw new Error(`fetch ${u} failed: ${r.status}`);
      const txt = await r.text();
      try {
        return JSON.parse(txt);
      } catch (e) {
        throw new Error(`parse json failed for ${u}: ${String(e)}`);
      }
    }

    // 4) Flow table (simple keyword routing)
    const flows = [
      {
        id: "tradition",
        keywords: ["過大禮", "安床", "上頭", "回門"],
        source: `${BASE}/traditions/traditions.json`,
        template: "tradition_zh",
      },
      {
        id: "makeup_vendors",
        keywords: ["化妝師", "MUA"],
        source: `${BASE}/vendors/vendors_makeup.json`,
        template: "vendor_card_zh",
      },
      {
        id: "holiday",
        keywords: ["紅日", "公眾假期"],
        source: `${BASE}/dates/holidays_2025.json`,
        template: "holiday_zh",
      },
    ];

    // 5) Pick flow by keyword
    const picked =
      flows.find((f) => f.keywords.some((kw) => q.includes(kw))) || null;

    if (!picked) {
      // no matched flow, gentle hint
      return ok({
        ok: true,
        answer:
          "暫時只支援：過大禮 / 安床 / 回門 / 化妝師 / 紅日。可試例如：我想知過大禮要準備啲乜？",
      });
    }

    // 6) Fetch data for the picked flow
    const data = await fetchJson(picked.source);

    // 7) Render by template
    if (picked.template === "tradition_zh") {
      // data is an object: { "過大禮": {...}, "安床": {...}, ... }
      const keys = ["過大禮", "安床", "上頭", "回門"];
      const key = keys.find((k) => q.includes(k));
      const t = key && data && typeof data === "object" ? data[key] : null;

      if (!t) {
        return ok({
          ok: false,
          flow: picked.id,
          template: picked.template,
          error: "no tradition item matched",
          hint: "可試：過大禮 或 安床 或 上頭 或 回門",
        });
      }

      const summary = t.summary_zh || "";
      const details = Array.isArray(t.details_zh) ? t.details_zh.join("；") : "";
      const notes = t.notes_zh ? `備註：${t.notes_zh}` : "";

      const ans = `重點：${summary}\n細節：${details}\n${notes}`.trim();

      return ok({
        ok: true,
        flow: picked.id,
        template: picked.template,
        source: picked.source,
        answer: ans,
      });
    }

    if (picked.template === "vendor_card_zh") {
      // data can be [{...}, ...] or { items:[...] }
      const list = Array.isArray(data)
        ? data
        : data && Array.isArray(data.items)
        ? data.items
        : [];

      if (!Array.isArray(list) || list.length === 0) {
        return ok({
          ok: true,
          flow: picked.id,
          template: picked.template,
          source: picked.source,
          answer: "未有化妝師資料。",
        });
      }

      // Map each vendor into a card
      const lines = list.map((v) => {
        const name = (v.name_zh || v.name_en || "").trim();
        const parts = [];
        if (v.description) parts.push(`風格：${v.description}`);
        if (Array.isArray(v.services) && v.services.length)
          parts.push(`服務：${v.services.join("、")}`);
        if (v.price_range_hkd) parts.push(`起價：約 ${v.price_range_hkd}`);
        if (v.location) parts.push(`地區：${v.location}`);
        if (v.contact && v.contact.ig) parts.push(`IG：${v.contact.ig}`);
        if (v.website) parts.push(`網站：${v.website}`);
        if (v.notes_zh) parts.push(`備註：${v.notes_zh}`);

        return `【${name}】\n- ${parts.join("\n- ")}`;
      });

      return ok({
        ok: true,
        flow: picked.id,
        template: picked.template,
        source: picked.source,
        answer: lines.join("\n\n"),
      });
    }

    if (picked.template === "holiday_zh") {
      // holidays_2025.json: assume array of ISO dates or objects with date field.
      let arr = [];
      if (Array.isArray(data)) arr = data;
      else if (data && Array.isArray(data.list)) arr = data.list;

      const normalized = arr
        .map((x) => (typeof x === "string" ? x : x && x.date ? x.date : ""))
        .filter(Boolean)
        .slice(0, 10); // just show up to 10

      const ans =
        normalized.length > 0
          ? `2025 年部份紅日：\n- ${normalized.join("\n- ")}`
          : "暫時無法讀取 2025 紅日。";

      return ok({
        ok: true,
        flow: picked.id,
        template: picked.template,
        source: picked.source,
        answer: ans,
      });
    }

    // Fallback (should not hit)
    return ok({
      ok: false,
      flow: picked.id,
      template: picked.template,
      error: "unknown template",
    });
  } catch (e) {
    // Never 500 outwards
    return res.status(200).json({
      ok: false,
      fatal: String(e),
    });
  }
}
