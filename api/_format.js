// 統一排版：所有 \n、emoji 都放呢度，sisi.js 乾淨好多
export const fmt = {
  tradition(item, title = "重點") {
    const s = item?.summary_zh || item?.summary || "";
    const details = Array.isArray(item?.details_zh || item?.details) ? item.details_zh || item.details : [];
    const notes = item?.notes_zh || item?.notes || "";
    const body =
      (details.length ? `🧾 細節：\n${details.map((x, i) => `  ${i + 1}. ${x}`).join("\n")}\n` : "") +
      (notes ? `📝 備註：${notes}\n` : "");
    return `📌 ${title}：${s}\n${body}`.trim();
  },

  holiday(rows) {
    if (!rows?.length) return "暫時未有假期資料。";
    const lines = rows.map((d, i) => `${i + 1}. ${d.date}－${d.name}`);
    return `📅 近期假期：\n${lines.join("\n")}`;
  },

  vendorCards(vendors) {
    if (!vendors?.length) return "暫時未有相符的供應商。";
    return vendors.map((v, idx) => {
      const services = Array.isArray(v.services) ? `\n□ 服務：\n${v.services.map((s,i)=>`   ${i+1}. ${s}`).join("\n")}` : "";
      const price = v.price_min || v.price_max ? `\n💰 價格：${v.price_min ?? ""}${v.price_min && v.price_max ? "–" : ""}${v.price_max ?? ""}` : "";
      const pics = Array.isArray(v.cover_photos) && v.cover_photos.length ? `\n🖼️ 圖片：${v.cover_photos.slice(0,3).join(" | ")}` : "";
      return `#${idx+1}  **${v.name_zh || v.name_en}**${services}${price}\n📍 ${v.location_city || ""} ${v.location_district || ""}${pics}`.trim();
    }).join("\n\n");
  },

  hour(row){
    // 給擇日/時辰用的單行格式
    const good = (row.good_for_main||[]).join("、");
    const avoid = (row.avoid_main||[]).join("、");
    return `🕒 ${row.time_range}（${row.hour_zhi}）\n宜：${good||"—"}｜忌：${avoid||"—"}`;
  }
};
