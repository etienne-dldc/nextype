import type { ApiMiddleware } from '../server/Middleware';

export const ROUTE_INTERNAL = Symbol('ROUTE_INTERNAL');

export type RpcRouteKind = 'Query' | 'Mutation';
export type RpcRoutesAny = Record<string, RpcRouteAny>;
export type RpcRouteAny = RpcRoute<RpcRouteKind, any, any>;

export type RpcRouteResult<Q extends RpcRouteAny> = Q[typeof ROUTE_INTERNAL]['result'];

export type RpcRoute<Kind extends RpcRouteKind, Params, Result> = {
  // fake property to keep types
  [ROUTE_INTERNAL]: { result: Result; params: Params };
  kind: Kind;
  middleware: ApiMiddleware;
};

export type RouteParams<Route extends RpcRouteAny> = Route[typeof ROUTE_INTERNAL]['params'];

export type RouteQueryKey<Routes extends RpcRoutesAny, Key extends keyof Routes> = RouteParams<
  Routes[Key]
> extends null
  ? [Key]
  : [Key, RouteParams<Routes[Key]>];

export type ExtractQueryRpcRoutesKeys<Routes extends RpcRoutesAny> = {
  [K in keyof Routes]: Routes[K]['kind'] extends 'Query' ? K : never;
}[keyof Routes];

export type ExtractMutationRpcRoutesKeys<Routes extends RpcRoutesAny> = {
  [K in keyof Routes]: Routes[K]['kind'] extends 'Mutation' ? K : never;
}[keyof Routes];
