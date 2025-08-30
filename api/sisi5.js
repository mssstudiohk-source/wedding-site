// 極簡、永不 500 的 smoke 版本
export default function handler(req, res) {
  const wantText = (req.query.format || "").toLowerCase() === "text";
  const answer = "🎉 API OK！試 /api/sisi?question=過大禮&format=text";
  if (wantText) {
    res.setHeader("Content-Type","text/plain; charset=utf-8");
    return res.status(200).send(answer);
  }
  return res.status(200).json({ ok: true, answer });
}
