export interface TextPart {
  text: string;
  isBold: boolean;
}

export interface ChatLine {
  parts: TextPart[];
  isBullet: boolean;
}

/** Splits **bold** markers. An unclosed marker stays as text, as happens mid-stream. */
function toParts(line: string): TextPart[] {
  return line
    .split(/(\*\*[^*\n]+\*\*)/)
    .filter(Boolean)
    .map((part) => {
      const bold = part.match(/^\*\*([^*\n]+)\*\*$/);
      return bold ? { text: bold[1], isBold: true } : { text: part, isBold: false };
    });
}

/** Reads the small part of Markdown that Gemini uses in chat replies. */
export function parseChatText(text: string): ChatLine[] {
  return text.split('\n').map((line) => {
    const bullet = line.match(/^\s*[*-]\s+(.*)$/);
    return { parts: toParts(bullet ? bullet[1] : line), isBullet: Boolean(bullet) };
  });
}
