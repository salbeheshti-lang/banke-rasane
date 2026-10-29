/**
 * Persian-aware search utilities for Banke Rasane.
 * Normalized field text/token indexes are cached per record, so a new keystroke
 * does not repeatedly normalize potentially long descriptions.
 */
const DIGIT_MAP: Record<string, string> = {
  '۰':'0','۱':'1','۲':'2','۳':'3','۴':'4','۵':'5','۶':'6','۷':'7','۸':'8','۹':'9',
  '٠':'0','١':'1','٢':'2','٣':'3','٤':'4','٥':'5','٦':'6','٧':'7','٨':'8','٩':'9',
};
const FIELD_WEIGHTS: Record<string, number> = {
  name:12, category:8, tags:7, summary:6, descriptionFa:5, country:4,
  source:3, style:3, effects:3, layout:3, elements:3, materials:3,
  colors:2, lighting:2, size:2, viewers:2, num:1,
};
const SEARCHABLE_FIELDS = [
  'name','category','summary','descriptionFa','tags','country','source','style',
  'effects','layout','elements','materials','colors','lighting','size','viewers','num',
];
export function normalizePersianSearch(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value).normalize('NFKC').toLowerCase()
    .replace(/[يى]/g,'ی').replace(/ك/g,'ک').replace(/[ۀة]/g,'ه')
    .replace(/[ؤ]/g,'و').replace(/[إأٱ]/g,'ا')
    .replace(/[\u064B-\u065F\u0670\u06D6-\u06ED]/g,'')
    .replace(/[\u200c\u200d\uFEFF]/g,' ')
    .replace(/[۰-۹٠-٩]/g,digit=>DIGIT_MAP[digit]||digit)
    .replace(/[^\p{L}\p{N}]+/gu,' ').replace(/\s+/g,' ').trim();
}
function levenshteinAtMostOne(a:string,b:string):boolean {
  if(a===b)return true;
  if(Math.abs(a.length-b.length)>1||Math.min(a.length,b.length)<4)return false;
  let i=0,j=0,edits=0;
  while(i<a.length&&j<b.length){
    if(a[i]===b[j]){i++;j++;continue;}
    if(++edits>1)return false;
    if(a.length>b.length)i++;else if(b.length>a.length)j++;else{i++;j++;}
  }
  if(i<a.length||j<b.length)edits++;
  return edits<=1;
}
type SearchRecord=Record<string,unknown>;
type IndexedField={text:string;tokens:string[]};
type IndexedRecord={fields:Record<string,IndexedField>};
const recordIndex=new WeakMap<object,IndexedRecord>();
function valuesForField(record:SearchRecord,field:string):string[]{
  const value=record[field];
  if(typeof value==='string'||typeof value==='number')return[String(value)];
  if(Array.isArray(value))return value.filter(v=>typeof v==='string'||typeof v==='number').map(String);
  return[];
}
function indexRecord(record:object,extraFields:string[]=[]):IndexedRecord{
  const cached=recordIndex.get(record);
  if(cached&&extraFields.every(field=>field in cached.fields))return cached;
  const fields:Record<string,IndexedField>=cached?{...cached.fields}:{};
  for(const field of [...SEARCHABLE_FIELDS,...extraFields]){
    if(field in fields)continue;
    const text=valuesForField(record as SearchRecord,field).map(normalizePersianSearch).filter(Boolean).join(' ');
    fields[field]={text,tokens:text?text.split(' '):[]};
  }
  const indexed={fields};recordIndex.set(record,indexed);return indexed;
}
function tokenMatches(valueToken:string,queryToken:string):number{
  if(valueToken===queryToken)return 2;
  if(valueToken.startsWith(queryToken))return 1.25;
  if(levenshteinAtMostOne(valueToken,queryToken))return .5;
  return 0;
}
/** Ranked matches with stable source-order tie breaks and cached record indexes. */
export function rankSearchShows<T extends object>(records:T[],query:string,preferredFields:string[]=[]):T[]{
  const normalizedQuery=normalizePersianSearch(query);
  if(!normalizedQuery)return records;
  const queryTokens=normalizedQuery.split(' ').filter(Boolean);
  if(!queryTokens.length)return records;
  const preferred=new Set(preferredFields);
  const fields=Array.from(new Set([...SEARCHABLE_FIELDS,...preferredFields]));
  const ranked:Array<{record:T;score:number;order:number}>=[];
  records.forEach((record,order)=>{
    const indexed=indexRecord(record,preferredFields);
    let score=0,matchedTokens=0,exactPhraseMatch=false;
    for(const field of fields){
      const entry=indexed.fields[field];
      if(!entry?.text)continue;
      const weight=(FIELD_WEIGHTS[field]||2)*(preferred.has(field)?1.25:1);
      if(entry.text===normalizedQuery){score+=weight*10;exactPhraseMatch=true;}
      else if(entry.text.startsWith(normalizedQuery)){score+=weight*6;exactPhraseMatch=true;}
      else if(entry.text.includes(normalizedQuery)){score+=weight*4;exactPhraseMatch=true;}
      for(const token of queryTokens){
        let best=0;
        for(const valueToken of entry.tokens){const match=tokenMatches(valueToken,token);if(match>best)best=match;if(best===2)break;}
        score+=weight*best;
      }
    }
    for(const token of queryTokens){
      if(fields.some(field=>indexed.fields[field]?.tokens.some(valueToken=>tokenMatches(valueToken,token)>0)))matchedTokens++;
    }
    if(matchedTokens===queryTokens.length)score+=18*matchedTokens;
    else if(matchedTokens>0)score*=matchedTokens/queryTokens.length;
    if(exactPhraseMatch)score+=8;
    if(score>0)ranked.push({record,score,order});
  });
  return ranked.sort((a,b)=>b.score-a.score||a.order-b.order).map(item=>item.record);
}
