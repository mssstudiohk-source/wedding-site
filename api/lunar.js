// api/lunar.js
import { createClient } from '@supabase/supabase-js';

const SUPA_URL = process.env.SUPABASE_URL || '';
const SUPA_KEY = process.env.SUPABASE_ANON_KEY || '';

const supa = (SUPA_URL && SUPA_KEY) ? createClient(SUPA_URL, SUPA_KEY) : null;

export default async function handler(req, res) {
  try {
    const url = new URL(req.url, `https://${req.headers.host}`);
    const date = (url.searchParams.get('date') || '').slice(0, 10);
    const wantText =
      (url.searchParams.get('format') || '').toLowerCase() === 'text' ||
      (req.headers.accept || '').includes('text/plain');
    const diag = url.searchParams.get('diag'); // ?diag=1 時會輸出診斷

    // 環境變數檢查
    if (!SUPA_URL || !SUPA_KEY) {
      const payload = {
        ok: false,
        error: 'env-missing',
        hint: 'SUPABASE_URL / SUPABASE_ANON_KEY is required.',
        has_url: !!SUPA_URL,
        has_key: !!SUPA_KEY
      };
      return wantText ? res.status(200).send(JSON.stringify(payload, null, 2))
                      : res.status(200).json(payload);
    }

    if (!date) {
      const msg = 'date is required (YYYY-MM-DD). e.g. /api/lunar?date=2025-09-09&format=text';
      return wantText ? res.status(200).send(msg) : res.status(200).json({ ok: false, error: msg });
    }

    // 連 Supabase（RLS 關閉或 policy 允許）
    const { data, error } = await supa
      .from('lunar_days')
      .select('*')
      .eq('date', date)
      .maybeSingle();

    if (diag) {
      // 診斷輸出：幫你睇到實際錯處
      return res.status(200).json({
        ok: !error,
        env_ok: !!(SUPA_URL && SUPA_KEY),
        date,
        supabase_error: error?.message || null,
        row_found: !!data
      });
    }

    if (error) {
      return res.status(200).json({
        ok: false,
        where: 'select lunar_days',
        error: error.message
      });
    }

    if (!data) {
      return wantText
        ? res.status(200).send(`找不到 ${date} 的通勝資料。`)
        : res.status(200).json({ ok: true, empty: true, date });
    }

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

    return res.status(200).json({ ok: true, date, day: data });
  } catch (e) {
    // 永不 500：一律 200 回應詳細錯處，方便你 debug
    return res.status(200).json({ ok: false, fatal: String(e?.stack || e) });
  }
}
