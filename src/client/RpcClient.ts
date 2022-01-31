import { z } from 'zod';
import * as zenjson from 'zenjson';
import {
  useQuery,
  useMutation,
  UseQueryOptions,
  UseQueryResult,
  UseMutationOptions,
  UseMutationResult,
  MutateOptions,
} from 'react-query';
import type {
  ExtractMutationRpcRoutesKeys,
  ExtractQueryRpcRoutesKeys,
  RpcRouteResult,
  RpcRoutesAny,
  ROUTE_INTERNAL,
  RouteQueryKey,
} from '../shared';
import { ApiError } from '../shared';

export type RpcClientOptions = {
  rpcPath: (route: string) => string;
  sanitize?: (data: unknown) => unknown;
  restore?: (data: unknown) => unknown;
};

type INTER = typeof ROUTE_INTERNAL;

export function createRpcClient<Routes extends RpcRoutesAny, AppError>(options: RpcClientOptions) {
  const rpcFetcher = createRpcFetcher<Routes>(options);
  const rpcQueryKey = createRpcQueryKey<Routes>();
  const useRpcMutation = createUseRpcMutation<Routes, AppError>(rpcFetcher);
  const useRpcQuery = createUseRpcQuery<Routes, AppError>(rpcFetcher);

  return {
    rpcFetcher,
    useRpcQuery,
    useRpcMutation,
    rpcQueryKey,
  };
}

export type RpcFetcher<Routes extends RpcRoutesAny> = <Key extends keyof Routes>(
  key: Key,
  type: 'Query' | 'Mutation',
  params: unknown
) => Promise<RpcRouteResult<Routes[Key]>>;

export function createRpcFetcher<Routes extends RpcRoutesAny>({
  rpcPath,
  restore = zenjson.restore,
  sanitize = zenjson.sanitize,
}: RpcClientOptions): RpcFetcher<Routes> {
  return async function clientFetcher<Key extends keyof Routes>(
    key: Key,
    type: 'Query' | 'Mutation',
    params: unknown
  ): Promise<RpcRouteResult<Routes[Key]>> {
    if (typeof window === 'undefined') {
      throw new Error(`UnexpectedFetchOnServer`);
    }
    try {
      // fake url because window.URL need full url
      const url = new window.URL('http://example.com' + rpcPath(key as string));
      const hasParams = params !== null && params !== undefined;
      if (type === 'Query' && hasParams) {
        url.searchParams.append('params', JSON.stringify(sanitize(params)));
      }
      const res = await fetch(url.pathname + url.search, {
        method: type === 'Query' ? 'GET' : 'POST',
        body: type === 'Mutation' && hasParams ? JSON.stringify(sanitize(params)) : undefined,
        headers: { 'Content-Type': 'application/json' },
      });
      if (res.ok) {
        if (res.status === 201) {
          return null as any;
        }
        const data = restore(await res.json());
        return data as any;
      }
      // Server returned an error, re-instantiate RpcError with data
      throw new ApiError(restore(await res.json()) as any);
    } catch (error) {
      console.error(error);
      if (error instanceof ApiError) {
        throw error;
      }
      if (error instanceof Error) {
        throw new ApiError({ type: 'NetworkError', error });
      }
      // Don't know what's wrong here...
      throw new ApiError({ type: 'FatalClientError', error });
    }
  };
}

export function createRpcQueryKey<Routes extends RpcRoutesAny>() {
  return function rpcQueryKey<Key extends ExtractQueryRpcRoutesKeys<Routes>>(
    key: RouteQueryKey<Routes, Key>
  ): RouteQueryKey<Routes, Key> {
    return key;
  };
}

export function createUseRpcQuery<Routes extends RpcRoutesAny, AppError>(
  rpcClient: RpcFetcher<Routes>
) {
  type QueryKeys = ExtractQueryRpcRoutesKeys<Routes>;
  type RouteQueryKey<Key extends QueryKeys> = Routes[Key][INTER]['params'] extends null
    ? [Key]
    : [Key, Routes[Key][INTER]['params']];

  return function useRpcQuery<Key extends QueryKeys>(
    input: RouteQueryKey<Key>,
    options?: Omit<
      UseQueryOptions<unknown, ApiError<AppError>, RpcRouteResult<Routes[Key]>, RouteQueryKey<Key>>,
      'queryKey' | 'queryFn'
    >
  ): UseQueryResult<RpcRouteResult<Routes[Key]>, ApiError<AppError>> {
    return useQuery({
      ...options,
      queryKey: input,
      queryFn: async () => {
        const [key, params] = input;
        return rpcClient(key, 'Query', params);
      },
    });
  };
}

export function createUseRpcMutation<Routes extends RpcRoutesAny, AppError>(
  rpcClient: RpcFetcher<Routes>
) {
  type MutKey = ExtractMutationRpcRoutesKeys<Routes>;
  type RouteMutationVariablesValue<Key extends MutKey> = Routes[Key][INTER]['params'] extends null
    ? null
    : Routes[Key][INTER]['params'];

  type RouteMutationVariables<Key extends MutKey> = Routes[Key][INTER]['params'] extends null
    ? [
        params?: null,
        options?: MutateOptions<
          RpcRouteResult<Routes[Key]>,
          ApiError<AppError>,
          Routes[Key][INTER]['params'] extends z.Schema<infer T> ? T : null,
          unknown
        >
      ]
    : [
        params: Routes[Key][INTER]['params'],
        options?: MutateOptions<
          RpcRouteResult<Routes[Key]>,
          ApiError<AppError>,
          Routes[Key][INTER]['params'] extends null ? null : Routes[Key][INTER]['params'],
          unknown
        >
      ];
  type UseRpcMutationResult<Key extends MutKey> = Omit<
    UseMutationResult<
      RpcRouteResult<Routes[Key]>,
      ApiError<AppError>,
      RouteMutationVariablesValue<Key>,
      unknown
    >,
    'mutate' | 'mutateAsync'
  > & {
    mutate: (...params: RouteMutationVariables<Key>) => void;
    mutateAsync: (...params: RouteMutationVariables<Key>) => Promise<RpcRouteResult<Routes[Key]>>;
  };
  return function useRpcMutation<Key extends MutKey>(
    key: Key,
    options: Omit<
      UseMutationOptions<
        RpcRouteResult<Routes[Key]>,
        ApiError<AppError>,
        RouteMutationVariablesValue<Key>,
        unknown
      >,
      'mutationKey' | 'mutationFn'
    > = {}
  ): UseRpcMutationResult<Key> {
    return useMutation({
      ...options,
      mutationKey: key as string,
      mutationFn: async (params) => {
        return rpcClient(key, 'Mutation', params);
      },
    }) as any;
  };
}
