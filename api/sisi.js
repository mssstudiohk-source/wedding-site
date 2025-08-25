export default async function handler(req, res) {
  try {
    // 允許 GET ?question= 或 POST {question, user}
    let question = req.query.question;
    if (!question && req.method === "POST") {
      const body = await readJson(req);
      question = body?.question;
    }
    if (!question) {
      return res.status(400).json({ ok: false, error: "Missing 'question'." });
    }

    //（可選）從用戶傳入的上下文，例如地區/月份等
    const user = (req.method === "POST" ? (await readJson(req))?.user : null) || {};

    // 語氣／風格（你可以在這裡長期調整）
    const systemPrompt =
      "你係婚禮AI顧問Sisi，用淺白中文、專業溫和語氣。" +
      "回答先給重點摘要（最多5點），需要時再問要不要詳細版；" +
      "適時提供2–3個可選方案；如涉及供應商，先給一般建議。";

    // 調 OpenAI
    const resp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",       // 省成本、足夠對答
        temperature: 0.4,           // 穩定少離題
        max_tokens: 500,            // 控制成本
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content:
              `使用者問題：${question}\n` +
              `（可用上下文：${JSON.stringify(user)}）`
          }
        ]
      })
    });

    if (!resp.ok) {
      const txt = await resp.text();
      return res.status(500).json({ ok: false, error: "OpenAI error", detail: txt });
    }

    const data = await resp.json();
    const answer = data.choices?.[0]?.message?.content?.trim() || "（沒有回覆）";

    return res.status(200).json({
      ok: true,
      answer,
      meta: { model: "gpt-4o-mini" }
    });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err?.message || "Server error" });
  }
}

// 小工具：讀取 JSON body（避免多次讀取）
async function readJson(req) {
  if (req._json) return req._json;
  const chunks = [];
  for await (const c of req) chunks.push(c);
  try { req._json = JSON.parse(Buffer.concat(chunks).toString("utf-8")); }
  catch { req._json = null; }
  return req._json;
}
