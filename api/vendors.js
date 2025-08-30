import { supabase } from "./_db";
import { fmt } from "./_format";

export default async function handler(req, res){
  try{
    const { type="makeup", city="", limit="10", format } = req.query;
    const asText = (format||"").toLowerCase()==="text";

    const { data: vendors, error } = await supabase
      .from("vendors")
      .select("id,name_zh,name_en,services,price_min,price_max,location_city,location_district,priority")
      .eq("type", type)
      .order("priority",{ascending:false})
      .limit(Number(limit||10));
    if(error) throw error;

    // 取封面
    const ids = (vendors||[]).map(v=>v.id);
    let coverMap = {};
    if(ids.length){
      const { data: photos } = await supabase
        .from("vendor_photos")
        .select("vendor_id,url,is_cover,sort_order")
        .in("vendor_id", ids)
        .eq("is_cover", true)
        .order("sort_order",{ascending:true});
      (photos||[]).forEach(p=>{
        coverMap[p.vendor_id] = coverMap[p.vendor_id] || [];
        if (coverMap[p.vendor_id].length < 3) coverMap[p.vendor_id].push(p.url);
      });
    }

    let list = vendors||[];
    if (city) {
      list = list.filter(v => (v.location_city||"").includes(city) || (v.location_district||"").includes(city));
    }
    const top = list.slice(0, Number(limit||10)).map(v=>({ ...v, cover_photos: coverMap[v.id] || [] }));

    if(asText){
      return res.status(200).send(fmt.vendorCards(top));
    }
    return res.status(200).json({ ok:true, items: top });
  }catch(e){
    return res.status(200).json({ ok:false, error:String(e) });
  }
}
