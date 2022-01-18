import { RpcRouteKind, RpcRoutesAny, ApiError } from '../shared';
import { Route } from './RpcRouteBuilder';
import { Context } from './Context';
import { ParsedUrlQuery } from 'querystring';
import { ApiMiddleware } from './Middleware';
import { createKey } from 'miid';
import { TransformKey } from './TransformMiddleware';

export type RpcRouteInfos = {
  readonly key: string;
  readonly kind: RpcRouteKind;
  readonly params: unknown;
  readonly query: ParsedUrlQuery | null;
};

export const RpcRouteInfosKey = createKey<RpcRouteInfos>({ name: 'RpxRouteInfos' });

export function RpcMiddleware<Routes extends RpcRoutesAny>(
  routes: Routes,
  rpcPath: (query: ParsedUrlQuery) => string
): ApiMiddleware {
  return async (ctx) => {
    const routeInfo = extractRouteInfo(ctx, rpcPath);
    const subCtx = ctx.with(RpcRouteInfosKey.Provider(routeInfo));
    const response = await Route.resolve(routes, subCtx);
    return response;
  };
}

function extractRouteInfo(ctx: Context, rpcPath: (query: ParsedUrlQuery) => string): RpcRouteInfos {
  const routeKey = rpcPath(ctx.query);
  const method = ctx.method;
  const routeKind =
    { GET: 'Query' as const, POST: 'Mutation' as const }[method.toUpperCase()] ?? null;
  if (routeKind === null) {
    throw ApiError.createRpcError({ type: 'InvalidMethod', received: method });
  }
  const { params, query } = extractParamQuery(ctx, routeKind);
  return { kind: routeKind, key: routeKey, params, query };
}

function extractParamQuery(
  ctx: Context,
  routeKind: RpcRouteKind
): {
  params: unknown;
  query: ParsedUrlQuery | null;
} {
  const transform = ctx.get(TransformKey.Consumer);
  const restore = transform?.restore ?? ((x) => x);
  if (routeKind === 'Query') {
    const { params = '{}', ...query } = ctx.query;
    const paramsStr = Array.isArray(params) ? '{}' : params;
    return { params: restore(JSON.parse(paramsStr)), query: query as ParsedUrlQuery };
  }
  // Mutation
  return {
    params: restore(ctx.body ?? {}),
    query: ctx.query ?? null,
  };
}

/*
export function createRpcApi<Routes extends RoutesAny, AppError>(
  routes: Routes,
  {
    rpcPath,
    restore = zenjson.restore,
    sanitize = zenjson.sanitize,
    getAppErrorStatus,
    enhanceContext,
  }: RpcApiOptions<AppError>
): NextApiHandler {
  return async function rpcApi(req, res): Promise<void> {
    try {
      const baseCtx = contextFromReq(req, rpcPath, restore);
      const ctx = enhanceContext ? enhanceContext(baseCtx, req) : baseCtx;
      const result = await RpcRoute.resolve(routes, ctx);
      return sendResponse(res, result, sanitize);
    } catch (error) {
      if (error instanceof ApiError) {
        // this error is expected
        return sendResponse(res, rpcErrorToApiResponse(error, getAppErrorStatus), sanitize);
      }
      // otherwise log error and return generic error
      console.error(error);
      const rpcErr = new ApiError<AppError>({ type: "ApiServerError", details: { type: "InternalServerError" } });
      return sendResponse(res, rpcErrorToApiResponse(rpcErr, getAppErrorStatus), sanitize);
    }
  };
}

function contextFromReq(
  req: NextApiRequest,
  rpcPath: (req: NextApiRequest) => string,
  restore: (data: unknown) => unknown
): Context {
  const routeKey = rpcPath(req);
  const method = req.method;
  if (!method) {
    throw new ApiError({ type: "ApiServerError", details: { type: "MethodNotFound" } });
  }
  const routeKind = { GET: "Query" as const, POST: "Mutation" as const }[method.toUpperCase()] ?? null;
  if (routeKind === null) {
    throw new ApiError({ type: "ApiServerError", details: { type: "InvalidMethod", method } });
  }
  const { params, query } = extractParamQuery(req, routeKind, restore);
  return Context.create(req, params, query, "Api").with(RouteInfosKey.Provider({ kind: routeKind, key: routeKey }));
}

function extractParamQuery(
  req: NextApiRequest,
  routeKind: RouteKind,
  restore: (data: unknown) => unknown
): {
  params: unknown;
  query: ParsedUrlQuery | null;
} {
  if (routeKind === "Query") {
    const { params = "{}", ...query } = req.query;
    const paramsStr = Array.isArray(params) ? "{}" : params;
    return { params: restore(JSON.parse(paramsStr)), query: query as ParsedUrlQuery };
  }
  // Mutation
  return {
    params: restore(req.body ?? {}),
    query: req.query ?? null,
  };
}

function sendResponse(res: NextApiResponse, response: ApiResponse, sanitize: (data: unknown) => unknown): void {
  response.headers.forEach(([key, val]) => {
    res.setHeader(key, val);
  });
  if (response.status === 201) {
    res.status(response.status).end();
    return;
  }
  // TODO: handle other type of body (other than json)
  return res.status(response.status).json(sanitize(response.body));
}

function rpcErrorToApiResponse<AppError>(
  error: ApiError<AppError>,
  appErrorStatus: (err: AppError) => number
): ApiResponse {
  const status = ApiError.getStatus(error, appErrorStatus);
  return ApiResponse.create(status, error.details, []);
}
*/
