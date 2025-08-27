// /api/lunar.js
import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  try {
    const { date, format, pretty } = req.query; // format=text 可回純文字；pretty=1 美化 JSON
    if (!date) return res.status(400).json({ ok:false, error:'missing ?date=YYYY-MM-DD' });

    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_KEY;
    if (!url) return res.status(500).json({ ok:false, error:'SUPABASE_URL is required' });
    if (!key) return res.status(500).json({ ok:false, error:'SUPABASE_ANON_KEY (or SUPABASE_KEY) is required' });

    const supabase = createClient(url, key);

    const day = await supabase.from('days').select('*').eq('date', date).single();
    if (day.error) return res.status(502).json({ ok:false, where:'days', error:plain(day.error) });

    const hours = await supabase.from('hours').select('*').eq('date', date).order('branch');
    if (hours.error) return res.status(502).json({ ok:false, where:'hours', error:plain(hours.error) });

    const d = day.data || {};
    const h = (hours.data || []).filter(x => x && x.branch);

    // ---- 格式化文字 ----
    const yiji = (arr) => (arr && arr.length ? arr.join('、') : '—');
    const hrLine = (r) => `${r.branch}時（${r.time_range}）：${r.luck}${r.yi?.length ? `｜宜：${r.yi.join('、')}` : ''}${r.ji?.length ? `｜忌：${r.ji.join('、')}` : ''}${r.note ? `｜備註：${r.note}` : ''}`;
    const lines = [
      `${date}（${d.day_stem_branch || '—'}日）`,
      `宜：${yiji(d.yi)}　忌：${yiji(d.ji)}`,
      d.notes ? `備註：${d.notes}` : null,
      h.length ? '吉時概要：' : null,
      ...h.map(hrLine)
    ].filter(Boolean);

    const summary = lines.join('\n');

    // 如要求純文字
    if ((format || '').toLowerCase() === 'text') {
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      return res.status(200).send(summary);
    }

    // 預設回 JSON（有 summary + 原始資料）
    const payload = { ok:true, date, summary, day: d, hours: h };
    return res
      .status(200)
      .send(pretty ? JSON.stringify(payload, null, 2) : payload);

  } catch (e) {
    return res.status(500).json({ ok:false, error: e?.message || String(e) });
  }
}

function plain(err) {
  return { message: err.message, details: err.details || null, hint: err.hint || null, code: err.code || null, status: err.status || null };
}
