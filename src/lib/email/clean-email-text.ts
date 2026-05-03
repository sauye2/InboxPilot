export function decodeHtmlEntities(value: string) {
  return value
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) =>
      String.fromCharCode(Number.parseInt(code, 16)),
    )
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

const STRUCTURAL_TAGS =
  /<\/(?:p|div|section|article|main|header|footer|aside|tr|table|tbody|thead|ul|ol|li|h[1-6]|blockquote)>/gi;
const INVISIBLE_HTML =
  /<(?:style|script|head|svg|noscript|template|xml|meta|link)[\s\S]*?<\/(?:style|script|head|svg|noscript|template|xml|meta|link)>/gi;
const CSS_BLOCKS =
  /(?:^|\s)(?:@media[^{]*|[.#]?[a-z0-9_-]+(?:\s*[,:>+~]\s*[.#]?[a-z0-9_-]+)*|a:(?:link|visited|hover|active)|body|html|table|td|th|p|div|span)\s*\{[^}]*\}/gi;
const CSS_DECLARATIONS =
  /(?:^|\s)(?:[a-z-]{2,}|--[a-z0-9-]+)\s*:\s*[^;\n{}]{1,180};?/gi;
const TRACKING_NOISE =
  /\b(?:unsubscribe|view in browser|manage preferences|privacy policy|terms of service)\b[\s\S]{0,120}$/i;
const QUOTED_REPLY_MARKERS =
  /\s*(?:>{1,3}\s*)+(?=(?:on\s+\w{3,9},|from:|sent:|to:|subject:|hello|hi|thank you|please|we require|important|need to make|how do))/gi;

export function cleanEmailText(value: string) {
  const hasHtml = /<\/?[a-z][\s\S]*>/i.test(value);

  return decodeHtmlEntities(value)
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(INVISIBLE_HTML, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/td>/gi, " ")
    .replace(/<li[\s\S]*?>/gi, "\n- ")
    .replace(STRUCTURAL_TAGS, "\n\n")
    .replace(/<[^>]+>/g, " ")
    .replace(CSS_BLOCKS, " ")
    .replace(CSS_DECLARATIONS, " ")
    .replace(/\b(?:font|color|background|padding|margin|border|width|height|display|line-height|text-decoration|box-sizing)[-\w]*\b\s*[;}]/gi, " ")
    .replace(/\b[a-z-]+\([^)]{0,180}\)/gi, " ")
    .replace(/\s*!important\b/gi, " ")
    .replace(QUOTED_REPLY_MARKERS, "\n\n")
    .replace(/https?:\/\/\S{80,}/gi, " ")
    .replace(/[ \t]*>[ \t]*/g, "\n> ")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{4,}/g, "\n\n")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !looksLikeCssOrTemplateNoise(line))
    .join(hasHtml ? "\n\n" : "\n")
    .replace(TRACKING_NOISE, "")
    .trim();
}

export function compactEmailText(value: string) {
  const lines = cleanEmailText(value)
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);

  return lines
    .filter((line, index) => line.toLowerCase() !== lines[index - 1]?.toLowerCase())
    .join("\n");
}

export function emailTextToParagraphs(value: string, maxParagraphs = 14) {
  const cleaned = cleanEmailText(value);
  const paragraphs = cleaned
    .replace(/\s{2,}/g, " ")
    .replace(/\s+(?=(?:On\s+\w{3,9},|From:|Sent:|To:|Subject:)\b)/g, "\n\n")
    .split(/\n{2,}/)
    .flatMap((block) => splitDenseBlock(block.trim()))
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .filter(
      (paragraph, index, list) =>
        paragraph.toLowerCase() !== list[index - 1]?.toLowerCase(),
    );

  return paragraphs.slice(0, maxParagraphs);
}

function splitDenseBlock(block: string) {
  if (block.length <= 360) return [block];

  return block
    .replace(/\s+(?=(?:On\s+\w{3},|From:|Sent:|To:|Subject:|Steps?\s+\d|[A-Z][^.!?]{8,80}:\s))/g, "\n\n")
    .replace(/(?<=[.!?])\s+(?=[A-Z][a-z])/g, "\n\n")
    .split(/\n{2,}/);
}

function looksLikeCssOrTemplateNoise(line: string) {
  const lower = line.toLowerCase();

  if (/^\W*$/.test(line)) return true;
  if (/^\d+%?$/.test(line)) return true;
  if (/[{}]/.test(line)) return true;
  if (/^(?:a:visited|a:hover|body|html|td|tr|table|font|span|div)\b/.test(lower)) {
    return true;
  }
  if (
    /\b(?:color|background|font-size|font-family|padding|margin|border|display|width|height|line-height)\s*:/i.test(
      line,
    )
  ) {
    return true;
  }

  return false;
}
