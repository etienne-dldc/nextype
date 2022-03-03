import { Context } from './Context';
import { GsspResponse } from './GsspResponse';
import { GsspMiddleware } from './Middleware';

export function PropsMiddleware<Props, Params>(
  getProps: (ctx: Context, params: Params) => Promise<Props>
): GsspMiddleware {
  return async (ctx) => {
    const props = await getProps(ctx, ctx.body as any);
    return GsspResponse.create({
      props,
    });
  };
}
