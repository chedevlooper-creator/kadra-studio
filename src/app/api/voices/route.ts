import { api, json } from "@/lib/http";
import { localVoices } from "@/lib/production/narration";
import { GMI_VOICES } from "@/lib/voices";
export const runtime = "nodejs";
/** The voices narration can use on this computer (free macOS voices) and through GMI (paid). */
export async function GET(request: Request) {
  return api(request, async () => json({ local: await localVoices(), gmi: GMI_VOICES }));
}
