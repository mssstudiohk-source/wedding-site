// api/zzz.js  — version ping（極簡、一定 200）
export default function handler(req, res) {
  res.status(200).json({
    ok: true,
    version: "zzz-v1",
    now: Date.now()
  });
}
