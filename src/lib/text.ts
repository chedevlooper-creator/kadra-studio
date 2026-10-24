const TITLE_LABEL = /(?:yazı\s*kartı|ekranda\s*(?:şu\s*)?yazı|başlık\s*kartı|daktilo\s*&\s*dış\s*ses(?:\s*\([^)]*\))?|daktilo\s+yazısı(?:\s+ve\s+seslendirme)?(?:\s+ile\s+kamu\s+spotu)?|kamu\s+spotu|\d+\s*[.)-]?\s*spot)\s*[:：–—-]\s*/giu;
const INLINE_CARD_PREFIX = /^(?:(?:siyah|karanlık|beyaz)\s+ekranda\s+)?(?:(?:kırmızı|beyaz|sarı|yeşil|mavi|altın)\s+(?:renkli\s+)?yazıyla|yazı\s*kartı|ekranda\s*(?:şu\s*)?yazı|başlık\s*kartı|daktilo\s+yazısı(?:\s+ve\s+seslendirme)?(?:\s+ile\s+kamu\s+spotu)?|\d+\s*[.)-]?\s*spot)\s*[:：–—-]?\s*/iu;

export interface TitleCardStyle {
  fontColor: string;
  backgroundColor: string;
  isRed: boolean;
  isTypewriter: boolean;
}

/** The exact on-screen text of a title card: whatever follows the last "Yazı kartı:" or "Siyah ekranda kırmızı yazıyla" label. */
export function titleCardText(description: string): string {
  let start = 0;
  for (const match of description.matchAll(TITLE_LABEL)) start = (match.index ?? 0) + match[0].length;
  let cleaned = description.slice(start).trim();
  while (INLINE_CARD_PREFIX.test(cleaned)) {
    cleaned = cleaned.replace(INLINE_CARD_PREFIX, "").trim();
  }
  return cleaned.replace(/^["“”'«]+|["“”'»]+$/g, "").trim() || description.trim();
}

/** Detects color and typewriter styling cues from the shot's description or screenText. */
export function titleCardStyle(description: string, screenText = ""): TitleCardStyle {
  const combined = `${description} ${screenText}`;
  const isRed = /(?:kırmızı\s+(?:renkli\s+)?yazı|red\s+(?:text|letter|type|typography)|david\s+and\s+goliath)/iu.test(combined);
  const isTypewriter = /(?:daktilo|typewriter|kamu\s+spotu)/iu.test(combined);
  if (isRed) {
    return { fontColor: "0xE52222", backgroundColor: "0x000000", isRed: true, isTypewriter };
  }
  if (isTypewriter) {
    return { fontColor: "0xF2F3F1", backgroundColor: "0x08090B", isRed: false, isTypewriter: true };
  }
  return { fontColor: "0xF2F3F1", backgroundColor: "0x111214", isRed: false, isTypewriter: false };
}
