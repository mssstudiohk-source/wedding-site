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
    const diag = url.searchParams.get('diag');

    // 1) env 檢查
    if (!SUPA_URL || !SUPA_KEY) {
      const payload = {
        ok: false,
        error: 'env-missing',
        hint: 'SUPABASE_URL / SUPABASE_ANON_KEY is required.',
        has_url: !!SUPA_URL, has_key: !!SUPA_KEY
      };
      return wantText ? res.status(200).send(JSON.stringify(payload, null, 2))
                      : res.status(200).json(payload);
    }
    if (!date) {
      const msg = 'date is required (YYYY-MM-DD). 例：/api/lunar?date=2025-09-13&format=text';
      return wantText ? res.status(200).send(msg) : res.status(200).json({ ok:false, error: msg });
    }

    // 2) 先查當日；無 → 用最近之後一日（全年都有就一定命中）
    let { data: day, error } = await supa
      .from('lunar_days')
      .select('*')
      .eq('date', date)
      .maybeSingle();

    if (!error && !day) {
      const { data: nextRows, error: nextErr } = await supa
        .from('lunar_days')
        .select('*')
        .gte('date', date)
        .order('date', { ascending: true })
        .limit(1);
      if (!nextErr && nextRows && nextRows.length) day = nextRows[0];
    }

    if (diag) {
      return res.status(200).json({
        ok: !!day, query_date: date, used_date: day?.date || null,
        supabase_error: error?.message || null
      });
    }

    if (!day) {
      const msg = `找不到 ${date} 的通勝記錄。`;
      return wantText ? res.status(200).send(msg) : res.status(200).json({ ok:true, empty:true, date });
    }

    // 3) （可選）嘗試取該日的時辰（未入就算，絕不報錯）
    let hours = [];
    try {
      const { data: hrs } = await supa
        .from('lunar_hours')
        .select('hour_zhi,slot,time_range,good_for_main,avoid_main,ord')
        .eq('date', day.date)
        .order('ord', { ascending: true })
        .limit(3);
      hours = Array.isArray(hrs) ? hrs : [];
    } catch { /* ignore if table not ready */ }

    // 4) 格式化輸出
    if (wantText) {
      const lines = [
        `📅 要求：${date}${day.date !== date ? ` → 使用：${day.date}` : ''}`,
        day.wu_xing ? `五行：${day.wu_xing}` : '',
        day.day_officer ? `十二神：${day.day_officer}` : '',
        day.day_conflict ? `沖煞：${day.day_conflict}` : '',
        day.star_god ? `星神：${day.star_god}` : '',
        day.good_for_main?.length ? `✅ 宜（主）：${day.good_for_main.join('、')}` : '',
        day.avoid_main?.length ? `⛔ 忌（主）：${day.avoid_main.join('、')}` : '',
        day.jishen_yiqu_main?.length ? `吉神：${day.jishen_yiqu_main.join('、')}` : '',
        day.xiongsha_yiji_main?.length ? `凶煞：${day.xiongsha_yiji_main.join('、')}` : '',
        day.notes ? `備註：${day.notes}` : '',
        hours.length ? '\n🕒 部分時辰：' : ''
      ].filter(Boolean);

      if (hours.length) {
        const hourLines = hours.map(h => {
          const good = (h.good_for_main||[]).join('、') || '—';
          const avoid = (h.avoid_main||[]).join('、') || '—';
          return `・${h.time_range}（${h.hour_zhi}${h.slot==='early'?'·初':h.slot==='late'?'·正':''}）｜宜：${good}｜忌：${avoid}`;
        });
        lines.push(...hourLines);
      }

      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      return res.status(200).send(lines.join('\n'));
    }

    // JSON
    return res.status(200).json({
      ok: true,
      query_date: date,
      used_date: day.date,
      day,
      hours_preview: hours
    });

  } catch (e) {
    return res.status(200).json({ ok:false, fatal: String(e?.stack || e) });
  }
}
