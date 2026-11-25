import { runRoutingBenchmark } from './routing.mjs';
import { buildResearchSnapshot } from './routing-v2.mjs';
// Explicit synthetic host catalog: this is privileged knowledge, not zero-shot recognition.
const catalog=['Yokogawa','Siemens','Endress+Hauser','Flowserve','FCA Hamburg'];
const baseline=runRoutingBenchmark();
const candidate=runRoutingBenchmark(buildResearchSnapshot);
const host=runRoutingBenchmark((a,b,c)=>buildResearchSnapshot(a,b,c,{hostLiterals:catalog}));
console.log(JSON.stringify({baseline,candidate,host},null,2));
for(const r of [baseline,candidate,host])if(r.total.invalidPartitions||r.total.unsafeProse||r.total.lockedLeak)process.exitCode=1;
