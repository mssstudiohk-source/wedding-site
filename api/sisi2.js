// api/sisi2.js  —— ultra-safe diagnostics
export default async function handler(req, res) {
  try {
    const result = { ok: true, v: "sisi2-0", steps: [] };

    // step A: route is alive
    result.steps.push({ step: "A", msg: "route alive", ts: Date.now() });

    // step B: env present?
    const base = process.env.RULES_BASE_URL || null;
    result.steps.push({ step: "B", base_present: !!base, base });

    // if just ping
    const q = (req.query.question || "").trim();
    if (!q) {
      return res.status(200).json({
        ...result,
        tip: "try /api/sisi2?question=__status 或 /api/sisi2?question=過大禮"
      });
    }

    // step C: __status → 只測 traditions.json 是否可讀
    if (q === "__status") {
      if (!base) {
        result.steps.push({ step: "C", error: "RULES_BASE_URL missing" });
        return res.status(200).json(result);
      }
      const url = base.replace(/\/$/, "") + "/traditions.json";
      try {
        const r = await fetch(url, { cache: "no-store" });
        const text = await r.text();
        let kind = "unknown";
        let keys = [];
        try {
          const j = JSON.parse(text);
          kind = Array.isArray(j) ? "array" : typeof j;
          keys = kind === "object" ? Object.keys(j).slice(0, 5) : [];
        } catch (e) {
          // keep text preview for debugging
        }
        result.steps.push({
          step: "C",
          url,
          status: r.status,
          ok: r.ok,
          kind,
          keys,
          preview: (text || "").slice(0, 120)
        });
        return res.status(200).json(result);
      } catch (e) {
        result.steps.push({ step: "C", fetch_error: String(e) });
        return res.status(200).json(result);
      }
    }

    // step D: 固定答案（過大禮/安床/回門）—安全模式
    if (!base) {
      result.steps.push({ step: "D", error: "RULES_BASE_URL missing" });
      return res.status(200).json(result);
    }
    const url = base.replace(/\/$/, "") + "/traditions.json";
    let traditions = null;
    try {
      const r = await fetch(url, { cache: "no-store" });
      const t = await r.text();
      result.steps.push({ step: "D1", status: r.status, ok: r.ok, preview: t.slice(0, 120) });
      if (r.ok) {
        try { traditions = JSON.parse(t); } catch {}
      }
    } catch (e) {
      result.steps.push({ step: "D1", fetch_error: String(e) });
    }

    if (traditions && typeof traditions === "object") {
      for (const key of Object.keys(traditions)) {
        if ((req.query.question || "").includes(key)) {
          const t = traditions[key] || {};
          const details = Array.isArray(t.details) && t.details.length ? \n- ${t.details.join("\n- ")} : "";
          return res.status(200).json({
            ...result,
            v: "sisi2-1",
            answer: 重點：${t.summary || ""}${details}
          });
        }
      }
      return res.status(200).json({
        ...result,
        v: "sisi2-1",
        info: "traditions loaded but keyword not matched",
        known_keys: Object.keys(traditions).slice(0, 5)
      });
    } else {
      return res.status(200).json({
        ...result,
        v: "sisi2-1",
        error: "traditions not loaded or not an object"
      });
    }
  } catch (e) {
    // 永不 500：即使致命錯誤都用 200 回錯誤字串
    return res.status(200).json({ ok: false, v: "sisi2-fatal", error: String(e) });
  }
}
