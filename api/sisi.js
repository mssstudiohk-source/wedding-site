// api/sisi.js（示意）— 你已有 working 版本，只係示範 router 位
export default async function handler(req, res) {
  const q = String(req.query.question || '').trim();
  const wantText =
    (req.query.format || '').toLowerCase() === 'text' ||
    (req.headers.accept || '').includes('text/plain');

  if (!q) {
    const msg = '可以問：過大禮、紅日（加 &format=text 會分行）';
    return wantText ? res.status(200).send(msg) : res.status(200).json({ ok: true, msg });
  }

  // 1) 傳統
  if (/(過大禮|安床|上頭|回門)/.test(q)) {
    // 你現時的 JSON 讀取＋模板已經 work，沿用即可
    // return res.status(200).json({ ... });
  }

  // 2) 紅日/通勝（轉 call /api/lunar）
// 只示範紅日分支，放入你現有的 /api/sisi.js 內
if (/(紅日|公眾假期|通勝|擇日)/.test(q)) {
  // 取 YYYY-MM-DD
  const m = q.match(/\d{4}-\d{2}-\d{2}/);
  if (!m) {
    const msg = '請講清楚日期，例如「紅日 2025-09-09」';
    return wantText ? res.status(200).send(msg) : res.status(200).json({ ok: true, msg });
  }
  const date = m[0];

  // 構造本域名 URL（Vercel 下可靠）
  const origin = new URL(req.url, `https://${req.headers.host}`).origin;
  const url = `${origin}/api/lunar?date=${date}${wantText ? '&format=text' : ''}`;

  const r = await fetch(url, { cache: 'no-store' });
  const text = await r.text();

  // /api/lunar 已經「永不 500」，你可以直接轉發
  return wantText ? res.status(200).send(text) : res.status(200).json(JSON.parse(text));
}
