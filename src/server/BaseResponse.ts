import { KeyProvider, Stack, StackInternal } from 'miid';

/**
 * Base class for all response types (API and gSSP)
 */
export class BaseResponse extends Stack {
  constructor(internal: StackInternal<BaseResponse> | null = null) {
    super(internal);
  }

  with(...keys: Array<KeyProvider<any>>): BaseResponse {
    return Stack.applyKeys<BaseResponse>(this, keys, (internal) => new BaseResponse(internal));
  }
}
