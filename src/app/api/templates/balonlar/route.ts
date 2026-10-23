import { z } from 'zod';
import { api, json, readBody } from '@/lib/http';
import { repository } from '@/lib/store';
import { flowTemplate } from '@/lib/templates/flow-template';
export const runtime = 'nodejs';
export async function POST(request: Request) {
  return api(request, async () => {
    const { aspectRatio } = await readBody(request, z.object({ aspectRatio: z.enum(['16:9','9:16','1:1']).default('16:9') }).strict());
    return json({ project: await repository.importStoryboard(flowTemplate(aspectRatio)) }, 201);
  }, true);
}
