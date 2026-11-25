// Reviewed, narrow procurement policies executed by Textlint; not a general grammar engine.
// No invented deadlines, dates, quantities, or technical facts.
export const procurementDeliveryRule = Object.freeze({
  ruleId:'procurement-delivery-clarity',
  rule(context) {
    return {
      [context.Syntax.Document](node) {
        const source=context.getSource(node);
        for(const match of source.matchAll(/\bas soon as possible\b/giu)) {
          const start=match.index, end=start+match[0].length;
          const clause=source.slice(0,start).split(/[.!?;\r\n]/u).at(-1);
          const message=/\b(?:quotation|quote|offer|proposal|response|reply)\b/iu.test(clause)
            ? 'Consider specifying an agreed quotation or response deadline.'
            : /\b(?:ship|deliver|dispatch|shipment|delivery)\b/iu.test(clause)
              ? 'Consider specifying an agreed delivery deadline.'
              : 'Consider specifying an agreed deadline.';
          context.report(node,new context.RuleError(message,{
            padding:context.locator.range([start,end])
          }));
        }
      }
    };
  }
});

// Deliberately restricted to direct procurement noun phrases with unambiguous following verbs.
// Not a general subject/verb parser. A direct singular subject + have is checked even if the next word has a typo. Quoted text is skipped; all fixes remain review-only.
const agreementPatterns = [
  {pattern:/(?:^|[.!?]\s+|\bthat\s+)(each\s+of\s+the\s+(?:suppliers|vendors|manufacturers|contractors|buyers|customers)\s+)(have)(?=\s+(?:confirmed|submitted|provided|sent|received|accepted|rejected|approved|acknowledged)\b)/giu,replacement:'has'},
  {pattern:/(?:^|[.!?]\s+|\bthat\s+)(the\s+equipment\s+)(were)(?=\s+(?:inspected|tested|delivered|installed|received|approved|repaired|shipped|available)\b)/giu,replacement:'was'},
  {pattern:/(?:^|[.!?]\s+|\bthat\s+)(the\s+(?:supplier|vendor|manufacturer|contractor|buyer|customer)\s+)(have)(?=\s+\p{L})/giu,replacement:'has'},
  {pattern:/(?:^|[.!?]\s+|\bthat\s+)(the\s+(?:goods|materials|items|documents|products|parts)\s+)(is)(?=\s+(?:available|ready|in stock|required|approved|complete)\b)/giu,replacement:'are'}
];
function agreementReporter(context) {
  return {
    [context.Syntax.Document](node) {
      const source=context.getSource(node);
      if (/[“”"‘’']/u.test(source)) return;
      for(const {pattern,replacement} of agreementPatterns) {
        for(const match of source.matchAll(pattern)) {
          const original=match[2],end=match.index+match[0].length,start=end-original.length;
          const range=[start,end];
          context.report(node,new context.RuleError('Review subject and verb agreement in this procurement phrase.',{
            padding:context.locator.range(range),
            fix:context.fixer.replaceTextRange(range,replacement)
          }));
        }
      }
    }
  };
}
export const procurementAgreementRule=Object.freeze({
  ruleId:'procurement-agreement',
  rule:Object.freeze({linter:agreementReporter,fixer:agreementReporter})
});
export const procurementPolicyRules=Object.freeze([procurementDeliveryRule,procurementAgreementRule]);
