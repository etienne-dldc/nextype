import { NextApiHandler, NextApiRequest, NextApiResponse } from 'next';
import { Context, ALL_HTTP_METHODS, HttpMethod } from './Context';
import { ApiMiddleware, composeApi } from './Middleware';
import { ApiError } from '../shared';
import { ApiResponse } from './ApiResponse';

export function createApiHandler(...middlewares: Array<ApiMiddleware | null>): NextApiHandler {
  const rootMid = composeApi(...middlewares);
  return async function api(req, res): Promise<void> {
    const ctx = contextFromReq(req);
    const result = await rootMid(ctx, () => {
      throw new ApiError({ type: 'ApiDidNotRespond' });
    });
    return sendResponse(res, result);
  };
}

function contextFromReq(req: NextApiRequest): Context {
  const rawMethod = req.method;
  if (!rawMethod) {
    throw new ApiError({ type: 'MethodNotFound' });
  }
  const method = rawMethod.toUpperCase();
  if (!ALL_HTTP_METHODS.includes(method as HttpMethod)) {
    throw ApiError.createRpcError({ type: 'InvalidMethod', received: method });
  }
  return Context.create({
    req,
    method: method as HttpMethod,
    body: req.body,
    query: req.query,
    mode: 'Api',
  });
}

function sendResponse(res: NextApiResponse, response: ApiResponse): void {
  response.headers.forEach(([key, val]) => {
    res.setHeader(key, val);
  });
  if (response.status === 201) {
    res.status(response.status).end();
    return;
  }
  // TODO: handle other type of body (other than json)
  return res.status(response.status).json(response.body);
}
