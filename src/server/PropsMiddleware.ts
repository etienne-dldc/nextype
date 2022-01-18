import { Context } from './Context';
import { GsspResponse } from './GsspResponse';
import { GsspMiddleware } from './Middleware';

export function PropsMiddleware<Props>(getProps: (ctx: Context) => Promise<Props>): GsspMiddleware {
  return async (ctx) => {
    const props = await getProps(ctx);
    return GsspResponse.create({
      props,
    });
  };
}
