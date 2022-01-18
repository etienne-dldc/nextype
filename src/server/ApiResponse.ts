import { KeyProvider, Stack, StackInternal, createKey } from 'miid';
import { BaseResponse } from './BaseResponse';

export type Headers = Array<[key: string, value: string]>;

const BodyKey = createKey<Body>({ name: 'Body', defaultValue: null as any });
const StatusKey = createKey<number>({ name: 'Status', defaultValue: null as any });
const HeadersKey = createKey<Headers>({ name: 'Headers', defaultValue: null as any });

export type Body = unknown;

export class ApiResponse extends BaseResponse {
  static create(status: number, body: Body, headers: Headers | undefined = []): ApiResponse {
    return new ApiResponse().with(
      StatusKey.Provider(status),
      BodyKey.Provider(body),
      HeadersKey.Provider(headers)
    );
  }

  static BodyKey = BodyKey;
  static StatusKey = StatusKey;
  static HeadersKey = HeadersKey;

  private constructor(internal: StackInternal<ApiResponse> | null = null) {
    super(internal);
  }

  get headers() {
    return this.get(HeadersKey.Consumer);
  }

  get status() {
    return this.get(StatusKey.Consumer);
  }

  get body() {
    return this.get(BodyKey.Consumer);
  }

  with(...keys: Array<KeyProvider<any>>): ApiResponse {
    return Stack.applyKeys<ApiResponse>(this, keys, (internal) => new ApiResponse(internal));
  }

  addHeaders(...headers: Headers): ApiResponse {
    const prevHeaders = this.headers ?? [];
    return this.with(HeadersKey.Provider([...prevHeaders, ...headers]));
  }
}
