// api/sisi3.js — 正式版：讀 /rules/*.json + 安全回覆（不會 500）

function originFrom(req) {
  const h = req && req.headers ? req.headers : {};
  const proto = String(h["x-forwarded-proto"] || "https").split(",")[0];
  const host  = String(h["x-forwarded-host"]  || h.host || "").split(",")[0];
  return (proto ? proto : "https") + "://" + host; // e.g. https://wedding-sisi-api.vercel.app
}

async function safeLoadJSON(url) {
  try {
    const r = await fetch(url, { cache: "no-store" });
    const txt = await r.text();
    if (!r.ok) {
      return { ok:false, status:r.status, preview: txt.slice(0,160), data:null };
    }
    try {
      const j = JSON.parse(txt);
      return { ok:true, status:r.status, data:j };
    } catch (e) {
      return { ok:false, status:r.status, parseError:String(e), preview: txt.slice(0,160), data:null };
    }
  } catch (e) {
    return { ok:false, status:0, fetchError:String(e), data:null };
  }
}

function findISO(s) {
  const m = (s || "").match(/\d{4}-\d{2}-\d{2}/);
  return m ? m[0] : null;
}

async function readBody(req) {
  if (req.method !== "POST") return null;
  const chunks = []; for await (const c of req) chunks.push(c);
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8")); } catch { return null; }
}

export default async function handler(req, res) {
  try {
    // 1) 取問題（GET ?question=… 或 POST {"question": "..."}）
    const q = (req.method === "POST"
      ? ((await readBody(req))?.question || "")
      : (req.query?.question || "")
    ).trim();

    const base = originFrom(req);
    const urlOf = (name) => ${base}/rules/${name};

    // 無問題 → 回用法提示 + 檔案位址
    if (!q) {
      return res.status(200).json({
        ok:true,
        tip: "試：/api/sisi3?question=過大禮 | 2025-09-09 | 有咩婚禮形式",
        files: {
          traditions: urlOf("traditions.json"),
          holidays:   urlOf("holidays_2025.json"),
          specials:   urlOf("special_days.json"),
          options:    urlOf("options_catalog.json")
        }
      });
    }

    // 2) 固定答案：先載 traditions.json（過大禮 / 安床 / 回門）
    const tr = await safeLoadJSON(urlOf("traditions.json"));
    if (tr.ok && tr.data && typeof tr.data === "object") {
      for (const key of Object.keys(tr.data)) {
        if (q.includes(key)) {
          const t = tr.data[key] || {};
          const details = Array.isArray(t.details) && t.details.length ? \n- ${t.details.join("\n- ")} : "";
          const notes   = t.notes ? \n\n備註：${t.notes} : "";
          return res.status(200).json({ ok:true, answer:重點：${t.summary || ""}${details}${notes} });
        }
      }
    }

    // 3) 紅日 / 特別日（支援輸入 YYYY-MM-DD）
    const iso = findISO(q);
    if (q.includes("紅日") || q.includes("假期") || iso) {
      const [hol, sp] = await Promise.all([
        safeLoadJSON(urlOf("holidays_2025.json")),
        safeLoadJSON(urlOf("special_days.json"))
      ]);

      if (iso) {
        const hs = Array.isArray(hol.data) ? hol.data.filter(x => x.date === iso) : [];
        const ss = Array.isArray(sp.data)  ? sp.data.filter(x => x.date === iso) : [];
        const flags = [...hs, ...ss];
        const ans = flags.length
          ? ${iso}： + flags.map(f => ${f.label}（${f.kind}${f.note ? "｜" + f.note : ""}）).join("、")
          : ${iso} 非已知公眾假期/特別日。;
        return res.status(200).json({
          ok:true,
          answer: ans,
          meta: { holidays_status: hol.status, specials_status: sp.status }
        });
      }

      const list = Array.isArray(hol.data)
        ? hol.data.slice(0, 6).map(h => ${h.date} ${h.label}).join("\n")
        : "（假期資料未載入）";
      return res.status(200).json({ ok:true, answer:2025 部分公眾假期：\n${list} });
    }

    // 4) 常見選項（婚禮形式）
    if (q.includes("婚禮形式") || q.includes("有咩選擇")) {
      const op = await safeLoadJSON(urlOf("options_catalog.json"));
      const list = op.data?.wedding_types || [];
      return res.status(200).json({ ok:true, answer:常見形式：${list.join("、")} });
    }

    // 5) 兜底（將來未命中再接 OpenAI）
    return res.status(200).json({
      ok:true,
      answer:"我可以幫你查：過大禮／安床／回門、2025 紅日／特別日、以及婚禮形式。想問邊一部分？"
    });

  } catch (e) {
    // 安全兜底：任何例外都以 200 回應，避免白板 500
    return res.status(200).json({ ok:false, error:String(e) });
  }
}
