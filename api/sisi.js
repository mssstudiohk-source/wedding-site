// api/sisi.js  — safe router, no 500s
export default async function handler(req, res) {
  const q = String(req.query.question || "").trim();
  const wantText =
    (req.query.format || "").toLowerCase() === "text" ||
    (req.headers.accept || "").includes("text/plain");

  const out = (payload) => {
    try {
      if (wantText) {
        res.setHeader("Content-Type", "text/plain; charset=utf-8");
        return res.status(200).send(String(payload.answer || payload.msg || ""));
      }
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      return res.status(200).json(payload);
    } catch (e) {
      // last-ditch fallback
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      return res.status(200).json({ ok: false, fatal: String(e) });
    }
  };

  try {
    if (!q) {
      return out({
        ok: true,
        msg: "🎉 API OK! 試 /api/sisi?question=過大禮&format=text",
      });
    }

    // ---- Holiday / 紅日 → 轉到 /api/lunar ----
    const isHoliday =
      /紅日|假期|holiday/i.test(q) ||
      String(req.query.flow || "").toLowerCase() === "holiday";

    if (isHoliday) {
      // 由字串或 ?date=YYYY-MM-DD 取日期
      const m = q.match(/(\d{4})[\/\-年](\d{1,2})[\/\-月](\d{1,2})/);
      const date =
        req.query.date ||
        (m
          ? `${m[1]}-${String(m[2]).padStart(2, "0")}-${String(m[3]).padStart(
              2,
              "0"
            )}`
          : "");

      const base = `https://${req.headers.host}`; // Vercel 正確域名
      const url =
        `${base}/api/lunar` +
        (date ? `?date=${encodeURIComponent(date)}` : "") +
        (wantText ? (date ? "&format=text" : "?format=text") : "");

      const r = await fetch(url, { cache: "no-store" });
      const txt = await r.text();

      if (wantText) return out({ ok: true, answer: txt });

      let json;
      try {
        json = JSON.parse(txt);
      } catch {
        json = { ok: true, answer: txt };
      }
      return out(json);
    }

    // ---- 其他流程（暫時關掉以免 500）----
    return out({
      ok: true,
      answer:
        "暫時支援：紅日（例如：紅日 2025-09-13 或加 ?date=2025-09-13）。其餘流程稍後再開。",
    });
  } catch (e) {
    // 永不 500：任何錯誤都回 200
    return out({ ok: false, fatal: String(e) });
  }
}
