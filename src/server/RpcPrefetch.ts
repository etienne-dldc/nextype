import { RpcRoutesAny, ExtractQueryRpcRoutesKeys, RouteQueryKey } from '../shared';
import {} from './RpcRouteBuilder';
import { dehydrate, QueryClient } from 'react-query';
import { GsspMiddleware } from './Middleware';
import { Context } from './Context';
import { Route } from './RpcRouteBuilder';
import { RpcRouteInfos, RpcRouteInfosKey } from './RpcMiddleware';
import { createKey } from 'miid';

export type PrefetchQueryFn<Routes extends RpcRoutesAny> = <
  Key extends ExtractQueryRpcRoutesKeys<Routes>
>(
  key: RouteQueryKey<Routes, Key>
) => Promise<void>;

export type RpcPrefecthContext<Routes extends RpcRoutesAny> = {
  queryClient: QueryClient;
  prefetchQuery: PrefetchQueryFn<Routes>;
};

export function createRpcPrefetch<Routes extends RpcRoutesAny>(routes: Routes) {
  const RpcPrefetchKey = createKey<RpcPrefecthContext<Routes>>({ name: 'RpcPrefetch' });

  const RpcPrefetchSetupMiddleware: GsspMiddleware = async (ctx, next) => {
    const queryClient = new QueryClient();
    function prefetchQuery<Key extends ExtractQueryRpcRoutesKeys<Routes>>(
      key: RouteQueryKey<Routes, Key>
    ): Promise<void> {
      return queryClient.prefetchQuery(key, async () => {
        const [name, params] = key;
        const routeInfo: RpcRouteInfos = {
          key: name as string,
          kind: 'Query',
          params,
          query: null,
        };
        const rpcCtx = ctx
          // switch to api mode
          .with(Context.ModeKey.Provider('Api'))
          // inject RPC infos
          .with(RpcRouteInfosKey.Provider(routeInfo));
        const result = await Route.resolve(routes, rpcCtx);
        if (result.headers.length > 0) {
          console.warn(`Cannot set header in prefetch (${name}, ${JSON.stringify(params)})`);
        }
        if (result.status >= 400) {
          console.warn(result.body);
          console.warn(`Prefetch of ${name} failed with status ${result.status}`);
          throw new Error(`Prefetch of ${name} failed with status ${result.status}`);
        }
        return result.body;
      });
    }
    const result = await next(ctx.with(RpcPrefetchKey.Provider({ queryClient, prefetchQuery })));
    return result.addProps({
      dehydratedState: dehydrate(queryClient),
    });
  };

  return {
    RpcPrefetchKeyConsumer: RpcPrefetchKey.Consumer,
    RpcPrefetchSetupMiddleware,
  };
}
