// api/sisi3.js  —— ZERO-依賴，可在任何 Vercel 預設環境跑
const TRADITIONS = {
  "過大禮": {
    summary: "常見物品：禮餅、雙喜酒、茶葉、紅棗蓮子、果籃、海味、四點金/五金（視家庭習俗）。",
    details: ["禮餅","雙喜酒/米酒","茶葉","紅棗、蓮子、桂圓、百合","果籃、海味","金飾（四點金/五金）"]
  },
  "安床": {
    summary: "揀吉日安床，換新床品，放添丁物；有時請小朋友跳床取添丁之意。",
    details: ["吉日安床","新床枕被","利是/紅封","添丁物品（如紅棗蓮子）"]
  },
  "回門": {
    summary: "婚後第三日或約定日回娘家，帶回門禮，與親友聚餐。",
    details: ["回門禮（糕餅/水果）","見長輩叩謝","合餐"]
  }
};

const HOLIDAYS_2025 = [
  { date:"2025-01-01", label:"元旦", kind:"public_holiday" },
  { date:"2025-01-29", label:"農曆新年初一", kind:"public_holiday" },
  { date:"2025-01-30", label:"農曆新年初二", kind:"public_holiday" },
  { date:"2025-01-31", label:"農曆新年初三", kind:"public_holiday" },
  { date:"2025-04-04", label:"清明節", kind:"public_holiday" },
  { date:"2025-12-25", label:"聖誕節", kind:"public_holiday" }
];

const SPECIAL_DAYS = [
  { date:"2025-08-04", label:"農曆七月開始", kind:"lunar7", note:"部分家庭避忌" },
  { date:"2025-09-09", label:"九九長長久久", kind:"lucky_number", note:"熱門喜日" },
  { date:"2025-05-17", label:"婚展日（示例）", kind:"expo", note:"人流多、供應商促銷" }
];

const OPTIONS = {
  wedding_types: ["中式","西式","戶外","混合"]
};

function findISO(text) {
  const m = (text||"").match(/\d{4}-\d{2}-\d{2}/);
  return m ? m[0] : null;
}

export default async function handler(req, res) {
  try {
    const q = (req.method === "POST"
      ? await readBody(req).then(b => b?.question || "")
      : (req.query.question || "")
    ).trim();

    if (!q) {
      return res.status(200).json({
        ok:true,
        tip:"試：/api/sisi3?question=過大禮 | 2025-09-09 | 有咩婚禮形式"
      });
    }

    // 1) 固定答案（過大禮/安床/回門）
    for (const key of Object.keys(TRADITIONS)) {
      if (q.includes(key)) {
        const t = TRADITIONS[key];
        const details = t.details?.length ? \n- ${t.details.join("\n- ")} : "";
        return res.status(200).json({ ok:true, answer:重點：${t.summary}${details} });
      }
    }

    // 2) 紅日 / 特別日
    const iso = findISO(q);
    if (q.includes("紅日") || q.includes("假期") || iso) {
      if (iso) {
        const flags = [
          ...HOLIDAYS_2025.filter(h => h.date === iso),
          ...SPECIAL_DAYS.filter(s => s.date === iso)
        ];
        const ans = flags.length
          ? ${iso}： + flags.map(f => ${f.label}（${f.kind}）).join("、")
          : ${iso} 非已知公眾假期/特別日。;
        return res.status(200).json({ ok:true, answer: ans });
      }
      return res.status(200).json({
        ok:true,
        answer: "2025 部分公眾假期：\n" + HOLIDAYS_2025.slice(0,6).map(h => ${h.date} ${h.label}).join("\n")
      });
    }

    // 3) 選項
    if (q.includes("婚禮形式") || q.includes("有咩選擇")) {
      return res.status(200).json({ ok:true, answer:常見形式：${OPTIONS.wedding_types.join("、")} });
    }

    // 4) 兜底
    return res.status(200).json({
      ok:true,
      answer:"我可以幫你查傳統、紅日、以及提供常見選項。試下：過大禮 / 2025-09-09 / 婚禮形式"
    });
  } catch (e) {
    // 極少機會到呢度，但都用200回應，避免白版500
    return res.status(200).json({ ok:false, error:String(e) });
  }
}

async function readBody(req) {
  if (req.method !== "POST") return null;
  const chunks = []; for await (const c of req) chunks.push(c);
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8")); } catch { return null; }
}
