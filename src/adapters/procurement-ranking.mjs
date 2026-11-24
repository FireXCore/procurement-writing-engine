// Review-only, deterministic contextual ranking. Never generates or applies a replacement.
// Phrase evidence is a small audited procurement corpus, not a typo-to-fix dictionary.
// Upstream order is retained for ties and for candidates without contextual evidence.
const phrases = [
  'please provide','please confirm','please submit','please send','please quote','please advise','please supply','please deliver','please inspect','please acknowledge','please specify','please attach','please review','please verify','please proceed',
  'have received','has received','we received','received your','received the','will proceed','proceed with','proceed to','your quotation','the quotation','a quotation','request quotation','submit quotation','commercial quotation','technical quotation',
  'requested equipment','industrial equipment','the equipment','provide your','provide the','provide us','provide a','provide details','provide documents','provide information','provide pricing','provide confirmation','provide evidence','prove that','prove compliance','prove ownership','prove the claim',
  'delivery schedule','delivery date','delivery terms','purchase order','technical specification','material certificate','inspection report','commercial offer','payment terms','lead time','unit price','order confirmation','quotation validity'
];
const contexts=new Set(phrases);
const vocabulary=new Set(['quotation','supplier','equipment','procurement','purchase','delivery','availability','manufacturer','inspection','certificate','commercial','technical','invoice','shipment','warranty','material','quantity']);
const words=s=>s.toLowerCase().match(/[a-z]+/g)??[];
export function rankSpellingAlternatives(proposals,source){
  return proposals.map((proposal,index)=>{
    const candidate=proposal.replacement?.toLowerCase()??'';
    if(!/^[a-z]+$/.test(candidate))return {proposal,index,score:0};
    const left=source.slice(Math.max(0,proposal.start-80),proposal.start);
    const right=source.slice(proposal.end,proposal.end+80);
    // Do not use context across a sentence boundary or a protected region.
    const before=words(left.split(/[.!?;\r\n]/u).at(-1)).slice(-2);
    const after=words(right.split(/[.!?;\r\n]/u)[0]).slice(0,2);
    const joined=[...before,candidate,...after];
    const pos=before.length;
    let score=vocabulary.has(candidate)?1:0;
    for(let width=2;width<=3;width++)for(let i=Math.max(0,pos-width+1);i<=pos&&i+width<=joined.length;i++){
      if(contexts.has(joined.slice(i,i+width).join(' ')))score+=width*4;
    }
    return {proposal,index,score};
  }).sort((a,b)=>b.score-a.score||a.index-b.index).map(x=>x.proposal);
}
