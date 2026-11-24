import { validRange } from '../regions.mjs';
// Only host-supplied, reviewed plugin/rule modules; never load rules from user text or URLs.
// Textlint reports may contain fixes on different ranges; use the explicit fix range, not message.index.
export function textlintAdapter(kernel, options) {
  if (!kernel || typeof kernel.lintText !== 'function' || !Array.isArray(options?.rules) || !Array.isArray(options?.plugins)) throw new TypeError('Reviewed textlint configuration required');
  const config = {ext:'.txt',filePath:'procurement.txt',plugins:[...options.plugins],rules:[...options.rules]};
  return Object.freeze({id:'textlint',languages:['en','fa'],async check(text) {
    const result = await kernel.lintText(text,config);
    if (!Array.isArray(result?.messages)) throw new Error('Invalid textlint result');
    const output=[];
    for (const m of result.messages) {
      // Fatal parser diagnostics cannot establish a text range.
      if (!m.ruleId || m.fatal || typeof m.message !== 'string') continue;
      if (Array.isArray(m.fix?.range) && m.fix.range.length === 2 && typeof m.fix.text === 'string') {
        const [start,end]=m.fix.range;
        if (validRange(text,start,end)) output.push({start,end,original:text.slice(start,end),replacement:m.fix.text,rule:m.ruleId,category:'style',message:m.message});
      }
      else if (Array.isArray(m.range) && m.range.length===2 && validRange(text,...m.range) && m.range[0]<m.range[1]) {
        const [start,end]=m.range;
        output.push({start,end,original:text.slice(start,end),rule:m.ruleId,category:'style',message:m.message});
      }
      // Point-only messages have no verified span: fail closed instead of guessing an end offset.
    }
    return output;
  }});
}
export async function createTextlint(rules) {
  const [{TextlintKernel}, plugin] = await Promise.all([import('@textlint/kernel'),import('@textlint/textlint-plugin-text')]);
  const textPlugin=plugin.default?.default ?? plugin.default;
  return textlintAdapter(new TextlintKernel(),{plugins:[{pluginId:'text',plugin:textPlugin}],rules});
}
