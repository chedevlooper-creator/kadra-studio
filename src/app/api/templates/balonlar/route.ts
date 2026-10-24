import { z } from 'zod';
import { api, json, readBody } from '@/lib/http';
import { repository } from '@/lib/store';
import { balonlarMasterTemplate } from '@/lib/templates/balonlar-master';
import { flowTemplate } from '@/lib/templates/flow-template';
export const runtime = 'nodejs';
export async function POST(request: Request) {
  return api(request, async () => {
    const { aspectRatio, variant } = await readBody(
      request,
      z.object({
        aspectRatio: z.enum(['16:9', '9:16', '1:1']).default('16:9'),
        variant: z.enum(['master', 'flow']).default('master'),
      }).strict(),
    );
    const template = variant === 'flow' ? flowTemplate(aspectRatio) : balonlarMasterTemplate(aspectRatio);
    return json({ project: await repository.importStoryboard(template) }, 201);
  }, true);
}
