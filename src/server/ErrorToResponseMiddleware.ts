import { ApiError, GetAppErrorStatus } from '../shared';
import { ApiResponse } from './ApiResponse';
import { BaseResponse } from './BaseResponse';
import { GsspResponse } from './GsspResponse';
import { dynamicMiddleware, Middleware } from './Middleware';

export function ErrorToApiResponseMiddleware<Res extends BaseResponse, AppError>(
  getAppErrorStatus: GetAppErrorStatus<AppError>
): Middleware<Res> {
  return dynamicMiddleware(async (ctx, next) => {
    try {
      const res = await next(ctx);
      return res;
    } catch (error) {
      const mode = ctx.mode;
      const rpcError = errorToApiError(error);
      if (mode === 'Api') {
        return rpcErrorToApiResponse(rpcError, getAppErrorStatus);
      }
      if (mode === 'Gssp') {
        return rpcErrorToGsspResponse(rpcError, getAppErrorStatus);
      }
      return expectNever(mode);
    }
  });

  function rpcErrorToGsspResponse(
    error: ApiError<AppError>,
    getAppErrorStatus: GetAppErrorStatus<AppError>
  ): GsspResponse {
    const status = ApiError.getStatus(error, getAppErrorStatus);
    return GsspResponse.create({
      props: error.details,
    }).with(GsspResponse.StatusKey.Provider(status));
  }

  function rpcErrorToApiResponse(
    error: ApiError<AppError>,
    getAppErrorStatus: GetAppErrorStatus<AppError>
  ): ApiResponse {
    const status = ApiError.getStatus(error, getAppErrorStatus);
    return ApiResponse.create(status, error.details, []);
  }

  function errorToApiError(error: unknown): ApiError<AppError> {
    if (error instanceof ApiError) {
      return error;
    }
    console.error(error);
    return new ApiError({ type: 'InternalServerError' });
  }
}

function expectNever(val: never): never {
  throw new Error('Unexpected never: ' + val);
}
