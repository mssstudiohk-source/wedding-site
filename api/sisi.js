// api/sisi.js
export default async function handler(req, res) {
  const q = String(req.query.q || req.query.question || "");
  res.status(200).send(`✅ SISI endpoint alive. q=${q}`);
}
