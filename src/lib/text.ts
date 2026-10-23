const TITLE_LABEL = /(?:yazı\s*kartı|ekranda\s*(?:şu\s*)?yazı|başlık\s*kartı)\s*[:：–—-]\s*/giu;

/** The exact on-screen text of a title card: whatever follows the last "Yazı kartı:" style label. */
export function titleCardText(description: string): string {
  let start = 0;
  for (const match of description.matchAll(TITLE_LABEL)) start = (match.index ?? 0) + match[0].length;
  return description.slice(start).trim().replace(/^["“”'«]+|["“”'»]+$/g, "").trim() || description.trim();
}
