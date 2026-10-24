import { findFfmpeg } from "../production/ffmpeg";
import type { ProviderStatus } from "../types";
import { deepseekConfigured } from "./deepseek";
import { gmiConfigured } from "./gmi";
import { higgsfieldConfigured } from "./higgsfield";
import { nvidiaConfigured } from "./nvidia";

/** Reports which engines are usable without ever exposing a key to the browser. */
export async function providerStatus(): Promise<ProviderStatus> {
  return { nvidia: nvidiaConfigured(), gmi: gmiConfigured(), higgsfield: higgsfieldConfigured(), ffmpeg: Boolean(await findFfmpeg()), deepseek: deepseekConfigured() };
}
