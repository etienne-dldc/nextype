import { GetServerSideProps } from 'next';
import { ApiError } from '../shared';
import { ALL_HTTP_METHODS, Context, HttpMethod } from './Context';
import { GsspResponse } from './GsspResponse';
import { composeGssp, GsspMiddleware } from './Middleware';

export function createGssp(...middlewares: Array<GsspMiddleware | null>): GetServerSideProps {
  const rootMid = composeGssp(...middlewares);
  return async (context) => {
    const rawMethod = context.req.method;
    if (!rawMethod) {
      throw new ApiError({ type: 'MethodNotFound' });
    }
    const method = rawMethod.toUpperCase();
    if (!ALL_HTTP_METHODS.includes(method as HttpMethod)) {
      throw ApiError.createRpcError({ type: 'InvalidMethod', received: method });
    }
    const ctx = Context.create({
      mode: 'Gssp',
      method: method as HttpMethod,
      req: context.req,
      body: context.params,
      query: context.query,
    });
    const result = await rootMid(ctx, async () => {
      return GsspResponse.create({ props: {} });
    });
    if (result.status) {
      context.res.statusCode = result.status;
    }
    if (result.headers) {
      for (const [key, value] of Object.entries(result.headers)) {
        context.res.setHeader(key, value);
      }
    }
    return result.result;
  };
}
