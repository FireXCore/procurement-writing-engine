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
export const procurementAgreementRule:TextlintRule;
export const procurementPolicyRules:readonly TextlintRule[];
export function languageToolAdapter(check:(text:string,language:Language,signal?:AbortSignal)=>Promise<unknown>):Provider;
export function ste100Adapter(check:(text:string,signal?:AbortSignal)=>Promise<unknown>):Provider;
export function valeAdapter(check:(text:string,signal?:AbortSignal)=>Promise<unknown>):Provider;

export interface SourceSpan { readonly unit:'utf16'|'codepoint'|'utf8'; readonly start:number; readonly end:number; readonly original:string }
export function resolveSourceRange(source:string,span:SourceSpan):Readonly<{start:number;end:number;original:string}>;
export function protectEntitySpans(document:DocumentSnapshot,batch:{readonly snapshotId:string;readonly spans:readonly SourceSpan[]}):DocumentSnapshot;
export interface ContextualCandidate extends SourceSpan { readonly category:Category; readonly replacement:string }
export function createContextualProvider(options:{readonly languages?:readonly Language[];readonly infer:(input:Readonly<{text:string;language:Language;signal?:AbortSignal}>)=>readonly ContextualCandidate[]|Promise<readonly ContextualCandidate[]>}):Provider;

export interface LocalGenerationMessage { readonly role:'system'|'user'; readonly content:string }
export interface LocalGenerationOptions { readonly do_sample:false; readonly max_new_tokens:384; readonly num_return_sequences:1; readonly return_full_text:false }
export function createLocalGenerationProvider(options:{readonly languages?:readonly Language[];readonly generator:(messages:LocalGenerationMessage[],options:LocalGenerationOptions,signal?:AbortSignal)=>unknown|Promise<unknown>}):Provider;

export type LocalModelPrecision = 'q4'|'q4f16'|'q8'|'fp16'|'fp32';
export interface TransformersRuntime {
  readonly env:{readonly allowRemoteModels:boolean;readonly allowLocalModels:boolean};
  readonly pipeline:(task:'text-generation',model:string,options:{device:'webgpu'|'wasm';dtype:LocalModelPrecision;local_files_only:true})=>Promise<unknown>;
  readonly InterruptableStoppingCriteria?:new()=>{interrupt():void};
}
export function createTransformersProvider(options:{readonly runtime:TransformersRuntime;readonly model:string;readonly device?:'webgpu'|'wasm';readonly dtype?:LocalModelPrecision;readonly fallbackToWasm?:boolean;readonly wasmDtype?:LocalModelPrecision;readonly languages?:readonly Language[]}):Promise<{readonly provider:Provider;readonly device:'webgpu'|'wasm';readonly dtype:LocalModelPrecision;dispose():Promise<void>}>;

export interface PreferenceRecord { readonly language:Language; readonly original:string; readonly replacement:string; readonly accepted:number; readonly rejected:number }
export interface PreferenceProfile { readonly version:1; readonly records:readonly PreferenceRecord[] }
export interface ReviewCandidate { readonly finding:Finding; readonly sources:readonly Readonly<{provider:string;rule:string;message:string}>[]; readonly learnable:boolean; readonly preference:number }
export interface AdaptiveReviewSession { readonly groups:readonly Readonly<{language:Language;candidates:readonly ReviewCandidate[]}>[];record(groupIndex:number,candidateIndex:number,decision:'prefer'|'reject'):boolean }
export interface AdaptiveReview { prepare(document:DocumentSnapshot,analysis:Analysis):AdaptiveReviewSession;invalidate():void;exportProfile():PreferenceProfile;clear():void }
export function createAdaptiveReview(options?:{readonly profile?:PreferenceProfile}):AdaptiveReview;
export function createPersianLexiconProvider(options:{readonly words:readonly string[];readonly isKnownSource?:(word:string)=>boolean;readonly preferredSpellings?:readonly (readonly [string,string])[]}):Provider;
