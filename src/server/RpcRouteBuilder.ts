import * as z from 'zod';
import { compose, ApiMiddleware, ApiMiddlewares } from './Middleware';
import { Context } from './Context';
import { ApiResponse, Headers } from './ApiResponse';
import {
  RpcRouteKind,
  RpcRoute as IRoute,
  ROUTE_INTERNAL,
  RpcRoutesAny,
  ApiError,
} from '../shared';
import { RpcRouteInfosKey } from './RpcMiddleware';

export const Route = {
  query,
  mutation,
  group,
  prefix,
  namespace,
  resolve,
};

export class RpcResult<T> {
  [ROUTE_INTERNAL]: true;
  result: T;
  headers?: Headers;

  constructor(result: T, headers?: Headers) {
    this.result = result;
    this.headers = headers;
  }
}

export type Run<Result> = (ctx: Context) => Promise<null | Result | RpcResult<Result>>;
export type RunWithParams<Result, Params> = (
  ctx: Context,
  params: Params
) => Promise<null | Result | RpcResult<Result>>;

export type RouteBuilderParams<Kind extends RpcRouteKind, Params> = {
  resolve: <Result = null>(run: RunWithParams<Result, Params>) => IRoute<Kind, Params, Result>;
};

export type RouteBuilderEnd<Kind extends RpcRouteKind> = {
  resolve: <Result = null>(run: Run<Result>) => IRoute<Kind, null, Result>;
  params<Params>(params: z.Schema<Params>): RouteBuilderParams<Kind, Params>;
};

export type RouteBuilderMiddlewares<Kind extends RpcRouteKind> = {
  middlewares(...middlewares: ApiMiddlewares): RouteBuilderEnd<Kind>;
};

export type RouteBuilder<Kind extends RpcRouteKind> = RouteBuilderEnd<Kind> &
  RouteBuilderMiddlewares<Kind>;

function route<Kind extends RpcRouteKind>(kind: Kind): RouteBuilder<Kind> {
  return {
    middlewares: (...middlewares) => {
      return queryBuilderEnd(middlewares);
    },
    ...queryBuilderEnd([]),
  };

  function createRoute(...middlewares: ApiMiddlewares): IRoute<Kind, any, any> {
    return {
      [ROUTE_INTERNAL]: null as any,
      kind,
      middleware: compose(...middlewares),
    };
  }

  function queryBuilderEnd(middlewares: ApiMiddlewares) {
    return {
      resolve: <Result>(run: Run<Result>): IRoute<Kind, null, Result> => {
        return createRoute(...middlewares, RunMiddleware(run));
      },
      params<Params>(params: z.Schema<Params>) {
        return {
          resolve: <Result>(run: RunWithParams<Result, Params>): IRoute<Kind, Params, Result> => {
            return createRoute(
              ...middlewares,
              ValidateSchemaMiddleware(params),
              RunMiddleware(run)
            );
          },
        };
      },
    };
  }
}

function ValidateSchemaMiddleware<T>(schema: z.Schema<T>): ApiMiddleware {
  return async (ctx, next) => {
    const infos = ctx.getOrFail(RpcRouteInfosKey.Consumer);
    if (infos.params === undefined || infos.params === null) {
      throw ApiError.createRpcError({ type: 'MissingParams', routeKey: infos.key });
    }
    const parsed = schema.safeParse(infos.params);
    if (parsed.success === false) {
      throw ApiError.createRpcError({
        type: 'InvalidParams',
        errors: parsed.error.errors,
        routeKey: infos.key,
      });
    }
    return next(ctx.with(RpcRouteInfosKey.Provider({ ...infos, params: parsed.data })));
  };
}

function RunMiddleware(run: RunWithParams<any, any>): ApiMiddleware {
  return async (ctx) => {
    const infos = ctx.getOrFail(RpcRouteInfosKey.Consumer);
    try {
      const rpcResult = await run(ctx, infos.params);
      const result = rpcResult instanceof RpcResult ? rpcResult.result : rpcResult;
      const headers = rpcResult instanceof RpcResult ? rpcResult.headers : undefined;
      const status = result === null ? 201 : 200;
      return ApiResponse.create(status, result, headers);
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      console.error(error);
      throw ApiError.createRpcError({ type: 'RouteError', routeKey: infos.key });
    }
  };
}

function query(): RouteBuilder<'Query'> {
  return route('Query');
}

function mutation(): RouteBuilder<'Mutation'> {
  return route('Mutation');
}

function group<Routes extends RpcRoutesAny>(
  middleware: ApiMiddleware | null,
  routes: Routes
): Routes {
  return Object.fromEntries(
    Object.entries(routes).map(([key, route]) => {
      return [
        key,
        {
          ...route,
          middleware: middleware ? compose(middleware, route.middleware) : route.middleware,
        },
      ];
    })
  ) as any;
}

type StringOnly<T> = Exclude<T, symbol | number>;

type Prefixed<Prefix extends string, Routes extends RpcRoutesAny> = {
  [K in keyof Routes as `${Prefix}.${StringOnly<K>}`]: Routes[K];
};

function prefix<Prefix extends string, Routes extends RpcRoutesAny>(
  prefix: Prefix,
  routes: Routes
): Prefixed<Prefix, Routes> {
  return Object.fromEntries(
    Object.entries(routes).map(([key, route]) => {
      return [`${prefix}.${key}`, { ...(route as any), name: `${prefix}.${(route as any).name}` }];
    })
  ) as any;
}

function namespace<Prefix extends string, Routes extends RpcRoutesAny>(
  pref: Prefix,
  middleware: ApiMiddleware | null,
  routes: Routes
): Prefixed<Prefix, Routes> {
  return prefix<Prefix, Routes>(pref, group(middleware, routes));
}

async function resolve<Routes extends RpcRoutesAny>(
  routes: Routes,
  ctx: Context
): Promise<ApiResponse> {
  const infos = ctx.getOrFail(RpcRouteInfosKey.Consumer);
  const route = routes[infos.key];
  if (!route) {
    throw ApiError.createRpcError({ type: 'RouteNotFound', routeKey: infos.key });
  }
  if (route.kind !== infos.kind) {
    throw ApiError.createRpcError({
      type: 'InvalidRouteKind',
      routeKey: infos.key,
      received: infos.kind,
    });
  }
  const response = await route.middleware(ctx, async () => {
    throw ApiError.createRpcError({ type: 'RouteDidNotRespond', routeKey: infos.key });
  });
  if (response instanceof ApiResponse) {
    return response;
  }
  throw ApiError.createRpcError({ type: 'RouteDidNotRespond', routeKey: infos.key });
}
