// 在 /api/sisi.js 內部，紅日分支最後：
const r = await fetch(url, { cache: 'no-store' });
const txt = await r.text();

if (wantText) {
  return res.status(200).send(txt);
}
let json;
try { json = JSON.parse(txt); }
catch { json = { ok:true, answer: txt }; }  // lunar 回文字時都照樣返回
return res.status(200).json(json);
