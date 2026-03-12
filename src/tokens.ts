/*
 * CIF format standard tokens in RegExp form.
 *
 * Rules taken from the technical specification for CIF 1.1:
 * https://www.iucr.org/resources/cif/spec/version1.1/cifsyntax
 */

const sp = ' ';
const ht = '\\t';
const eol = '\\r*\\n';

export const end_of_line = eol;

/* <OrdinaryChar> */
const ordinary_char = `a-zA-Z0-9!%&()*+,\\-./:<=>?@\\\\^\`{\u00A6}~`;
/* <NonBlankChar> */
const nonblank_char = ordinary_char + '"#$\'_;\\[\\]';
const nonblank_char_nosingle = ordinary_char + '"#$_;\\[\\]';
const nonblank_char_nodouble = ordinary_char + "#$'_;\\[\\]";
/* <TextLeadChar> */
const textlead_char = ordinary_char + '"#$\'_\\[\\]' + sp + ht;
/* <AnyPrintChar> */
const anyprint_char = nonblank_char + sp + ht;
/* <Digit> */
const digit = '0-9';
/* <Comments> */
const comments = '(?:#[' + anyprint_char + ']*' + eol + ')+';
/* <TokenizedComments> */
const tok_comments = '[' + sp + ht + eol + ']+' + comments;
/* <WhiteSpace> */
const whitespace = '(?:' + tok_comments + '|' + sp + '|' + ht + '|' + eol + ')+';
/* <SemiColonTextField> */
const semicolontext =
  ';[' +
  anyprint_char +
  ']*' +
  eol +
  '(?:(?:[' +
  textlead_char +
  '][' +
  anyprint_char +
  ']*)?' +
  eol +
  ')*;';
/* <SingleQuotedString> */
const squotestring = "'[" + nonblank_char_nosingle + sp + ht + "]*'";
/* <DoubleQuotedString> */
const dquotestring = '"[' + nonblank_char_nodouble + sp + ht + ']*"';
/* <UnquotedString> (approximation — full spec requires lookbehinds) */
const uquotestring = '[' + eol + sp + ht + '][' + ordinary_char + '][' + nonblank_char + ']*';
/* <QuotedString> */
const quotestring = '(?:' + squotestring + '|' + dquotestring + ')';
/* <CharString> */
const chrstring = '(?:' + squotestring + '|' + dquotestring + '|' + uquotestring + ')';
/* <UnsignedInteger> */
const unsigned_int = '[' + digit + ']+';
/* <Integer> */
const integer = '[+\\-]?' + unsigned_int;
/* <Exponent> */
const exponent = '[eE]' + integer;
/* <Float> */
const float_pat =
  '(?:(?:[+\\-]?(?:[' +
  digit +
  ']*\\.' +
  unsigned_int +
  '|[' +
  digit +
  ']+\\.)(?:' +
  exponent +
  ')?)|(?:' +
  integer +
  exponent +
  '))';
/* <Number> */
const number_pat = '(?:' + float_pat + '|' + integer + ')';
/* <Numeric> */
const numeric = '(?:(' + number_pat + ')\\((' + unsigned_int + ')\\)|(' + number_pat + '))';
/* <Tag> */
const tag = '_[' + nonblank_char + ']+';
/* <Value> */
const value = '(\\.|\\?|' + numeric + '|' + chrstring + '|' + semicolontext + ')';
/* <LOOP_> */
const loop_kw = '[Ll][Oo][Oo][Pp]_';
/* <LoopHeader> */
const loop_header = loop_kw + '(' + whitespace + tag + ')+';
/* <LoopBody> */
const loop_body = value + '(' + whitespace + value + ')*';
/* <DataHeader> */
const data_header = '[Dd][Aa][Tt][Aa]_[' + nonblank_char + ']+';
/* <DataItem> */
const data_item = '(?:(' + tag + ')' + whitespace + value + '|' + loop_header + loop_body + ')';

/** Map of all available token pattern names to their regex source strings */
const tokenMap: Record<string, string> = {
  end_of_line: eol,
  ordinary_char: '[' + ordinary_char + ']',
  nonblank_char: '[' + nonblank_char + ']',
  textlead_char: '[' + textlead_char + ']',
  anyprint_char: '[' + anyprint_char + ']',
  digit: '[' + digit + ']',
  comments,
  tok_comments,
  whitespace,
  semicolontext,
  squotestring,
  dquotestring,
  uquotestring,
  quotestring,
  chrstring,
  unsigned_int,
  integer,
  exponent,
  float: float_pat,
  number: number_pat,
  numeric,
  tag,
  value,
  loop_kw,
  loop_header,
  loop_body,
  data_header,
  data_item,
  reserved: '(data|loop|global|save|stop)',
};

export type TokenName = keyof typeof tokenMap;

/**
 * Build a RegExp for the named CIF token pattern.
 * @param tname   Token pattern name
 * @param start   If true, anchor at the start of string
 * @param end     If true, anchor at the end of string
 * @param flags   RegExp flags (default 'g'; 'reserved' always uses 'gi')
 */
export function tokenRegex(
  tname: TokenName,
  start?: boolean,
  end?: boolean,
  flags?: string,
): RegExp {
  let f = flags ?? 'g';
  if (tname === 'reserved') f = 'gi';
  let restr = tokenMap[tname];
  if (start) restr = '^' + restr;
  if (end) restr = restr + '$';
  return new RegExp(restr, f);
}
