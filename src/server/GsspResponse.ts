import { KeyProvider, Stack, StackInternal, createKey } from 'miid';
import { BaseResponse } from './BaseResponse';
import { GetServerSidePropsResult } from 'next';
import { Headers } from './ApiResponse';

const ResultKey = createKey<GetServerSidePropsResult<any>>({
  name: 'GsspResult',
  defaultValue: null as any,
});

const StatusKey = createKey<number>({ name: 'Status' });
const HeadersKey = createKey<Headers>({ name: 'Headers' });

export class GsspResponse extends BaseResponse {
  static create<Props>(result: GetServerSidePropsResult<Props>): GsspResponse {
    return new GsspResponse().with(ResultKey.Provider(result));
  }

  static ResultKey = ResultKey;
  static StatusKey = StatusKey;
  static HeadersKeys = HeadersKey;

  private constructor(internal: StackInternal<GsspResponse> | null = null) {
    super(internal);
  }

  get result() {
    return this.get(ResultKey.Consumer);
  }

  get status(): number | null {
    return this.get(StatusKey.Consumer);
  }

  get headers(): Headers | null {
    return this.get(HeadersKey.Consumer);
  }

  with(...keys: Array<KeyProvider<any>>): GsspResponse {
    return Stack.applyKeys<GsspResponse>(this, keys, (internal) => new GsspResponse(internal));
  }

  addHeaders(...headers: Headers): GsspResponse {
    const prevHeaders = this.headers ?? [];
    return this.with(HeadersKey.Provider([...prevHeaders, ...headers]));
  }

  addProps(props: Record<string, any>): GsspResponse {
    const prev = this.result;
    if ('props' in prev) {
      const next = { ...prev, props: { ...prev.props, ...props } };
      return this.with(ResultKey.Provider(next));
    }
    return this;
  }
}
