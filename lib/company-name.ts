export function normalizeCompanyName(value:string){
  const clean=String(value||"")
    .trim()
    .replace(/\s+/g," ")
    .replace(/[ـ]/g,"");
  if(!clean)return "";

  const compact=clean
    .replace(/[أإآ]/g,"ا")
    .replace(/ى/g,"ي")
    .toLowerCase();

  // All independent/private taxi captains belong to one shared directory group.
  if(/^(تكسي|تاكسي)\s*خاص$/.test(compact))return "تكسي خاص";

  return clean;
}
