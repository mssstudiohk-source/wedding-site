export default async function handler(req, res) {
  const q = String(req.query.q || req.query.question || "").trim();
  const text = (req.query.format || "").toLowerCase() === "text";
  if (!q) return res.status(200).send("請加 question，例如：過大禮");

  // …你現有的邏輯…
  return res.status(200).send("這是 sisi 端點回覆（示例）");
}
