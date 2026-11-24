// A domain-specific advisory rule, not an alternative grammar parser. It never invents a date.
export const procurementDeliveryRule = Object.freeze({
  ruleId:'procurement-delivery-clarity',
  rule(context) {
    return {
      [context.Syntax.Document](node) {
        const source=context.getSource(node);
        for(const match of source.matchAll(/\bas soon as possible\b/giu)) {
          const start=match.index, end=start+match[0].length;
          context.report(node,new context.RuleError('Consider specifying an agreed delivery deadline.',{
            padding:context.locator.range([start,end])
          }));
        }
      }
    };
  }
});
