// Node.js runtime（避免 Edge 限制）
export const config = { runtime: "nodejs" };

import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";
import templates from "../templates/templates.json" assert { type: "json" };

// Supabase 初始化
const supa = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

// Helper：render 簡單模板
function render(tpl, view) {
  return tpl.replace(/{{(\w+)}}/g, (_, k) => view[k] ?? "");
}

export default async function handler(req, res) {
  const q = String(req.query.question || "").trim();
  const wantText = (req.query.format || "").toLowerCase() === "text";

  // --- Traditions ---
  if (["過大禮", "安床", "上頭", "回門"].some(k => q.includes(k))) {
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const raw = await fs.readFile(path.join(__dirname, "../rules/traditions/traditions.json"), "utf-8");
    const data = JSON.parse(raw);

    const match = data.find(item => q.includes(item.keyword));
    if (!match) return res.status(200).json({ ok: false, answer: "未有相關資料" });

    const view = {
      summary_zh: match.summary_zh || "",
      details_zh: (match.details_zh || []).join("；"),
      notes_zh: match.notes_zh || ""
    };

    const answer = render(templates.tradition_zh, view);
    if (wantText) {
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      return res.status(200).send(answer);
    }
    return res.status(200).json({ ok: true, answer });
  }

  // --- Holidays ---
  if (["紅日", "公眾假期"].some(k => q.includes(k))) {
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const raw = await fs.readFile(path.join(__dirname, "../rules/dates/holidays_2025.json"), "utf-8");
    const data = JSON.parse(raw);

    const view = { holidays: data.map(d => ${d.date} ${d.name}).join("\n") };
    const answer = render(templates.holiday_zh, view);

    if (wantText) {
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      return res.status(200).send(answer);
    }
    return res.status(200).json({ ok: true, answer });
  }

  // --- Vendors（以化妝師示例，SQL 查數據） ---
  if (["化妝師","化粧師","MUA"].some(k => q.includes(k))) {
    // 1) 取頭 3 個化妝師
    const { data: vendors, error: vErr } = await supa
      .from("vendors")
      .select("id, name_zh, description, location, price_min, price_max, contact_ig, contact_website, priority, boost_level")
      .eq("type","makeup")
      .order("priority",{ ascending:false })
      .order("boost_level",{ ascending:false })
      .limit(3);
    if (vErr) return res.status(200).json({ ok:false, error:String(vErr) });

    // 2) 拉 featured 套餐
    const ids = vendors.map(v => v.id);
    const { data: packs } = await supa
      .from("vendor_packages")
      .select("vendor_id, name, price_hkd, sort_order")
      .in("vendor_id", ids)
      .eq("is_featured", true)
      .order("vendor_id",{ ascending:true })
      .order("sort_order",{ ascending:true })
      .order("price_hkd",{ ascending:true });

    // 3) 組 view → 套模板
    const cards = vendors.map(v => {
      const vp = (packs || []).filter(p=>p.vendor_id===v.id).slice(0,2);
      const view = {
        name: v.name_zh || "",
        description: v.description || "",
        price_range_hkd: (v.price_min && v.price_max) ? ${v.price_min}–${v.price_max} : "",
        location: v.location || "",
        contact_ig: v.contact_ig || "",
        contact_website: v.contact_website || "",
        packages: vp.map(p=>${p.name} — $${p.price_hkd}).join("\n")
      };
      return render(templates.vendor_card_zh, view);
    });

    const answer = cards.join("\n\n");
    if (wantText) {
      res.setHeader("Content-Type","text/plain; charset=utf-8");
      return res.status(200).send(answer);
    }
    return res.status(200).json({ ok:true, answer });
  }

  // --- Default 回覆 ---
  return res.status(200).json({ ok:true, answer:"可試『過大禮』『紅日』『搵化妝師』，或加 &format=text" });
}
