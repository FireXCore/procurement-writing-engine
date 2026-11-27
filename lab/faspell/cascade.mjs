// Evaluation-only bounded cascade. No automatic application.
const simpleCascade=/^[آابتثجحخدذرزژسشصضطظعغفقکگلمنوهیپچئءؤأإ]{3,24}$/u;
export function editDistance(a,b){
 if(typeof a!=='string'||typeof b!=='string'||!simpleCascade.test(a)||!simpleCascade.test(b))return Infinity;
 const d=Array.from({length:a.length+1},(_,i)=>Array.from({length:b.length+1},(_,j)=>i===0?j:j===0?i:0));
 for(let i=1;i<=a.length;i++)for(let j=1;j<=b.length;j++){
   d[i][j]=Math.min(d[i-1][j]+1,d[i][j-1]+1,d[i-1][j-1]+(a[i-1]===b[j-1]?0:1));
   if(i>1&&j>1&&a[i-1]===b[j-2]&&a[i-2]===b[j-1])d[i][j]=Math.min(d[i][j],d[i-2][j-2]+1);
 }
 return d[a.length][b.length];
}
export function createCascade({primary,secondary,knownSource,secondaryCorrect,vetoPrimary=false}){
 if([primary,secondary,knownSource,secondaryCorrect].some(f=>typeof f!=='function')||typeof vetoPrimary!=='boolean')throw new TypeError('Invalid comparator');
 return source=>{
   const base=primary(source);
   if(base.partial)return base;
   if(!simpleCascade.test(source)||source.length<=3||knownSource(source))return base;
   if(vetoPrimary&&secondaryCorrect(source))return {candidates:[],partial:false};
   if(base.candidates.length)return base;
   if(!vetoPrimary&&secondaryCorrect(source))return base;
   const extra=secondary(source);
   if(extra.partial)return {candidates:[],partial:true};
   const candidates=[...new Set(extra.candidates)].filter(w=>w!==source&&editDistance(source,w)<=2&&secondaryCorrect(w)).slice(0,4);
   return {candidates,partial:false};
 };
}
