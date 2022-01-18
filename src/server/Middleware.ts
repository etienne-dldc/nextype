import { Context, Mode } from './Context';
import { BaseResponse } from './BaseResponse';
import { ApiResponse } from './ApiResponse';
import { GsspResponse } from './GsspResponse';
import * as miid from 'miid';
import { ApiError } from '../shared';

export type MaybePromise<T> = T | Promise<T>;

export type Middleware<Res extends BaseResponse> = miid.Middleware<
  Context,
  MaybePromise<Res>,
  Promise<Res>
>;
export type Middlewares<Res extends BaseResponse> = miid.Middlewares<
  Context,
  MaybePromise<Res>,
  Promise<Res>
>;
export type Next<Res extends BaseResponse> = miid.Next<Context, Promise<Res>>;

export type GsspMiddleware = Middleware<GsspResponse>;
export type GsspMiddlewares = Middlewares<GsspResponse>;
export type GsspNext = Next<GsspResponse>;

export type ApiMiddleware = Middleware<ApiResponse>;
export type ApiMiddlewares = Middlewares<ApiResponse>;
export type ApiNext = Next<ApiResponse>;

export function compose<Res extends BaseResponse>(
  ...mids: Array<Middleware<Res> | null>
): Middleware<Res> {
  return miid.composeAdvanced((out) => Promise.resolve(out), mids);
}

export function composeApi(...mids: Array<ApiMiddleware | null>): ApiMiddleware {
  return compose(...mids);
}

export function composeGssp(...mids: Array<GsspMiddleware | null>): GsspMiddleware {
  return compose(...mids);
}

export type DynamicMiddleware = <Res extends BaseResponse>() => Middleware<Res>;

export function dynamicMiddleware<Res extends BaseResponse>(
  mid: Middleware<ApiResponse | GsspResponse | BaseResponse>
): Middleware<Res> {
  return async (ctx, next) => {
    const res = await mid(ctx, next);
    const resMode: Mode | null =
      res instanceof ApiResponse ? 'Api' : res instanceof GsspResponse ? 'Gssp' : null;
    if (resMode === null) {
      throw new ApiError({ type: 'InvalidMiddlewareResult' });
    }
    if (resMode !== ctx.mode) {
      throw new ApiError({ type: 'InvalidMiddlewareResult' });
    }
    return res as any;
  };
}

export function dynamicMiddlewareFactory(
  mid: Middleware<ApiResponse | GsspResponse | BaseResponse>
): DynamicMiddleware {
  return () => dynamicMiddleware(mid);
}

// export const AuthenticationKeyConsumer = AuthenticationKey.Consumer;

// export const AuthenticatedKey = BlackBox.createKey<MeUser>({ name: "MeUser" });
// export const AuthenticatedKeyConsumer = AuthenticatedKey.Consumer;

// export const IsAnonymousMiddleware: Middleware<unknown> = async (ctx, params, next) => {
//   const meUser = ctx.getOrFail(AuthenticationKeyConsumer);
//   if (meUser) {
//     return new RpcResponseError({ type: "Unauthorized" });
//   }
//   return next(ctx, params);
// };

// function createIsAuthenticatedMiddleware({ adminOnly = false }: { adminOnly?: boolean } = {}): Middleware<unknown> {
//   return async (ctx, params, next) => {
//     const meUser = ctx.getOrFail(AuthenticationKeyConsumer);
//     if (!meUser) {
//       return new RpcResponseError({ type: "Unauthorized" });
//     }
//     if (adminOnly && meUser.admin === false) {
//       return new RpcResponseError({ type: "Unauthorized" });
//     }
//     return next(ctx.with(AuthenticatedKey.Provider(meUser)), params);
//   };
// }

// export const IsAuthenticatedMiddleware = createIsAuthenticatedMiddleware();

// export const IsAdminAuthenticatedMiddleware = createIsAuthenticatedMiddleware({ adminOnly: true });

// export function compose<Params>(...middlewares: Array<Middleware<Params> | null>): Middleware<Params> {
//   const resolved: Array<Middleware<Params>> = middlewares.filter(
//     (v: Middleware<Params> | null): v is Middleware<Params> => {
//       return v !== null;
//     }
//   );
//   resolved.forEach((middle, index) => {
//     if (typeof middle !== "function") {
//       throw new RpcError({ type: "MiddlewareIsNotAFunction", index, middleware: middle });
//     }
//   });

//   return function (ctx, params, next): Promise<RpcResponse> {
//     return dispatch(0, ctx, params);
//     function dispatch(i: number, context: BlackBox, params: Params): Promise<RpcResponse> {
//       const middle = resolved[i];
//       if (!middle) {
//         return next(context, params);
//       }
//       return middle(context, params, (ctx, params) => dispatch(i + 1, ctx, params));
//     }
//   };
// }
