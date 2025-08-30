// api/lunar.js
// 代替你現有的 client 建立方式
import { createClient } from '@supabase/supabase-js';

const SUPA_URL = process.env.SUPABASE_URL || '';
const SRV_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const ANON_KEY = process.env.SUPABASE_ANON_KEY || '';
const supa = createClient(SUPA_URL, SRV_KEY || ANON_KEY, {
  auth: { persistSession: false }
});

export default async function handler(req, res) {
  try {
    const url = new URL(req.url, `https://${req.headers.host}`);
    const date = (url.searchParams.get('date') || '').slice(0, 10);
    const mode = (url.searchParams.get('mode') || '').toLowerCase(); // 'diag' 可見更多
    const wantText =
      (url.searchParams.get('format') || '').toLowerCase() === 'text' ||
      (req.headers.accept || '').includes('text/plain');

    // 0) env
    if (!SUPA_URL || !SUPA_KEY) {
      const payload = {
        ok: false, error: 'env-missing',
        has_url: !!SUPA_URL, has_key: !!SUPA_KEY
      };
      return out(res, payload, wantText);
    }
    if (!date) {
      return out(res, { ok:false, error: "date is required (YYYY-MM-DD)" }, wantText);
    }

    // 1) 表是否存在 + 範圍
    const meta = {};
    try {
      const { data: exists } = await supa.rpc('pg_table_is_visible', { relname: 'lunar_days' }); // 可能在某些環境不可用
      meta.table_visible = exists ?? null;
    } catch { meta.table_visible = null; }

    const { data: rangeRows, error: rangeErr } = await supa
      .from('lunar_days')
      .select('date')
      .order('date', { ascending: true })
      .limit(1);

    const { data: rangeRows2 } = await supa
      .from('lunar_days')
      .select('date')
      .order('date', { ascending: false })
      .limit(1);

    meta.min_date = (rangeRows && rangeRows[0]?.date) || null;
    meta.max_date = (rangeRows2 && rangeRows2[0]?.date) || null;
    meta.range_error = rangeErr?.message || null;

    // 2) 查當日
    let day = null;
    let errMsg = null;

    const exact = await supa.from('lunar_days').select('*').eq('date', date).maybeSingle();
    if (exact.error) errMsg = exact.error.message;
    if (exact.data) day = exact.data;

    // 3) 無 → 查最近之後一日
    if (!day) {
      const next = await supa
        .from('lunar_days')
        .select('*')
        .gte('date', date)
        .order('date', { ascending: true })
        .limit(1);
      if (next.error) errMsg = errMsg || next.error.message;
      if (next.data && next.data.length) day = next.data[0];
    }

    // 4) 診斷模式
    if (mode === 'diag') {
      return out(res, {
        ok: !!day,
        query_date: date,
        used_date: day?.date || null,
        error: errMsg,
        meta
      }, false); // 診斷用 JSON
    }

    // 5) 正常輸出
    if (!day) {
      return out(res, { ok:true, empty:true, query_date: date, hint:"Check env URL/key & table name." }, wantText);
    }

    if (wantText) {
      const lines = [
        `📅 要求：${date}${day.date !== date ? ` → 使用：${day.date}` : ''}`,
        day.wu_xing ? `五行：${day.wu_xing}` : '',
        day.day_officer ? `十二神：${day.day_officer}` : '',
        day.day_conflict ? `沖煞：${day.day_conflict}` : '',
        day.star_god ? `星神：${day.star_god}` : '',
        day.good_for_main?.length ? `✅ 宜（主）：${day.good_for_main.join('、')}` : '',
        day.avoid_main?.length ? `⛔ 忌（主）：${day.avoid_main.join('、')}` : '',
      ].filter(Boolean);
      return out(res, { ok:true, answer: lines.join('\n') }, true);
    }

    return out(res, { ok:true, query_date: date, used_date: day.date, day }, false);

  } catch (e) {
    return out(res, { ok:false, fatal: String(e) }, false);
  }
}

function out(res, payload, asText) {
  if (asText) {
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    return res.status(200).send(String(payload.answer || JSON.stringify(payload)));
  }
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  return res.status(200).json(payload);
}
