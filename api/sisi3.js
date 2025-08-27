// api/sisi3.js — minimal safe: 固定答案（過大禮/安床/回門）
export default async function handler(req, res) {
  try {
    // 取 base（https://你的域名）
    const h = req && req.headers ? req.headers : {};
    const p = String(h["x-forwarded-proto"] || "https").split(",")[0];
    const host = String(h["x-forwarded-host"] || h.host || "").split(",")[0];
    const base = (p ? p : "https") + "://" + host;

    // 取 question（GET 或 POST）
    let q = "";
    if (req.method === "POST") {
      try {
        const bufs = []; for await (const c of req) bufs.push(c);
        const body = JSON.parse(Buffer.concat(bufs).toString("utf8") || "{}");
        q = String(body.question || "");
      } catch {}
    } else {
      q = String((req.query && req.query.question) || "");
    }
    q = q.trim();

    // 無問題 → 回用法
    if (!q) {
      return res.status(200).json({
        ok: true,
        ver: "sisi3-min",
        tip: "加 ?question=過大禮 / 安床 / 回門"
      });
    }

    // 只讀 traditions.json（固定答案）
    const url = base + "/rules/traditions/traditions.json";
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

    // 解析 JSON
    let data = null;
    try {
      data = JSON.parse(txt);
    } catch (e) {
      return res.status(200).json({ ok: false, where: "parse", error: String(e), preview: txt.slice(0, 160) });
    }

// 命中關鍵字
const keys = ["過大禮", "安床", "上頭", "回門"];
const hit = keys.find(k => q.includes(k));
if (hit && data && typeof data === "object" && data[hit]) {
  const t = data[hit] || {};

  // 同時相容 _zh 及無後綴鍵
  const pick = (obj, key) => obj?.[key + "_zh"] ?? obj?.[key] ?? "";
  const pickList = (obj, key) =>
    Array.isArray(obj?.[key + "_zh"]) ? obj[key + "_zh"]
    : Array.isArray(obj?.[key])      ? obj[key]
    : [];

  const summary = pick(t, "summary");
  const detailsArr = pickList(t, "details");
  const notes = pick(t, "notes");

  const detailsTxt = detailsArr.length ? ("\n- " + detailsArr.join("\n- ")) : "";
  const notesTxt   = notes ? ("\n\n備註：" + notes) : "";

  return res.status(200).json({
    ok: true,
    answer: "重點：" + summary + detailsTxt + notesTxt
  });
}

    // 未命中 → 提示
    return res.status(200).json({
      ok: true,
      note: "暫時只支援：過大禮 / 安床 / 回門。可先試其中一個關鍵字。"
    });

  } catch (e) {
    // 永不 500：任何錯都以 200 回應
    return res.status(200).json({ ok: false, fatal: String(e) });
  }
}
if (req.query.debug) {
  return res.status(200).json({
    ok: true,
    steps: conversationFlow.steps || [],
    flows: replyFlow.flows || []
  });
}
