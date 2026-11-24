// Synthetic public regression corpus. No customer or supplier records.
export const locked='Rosemount 3051 — 3 PCS — 4–20 mA';
export const cases=Object.freeze([
 {id:'en-spelling',language:'en',text:'Please send teh quatation for the requested equipmnt.',pairs:[['teh','the'],['quatation','quotation'],['equipmnt','equipment']],first:['quatation','quotation']},
 {id:'en-agreement',language:'en',text:'The supplier have confirmed that the goods is available.',pairs:[['have','has'],['is','are']]},
 {id:'en-repeat',language:'en',text:'Please confirm the the availability of the requested material.',pairs:[['the the','the']]},
 {id:'en-deadline',language:'en',text:'Please provide your quotation as soon as possible.',message:'quotation or response deadline'},
 {id:'en-clean',language:'en',text:'Please confirm the availability of the requested materials and provide your best commercial offer.',clean:true},
 {id:'fa-glyph',language:'fa',text:'لطفا قيمت كالا را اعلام كنيد.',expectedText:'لطفاً قیمت کالا را اعلام کنید.',pairs:[['لطفا','لطفاً']],browserNeed:'کالا'},
 {id:'fa-halfspace',language:'fa',text:'پیشنهاد شما را بررسی می کنیم و نتیجه را اعلام می کنیم.',expectedText:'پیشنهاد شما را بررسی می‌کنیم و نتیجه را اعلام می‌کنیم.',browserNeed:'\u200c'},
 {id:'fa-tanwin',language:'fa',text:'لطفا پیشنهاد قیمت خود را همراه با شرایط تحویل ارسال کنید.',pairs:[['لطفا','لطفاً']],expectedText:'لطفاً پیشنهاد قیمت خود را همراه با شرایط تحویل ارسال کنید.'},
 {id:'fa-formal-adverbs',language:'fa',text:'حتما قبلا اعلام شده است.',pairs:[['حتما','حتماً'],['قبلا','قبلاً']],expectedText:'حتماً قبلاً اعلام شده است.'},
 {id:'fa-clean',language:'fa',text:'لطفاً پیشنهاد قیمت خود را همراه با شرایط تحویل ارسال کنید.',clean:true},
 {id:'en-technical',language:'en',text:'Please send teh quotation for Rosemount 3051, 3 PCS, 4–20 mA.',pairs:[['teh','the']],protected:['Rosemount 3051','3 PCS','4–20 mA']},
 {id:'en-part-number',language:'en',text:'Please confirm availability of PN: 7MF4433-1DA22-2AB1.',protected:['PN: 7MF4433-1DA22-2AB1']},
 {id:'fa-quantity',language:'fa',text:'لطفا قيمت ۲۵ عدد شیر صنعتی را اعلام كنيد.',expectedText:'لطفاً قیمت ۲۵ عدد شیر صنعتی را اعلام کنید.',pairs:[['لطفا','لطفاً']],protected:['۲۵ عدد'],browserNeed:'ک'},
 {id:'en-inferred-id',language:'en',text:'Please send teh quote for ABC999.',pairs:[['teh','the']],protected:['ABC999'],inferred:1}
]);

export const extendedCases=Object.freeze([
 {id:'mixed',text:'لطفا برای Rosemount 3051 teh quotation را ارسال کنید.',languages:['fa','en'],pairs:[['لطفا','لطفاً'],['teh','the']],protected:['Rosemount 3051']},
 {id:'lowercase-id',text:'Please send teh quotation for abc999 and 7MF4433-1DA22-2AB1.',languages:['en'],pairs:[['teh','the']],protected:['abc999','7MF4433-1DA22-2AB1']},
 {id:'standard',text:'Please provde 25 PCS of ASTM A216 WCB valves, DN50, PN16.',languages:['en'],pairs:[['provde','provide']],first:['provde','provide'],protected:['25 PCS','ASTM A216 WCB','DN50','PN16']},
 {id:'new-english',text:'We have recieved your qoutation and will proced with the evaluation.',languages:['en'],pairs:[['recieved','received'],['qoutation','quotation'],['proced','proceed']],first:['proced','proceed']},
 {id:'negation',text:'The goods are not available and the offer has not been approved.',languages:['en'],pairs:[],clean:true}
]);
