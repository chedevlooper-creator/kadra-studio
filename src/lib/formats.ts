/** Output shapes for sharing a finished film. Safe to import in the browser. */

export type ExportMode = "fit" | "fill";

export interface ExportFormat { id: string; label: string; hint: string; width: number; height: number }

export const EXPORT_FORMATS: ExportFormat[] = [
  { id: "vertical", label: "Dikey 9:16", hint: "TikTok, Reels, Shorts", width: 720, height: 1280 },
  { id: "square", label: "Kare 1:1", hint: "Instagram, X", width: 1080, height: 1080 },
  { id: "wide-hd", label: "Yatay Full HD", hint: "YouTube, 1920×1080", width: 1920, height: 1080 },
];

export const EXPORT_MODES: { id: ExportMode; label: string; hint: string }[] = [
  { id: "fit", label: "Tamamı görünsün", hint: "Kenarlar bulanık dolgu olur" },
  { id: "fill", label: "Ortadan kırp", hint: "Kadrajı doldurur, kenarlar kesilir" },
];

export const exportFormatOf = (id: string) => EXPORT_FORMATS.find((format) => format.id === id) ?? null;
