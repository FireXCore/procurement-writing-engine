export type Language = 'en' | 'fa';
export type Category = 'spelling'|'grammar'|'orthography'|'terminology'|'style'|'technical-writing';
export type Region = Readonly<{start:number;end:number} & ({kind:'protected'}|{kind:'prose';language:Language})>;
export interface DocumentSnapshot { readonly text:string; readonly snapshotId:string; readonly regions:readonly Region[] }
export interface Proposal { readonly start:number; readonly end:number; readonly original:string; readonly replacement?:string; readonly rule:string; readonly category:Category; readonly message:string }
export interface Provider { readonly id:string; readonly languages:readonly Language[]; check(text:string,language:Language,signal?:AbortSignal):Promise<readonly Proposal[]>|readonly Proposal[] }
export interface Finding extends Proposal { readonly provider:string }
export interface Diagnostic { readonly code:string; readonly provider?:string; readonly start?:number }
export interface Analysis { readonly snapshotId:string|null; readonly status:'complete'|'partial'|'blocked'|'cancelled'|'busy'; readonly findings:readonly Finding[]; readonly diagnostics:readonly Diagnostic[]; readonly apply:false }
export interface Engine { analyze(document:DocumentSnapshot,options?:{signal?:AbortSignal}):Promise<Analysis> }
export function createEngine(providers:readonly Provider[]):Engine;
export interface HarperSuggestion { kind():number; get_replacement_text():string; free?():void }
export interface HarperLint { span():{start:number;end:number;free?():void}; get_problem_text():string; lint_kind():string; message():string; suggestions():HarperSuggestion[]; free?():void }
export interface HarperLinter { organizedLints(text:string,options?:{language:'plaintext';dedup:boolean;isolateEnglish:boolean}):Promise<Record<string,readonly HarperLint[]>> }
export function harperAdapter(linter:HarperLinter):Provider;
export function createHarper(options:{binary:unknown;worker?:boolean;dialect?:unknown}):Promise<{provider:Provider;dispose:()=>Promise<void>}>;
export function createVirastar():Promise<Provider>;
export function normalizerAdapter(normalize:(text:string)=>string|Promise<string>,options?:{experimental?:boolean}):Provider;
export function experimentalVirastarAdapter(instance:{process(text:string):string|Promise<string>}):Provider;
export const VIRASTAR_OPTIONS:Readonly<Record<string,boolean>>;
export interface TextlintRule { ruleId:string; rule:unknown; options?:unknown }
export interface TextlintPlugin { pluginId:string; plugin:unknown; options?:unknown }
export function textlintAdapter(kernel:{lintText(text:string,options:any):Promise<unknown>},options:{rules:readonly TextlintRule[];plugins:readonly TextlintPlugin[]}):Provider;
export function createTextlint(rules:readonly TextlintRule[]):Promise<Provider>;
export const procurementDeliveryRule:TextlintRule;
export function languageToolAdapter(check:(text:string,language:Language,signal?:AbortSignal)=>Promise<unknown>):Provider;
export function ste100Adapter(check:(text:string,signal?:AbortSignal)=>Promise<unknown>):Provider;
export function valeAdapter(check:(text:string,signal?:AbortSignal)=>Promise<unknown>):Provider;
