const https=require("https");const UA="DreamMapPhotoFetcher/1.0";
function get(u){return new Promise((res,rej)=>{https.get(u,{headers:{"User-Agent":UA}},r=>{let s="";r.setEncoding("utf8");r.on("data",c=>s+=c);r.on("end",()=>res(s));}).on("error",rej);});}
(async()=>{
 for(const q of ["Jungfrau","Jungfrau mountain Bernese Oberland"]){
  const u="https://commons.wikimedia.org/w/api.php?"+new URLSearchParams({format:"json",formatversion:"2",action:"query",generator:"search",gsrsearch:q,gsrnamespace:"6",gsrlimit:"12",prop:"imageinfo",iiprop:"url|size|mime",iiurlwidth:"1280"}).toString();
  const j=JSON.parse(await get(u));const ps=(j.query&&j.query.pages)||[];
  console.log("Q:",q);
  ps.forEach(p=>{const i=(p.imageinfo||[])[0]||{};if(/jpeg/.test(i.mime||""))console.log("   ",p.title,(i.thumbwidth||0)+"x"+(i.thumbheight||0));});
  await new Promise(r=>setTimeout(r,1500));
 }
})();
