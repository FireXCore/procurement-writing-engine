import { contiguousDiff } from '../regions.mjs';

// Deny all documented transformations except narrow Persian orthography operations.
// Changes to upstream defaults require requalification of the exact package version.
const disabled = ['cleanup_begin_and_end','cleanup_extra_marks','cleanup_kashidas','cleanup_line_breaks','cleanup_rlm','cleanup_spacing','cleanup_zwnj','decode_htmlentities','fix_arabic_numbers','fix_dashes','fix_diacritics','fix_english_numbers','fix_english_quotes_pairs','fix_english_quotes','fix_hamzeh','fix_hamzeh_arabic','fix_misc_non_persian_chars','fix_misc_spacing','fix_numeral_symbols','fix_perfix_spacing','fix_persian_glyphs','fix_punctuations','fix_question_mark','fix_spacing_for_braces_and_quotes','fix_spacing_for_punctuations','fix_suffix_misc','fix_suffix_spacing','fix_three_dots','kashidas_as_parenthetic','markdown_normalize_braces','markdown_normalize_lists','normalize_dates','normalize_ellipsis','remove_spaces_before_ellipsis','normalize_eol','remove_diacritics'];
export const VIRASTAR_OPTIONS = Object.freeze({...Object.fromEntries(disabled.map(k=>[k,false])),fix_misc_non_persian_chars:true,fix_perfix_spacing:true,fix_persian_glyphs:true,fix_suffix_spacing:true,fix_suffix_misc:true,preserve_braces:true,preserve_brackets:true});

export function normalizerAdapter(normalize, {experimental=false}={}) {
  if (typeof normalize !== 'function') throw new TypeError('Persian normalizer required');
  return Object.freeze({id:experimental?'virastar-ts':'virastar',languages:['fa'],async check(text) {
    const normalized = await normalize(text);
    if (typeof normalized !== 'string' || !normalized.isWellFormed()) throw new Error('Invalid normalizer result');
    const edit = contiguousDiff(text,normalized);
    if (!edit) return [];
    return [{...edit,rule:'orthography',category:'orthography',message:'Review Persian orthography.',...(experimental?{replacement:undefined}:{})}];
  }});
}
export async function createVirastar() {
  const {default:Virastar} = await import('virastar');
  const linter = new Virastar({...VIRASTAR_OPTIONS});
  return normalizerAdapter(text=>linter.cleanup(text));
}
// Experimental TypeScript fork is an alternative, advisory-only provider; do not run both by default.
export function experimentalVirastarAdapter(instance) {
  if (!instance || typeof instance.process !== 'function') throw new TypeError('Experimental Virastar instance required');
  return normalizerAdapter(text=>instance.process(text),{experimental:true});
}
