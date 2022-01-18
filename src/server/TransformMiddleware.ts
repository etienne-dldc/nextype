import { createKey } from 'miid';
import * as zenjson from 'zenjson';
import { dynamicMiddleware } from '.';
import { ApiResponse } from './ApiResponse';
import { BaseResponse } from './BaseResponse';
import { Context } from './Context';
import { GsspResponse } from './GsspResponse';
import { Middleware } from './Middleware';

export const TransformKey = createKey<Required<TransformOptions>>({ name: 'Transform' });

export type TransformOptions = {
  sanitize?: (value: unknown) => unknown;
  restore?: (value: unknown) => unknown;
};

export function TransformMiddleware<Res extends BaseResponse>({
  restore = zenjson.restore,
  sanitize = zenjson.sanitize,
}: TransformOptions = {}): Middleware<Res> {
  return dynamicMiddleware<Res>(async (ctx, next) => {
    const body = ctx.body;
    const isJson = isPlainObject(body) || Array.isArray(body);
    let nextCtx = ctx.with(TransformKey.Provider({ restore, sanitize }));
    if (isJson) {
      nextCtx = nextCtx.with(Context.BodyKey.Provider(restore(body)));
    }
    const res = await next(nextCtx);
    if (res instanceof ApiResponse) {
      const jsonRes = isPlainObject(res.body) || Array.isArray(res.body);
      if (jsonRes) {
        return res.with(ApiResponse.BodyKey.Provider(sanitize(res.body)));
      }
      return res;
    }
    if (res instanceof GsspResponse) {
      return res.with(GsspResponse.ResultKey.Provider(sanitize(res.result) as any));
    }
    return res;
  });
}

function isPlainObject<Value>(value: unknown): value is Record<PropertyKey, Value> {
  if (Object.prototype.toString.call(value) !== '[object Object]') {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === null || prototype === Object.prototype;
}
