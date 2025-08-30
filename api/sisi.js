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
  if (/(紅日|公眾假期|通勝|擇日)/.test(q)) {
    const date = (q.match(/\d{4}-\d{2}-\d{2}/) || [])[0];
    if (!date) {
      const msg = '請講清楚日期：例如「紅日 2025-09-09」';
      return wantText ? res.status(200).send(msg) : res.status(200).json({ ok: true, msg });
    }
    const base = `${req.headers['x-forwarded-proto'] || 'https'}://${req.headers.host}`;
    const r = await fetch(`${base}/api/lunar?date=${date}${wantText ? '&format=text' : ''}`, { cache: 'no-store' });
    const txt = await r.text();
    return wantText ? res.status(200).send(txt) : res.status(200).json(JSON.parse(txt));
  }

  // 3) 化妝師（之後接 vendors 表）
  if (/(化妝師|MUA)/i.test(q)) {
    const msg = '化妝師查詢準備接 Supabase（下一步）';
    return wantText ? res.status(200).send(msg) : res.status(200).json({ ok: true, msg });
  }

  const msg = '未識別呢個問題，可試：過大禮 / 紅日 2025-09-09 / 搵化妝師';
  return wantText ? res.status(200).send(msg) : res.status(200).json({ ok: true, msg });
}
