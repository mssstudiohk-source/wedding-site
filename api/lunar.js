// api/lunar.js  — Node ESM/Edge 都得
import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_ANON_KEY;
const supa = createClient(url, key);

export default async function handler(req, res) {
  try {
    const date = String(req.query.date || '').slice(0, 10); // YYYY-MM-DD
    const wantText =
      (req.query.format || '').toLowerCase() === 'text' ||
      (req.headers.accept || '').includes('text/plain');

    if (!date) {
      return res.status(200).json({ ok: false, error: 'date is required (YYYY-MM-DD)' });
    }

    const { data, error } = await supa
      .from('lunar_days')
      .select('*')
      .eq('date', date)
      .single();

    if (error) {
      return res.status(200).json({ ok: false, where: 'select', error: error.message });
    }

    if (!data) {
      return res.status(200).json({ ok: true, empty: true, date });
    }

    // text 輸出（更易讀）
    if (wantText) {
      const lines = [
        `📅 ${data.date}`,
        data.wu_xing ? `五行：${data.wu_xing}` : '',
        data.day_officer ? `十二神：${data.day_officer}` : '',
        data.day_conflict ? `沖煞：${data.day_conflict}` : '',
        data.star_god ? `星神：${data.star_god}` : '',
        data.good_for_main?.length ? `✅ 宜（主）：${data.good_for_main.join('、')}` : '',
        data.avoid_main?.length ? `⛔ 忌（主）：${data.avoid_main.join('、')}` : '',
        data.jishen_yiqu_main?.length ? `吉神：${data.jishen_yiqu_main.join('、')}` : '',
        data.xiongsha_yiji_main?.length ? `凶煞：${data.xiongsha_yiji_main.join('、')}` : '',
        data.notes ? `備註：${data.notes}` : '',
      ].filter(Boolean);

      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      return res.status(200).send(lines.join('\n'));
    }

    // JSON 輸出
    return res.status(200).json({ ok: true, date, day: data });
  } catch (e) {
    return res.status(200).json({ ok: false, fatal: String(e) });
  }
}
