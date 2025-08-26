// 由 b.js 複製而來，只改少少邏輯
export default async function handler(req, res) {
  try {
    const h = req && req.headers ? req.headers : {};
    const proto = String(h["x-forwarded-proto"] || "https").split(",")[0];
    const host  = String(h["x-forwarded-host"]  || h.host || "").split(",")[0];
    const base  = (proto ? proto : "https") + "://" + host;

    // 讀取 query 或 POST body 的 question
    let question = "";
    if (req.method === "POST") {
      try {
        const bufs = []; for await (const c of req) bufs.push(c);
        const body = JSON.parse(Buffer.concat(bufs).toString("utf8") || "{}");
        question = String(body.question || "");
      } catch {}
    } else {
      question = String((req.query && req.query.question) || "");
    }
    question = question.trim();

    // 無 question → 回用法 + 測試位址（延續 b.js 的 safe style）
    if (!question) {
      const url = base + "/rules/traditions.json";
      return res.status(200).json({
        ok: true, ver: "sisi3-v1",
        base, url,
        tip: "加 ?question=過大禮 / 2025-09-09 / 有咩婚禮形式；或 ?test=1 測讀檔"
      });
    }

    // 保留原本的 test=1 測試通道
    if (req.query && req.query.test === "1") {
      const url = base + "/rules/traditions.json";
      const r   = await fetch(url, { cache: "no-store" });
      const txt = await r.text();
      try {
        const j = JSON.parse(txt);
        const keys = Object.keys(j).slice(0, 5);
        return res.status(200).json({ ok: r.ok, ver:"sisi3-v1", base, url, status: r.status, kind: "object", keys });
      } catch (e) {
        return res.status(200).json({ ok: r.ok, ver:"sisi3-v1", base, url, status: r.status, parseError: String(e), preview: txt.slice(0,160) });
      }
    }

    // ====== 真正對答：只載需要的 JSON ======

    // 1) 固定答案：過大禮 / 安床 / 回門
    if (question.includes("過大禮") || question.includes("安床") || question.includes("回門")) {
      const url = base + "/rules/traditions.json";
      const r   = await fetch(url, { cache: "no-store" });
      const txt = await r.text();
      try {
        const j = JSON.parse(txt);
        const key = ["過大禮","安床","回門"].find(k => question.includes(k));
        const t = j[key] || {};
        const details = Array.isArray(t.details) && t.details.length ? ("\n- " + t.details.join("\n- ")) : "";
        const notes   = t.notes ? ("\n\n備註：" + t.notes) : "";
        return res.status(200).json({ ok: true, answer: 重點：${t.summary || ""}${details}${notes} });
      } catch (e) {
        return res.status(200).json({ ok:false, where:"traditions-parse", error:String(e), preview: txt.slice(0,160) });
      }
    }

    // 2) 紅日 / 特別日（支援 YYYY-MM-DD）
    const m = question.match(/\d{4}-\d{2}-\d{2}/);
    if (question.includes("紅日") || question.includes("假期") || m) {
      const date = m ? m[0] : null;
      const urlH = base + "/rules/holidays_2025.json";
      const urlS = base + "/rules/special_days.json";
      const [rH, rS] = await Promise.all([
        fetch(urlH, { cache: "no-store" }),
        fetch(urlS, { cache: "no-store" }),
      ]);
      const [tH, tS] = [await rH.text(), await rS.text()];
      let H = [], S = [];
      try { H = JSON.parse(tH); } catch {}
      try { S = JSON.parse(tS); } catch {}

      if (date) {
        const flags = [
          ...(Array.isArray(H) ? H.filter(x => x.date === date) : []),
          ...(Array.isArray(S) ? S.filter(x => x.date === date) : []),
        ];
        const ans = flags.length
          ? ${date}： + flags.map(f => ${f.label}（${f.kind}${f.note ? "｜" + f.note : ""}）).join("、")
          : ${date} 非已知公眾假期/特別日。;
        return res.status(200).json({ ok:true, answer: ans });
      }

      const list = Array.isArray(H) ? H.slice(0, 6).map(h => ${h.date} ${h.label}).join("\n") : "（假期資料未載入）";
      return res.status(200).json({ ok:true, answer: 2025 部分公眾假期：\n${list} });
    }

    // 3) 選項：婚禮形式
    if (question.includes("婚禮形式") || question.includes("有咩選擇")) {
      const url = base + "/rules/options_catalog.json";
      const r   = await fetch(url, { cache: "no-store" });
      const txt = await r.text();
      try {
        const j = JSON.parse(txt);
        const list = (j && j.wedding_types) ? j.wedding_types : [];
        return res.status(200).json({ ok:true, answer: 常見形式：${list.join("、")} });
      } catch (e) {
        return res.status(200).json({ ok:false, where:"options-parse", error:String(e), preview: txt.slice(0,160) });
      }
    }

    // 兜底
    return res.status(200).json({ ok:true, answer:"我可以幫你查：過大禮／安床／回門、2025 紅日／特別日、以及婚禮形式。想問邊一部分？" });

  } catch (e) {
    return res.status(200).json({ ok:false, ver:"sisi3-v1", fatal: String(e) });
  }
}
