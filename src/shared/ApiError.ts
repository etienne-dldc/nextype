import { CustomError } from 'ts-custom-error';
import { RpcRouteKind } from './RpcRoute';

export type RpcErrorDetails =
  | { type: 'InvalidMethod'; received: string }
  | { type: 'RouteError'; routeKey: string }
  | { type: 'MissingParams'; routeKey: string }
  | { type: 'InvalidParams'; routeKey: string; errors: Array<any> }
  | { type: 'RouteDidNotRespond'; routeKey: string }
  | { type: 'RouteNotFound'; routeKey: string }
  | { type: 'InvalidRouteKind'; routeKey: string; received: RpcRouteKind };

export type ApiErrorDetails<AppError> =
  | { type: 'AppError'; error: AppError }
  | { type: 'InternalServerError' }
  | { type: 'InvalidMiddlewareResult' }
  | { type: 'MethodNotFound' }
  | { type: 'ApiDidNotRespond' }
  | { type: 'RpcError'; details: RpcErrorDetails }
  | { type: 'NetworkError'; error: Error }
  | { type: 'FatalClientError'; error: unknown };

export type GetAppErrorStatus<AppError> = (err: AppError) => number;

/**
 * This error is passed from client to server
 */
export class ApiError<AppError> extends CustomError {
  static createAppError<AppError>(error: AppError): ApiError<AppError> {
    return new ApiError({ type: 'AppError', error });
  }

  static createRpcError<AppError>(details: RpcErrorDetails): ApiError<AppError> {
    return new ApiError({ type: 'RpcError', details });
  }

  static getStatus<AppError>(
    err: ApiError<AppError>,
    getAppErrorStatus: GetAppErrorStatus<AppError>
  ): number {
    switch (err.details.type) {
      case 'MethodNotFound':
        return 404;
      case 'NetworkError':
      case 'FatalClientError':
      case 'ApiDidNotRespond':
      case 'InvalidMiddlewareResult':
      case 'InternalServerError':
        return 500;
      case 'RpcError': {
        switch (err.details.details.type) {
          case 'InvalidMethod':
          case 'MissingParams':
          case 'InvalidParams':
            return 400;
          case 'RouteDidNotRespond':
          case 'RouteNotFound':
          case 'InvalidRouteKind':
            return 404;
          case 'RouteError':
            return 500;
          default:
            return expectNever(err.details.details);
        }
      }
      case 'AppError':
        return getAppErrorStatus(err.details.error);
      default:
        return expectNever(err.details);
    }
  }

  constructor(public readonly details: ApiErrorDetails<AppError>) {
    super(`RpcError: ${details.type}`);
  }
}

function expectNever(val: never): never {
  throw new Error('Unexpected never: ' + val);
}
