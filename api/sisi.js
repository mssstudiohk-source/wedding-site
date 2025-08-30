// 例：組 URL 時按用戶要不要純文字
const wantText = (req.query.format || '').toLowerCase() === 'text';
const d = '2025-09-13'; // 你實際係由 question 解析出日期
const url = `${process.env.VERCEL_URL ? 'https://' + req.headers.host : ''}/api/lunar?date=${d}${wantText ? '&format=text' : ''}`;

const r = await fetch(url, { cache: 'no-store' });
const txt = await r.text();

if (wantText) {
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  return res.status(200).send(txt);
}

// 想要 JSON：先嘗試 parse，不得就包返落 answer
let json;
try { json = JSON.parse(txt); }
catch { json = { ok: true, answer: txt }; }

return res.status(200).json(json);
