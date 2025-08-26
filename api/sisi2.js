// api/sisi2.js — 模板式回覆（支援 tone: formal / casual / concise）
export default async function handler(req, res) {
  try {
    // 1) base
    const h = req && req.headers ? req.headers : {};
    const p = String(h["x-forwarded-proto"] || "https").split(",")[0];
    const host = String(h["x-forwarded-host"] || h.host || "").split(",")[0];
    const base = (p ? p : "https") + "://" + host;

    // 2) 讀 question + tone
    let q = "", tone = "";
    if (req.method === "POST") {
      try {
        const bufs = []; for await (const c of req) bufs.push(c);
        const body = JSON.parse(Buffer.concat(bufs).toString("utf8") || "{}");
        q = String(body.question || "");
        tone = String(body.tone || "");
      } catch {}
    } else {
      q = String((req.query && req.query.question) || "");
      tone = String((req.query && req.query.tone) || "");
    }
    q = q.trim();
    tone = (tone || "formal").toLowerCase(); // 預設 formal

    // 3) 無問題 → 用法
    if (!q) {
      return res.status(200).json({
        ok: true,
        tip: "例子：/api/sisi2?question=安床&tone=casual",
        tones: ["formal", "casual", "concise"]
      });
    }

    // 4) 只處理 traditions（過大禮 / 安床 / 回門）
    const url = base + "/rules/traditions.json";
    let txt = "";
    try {
      const r = await fetch(url, { cache: "no-store" });
      txt = await r.text();
      if (!r.ok) {
        return res.status(200).json({ ok: false, where: "fetch", status: r.status, preview: txt.slice(0, 160) });
      }
    } catch (e) {
      return res.status(200).json({ ok: false, where: "fetch", error: String(e) });
    }

    let data = null;
    try { data = JSON.parse(txt); }
    catch (e) {
      return res.status(200).json({ ok: false, where: "parse", error: String(e), preview: txt.slice(0, 160) });
    }

    const keys = ["過大禮", "安床", "回門"];
    const hit = keys.find(k => q.includes(k));
    if (!hit || !data || typeof data !== "object" || !data[hit]) {
      return res.status(200).json({
        ok: true,
        note: "暫時支援：過大禮 / 安床 / 回門。可用 ?tone=casual/formal/concise 揀語氣。"
      });
    }

    const t = data[hit] || {};
    const summary = String(t.summary || "");
    const details = Array.isArray(t.details) ? t.details.filter(Boolean) : [];
    const notes = String(t.notes || "");

    // 5) 用模板生字（選 tone）
    const makeFormal = () => {
      const lines = [];
      lines.push("【" + hit + "重點】" + summary);
      if (details.length) {
        lines.push("步驟／準備：");
        details.forEach((d, i) => lines.push((i + 1) + ". " + d));
      }
      if (notes) lines.push("備註：" + notes);
      return lines.join("\n");
    };

    const makeCasual = () => {
      const lines = [];
      lines.push("簡單講，" + hit + "可以咁做：");
      if (details.length) details.forEach((d, i) => lines.push((i + 1) + ". " + d));
      if (notes) lines.push("小貼士：" + notes);
      return lines.join("\n");
    };

    const makeConcise = () => {
      const head = hit + "關鍵：" + summary;
      const tail = details.length ? "（要點：" + details.slice(0, 3).join("、") + "）" : "";
      return head + tail;
    };

    let answer = "";
    if (tone === "casual") answer = makeCasual();
    else if (tone === "concise") answer = makeConcise();
    else answer = makeFormal(); // default formal

    // 6) 回 structured + answer（前端更易用）
    return res.status(200).json({
      ok: true,
      tone,
      title: hit,
      structured: {
        title: hit,
        summary,
        details,
        notes
      },
      answer
    });

  } catch (e) {
    return res.status(200).json({ ok: false, fatal: String(e) });
  }
}
