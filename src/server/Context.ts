import { KeyProvider, Stack, StackInternal, createKey } from 'miid';
import { GetServerSidePropsContext } from 'next';
import { ParsedUrlQuery } from 'querystring';

export type Req = GetServerSidePropsContext['req'];

export type Mode = 'Api' | 'Gssp';

export const ALL_HTTP_METHODS = [
  'GET',
  'POST',
  'PUT',
  'DELETE',
  'PATCH',
  'HEAD',
  'OPTIONS',
] as const;
export type HttpMethod = typeof ALL_HTTP_METHODS[number];

const BodyKey = createKey<unknown>({ name: 'Body' });
const ModeKey = createKey<Mode>({ name: 'Mode' });
const QueryKey = createKey<ParsedUrlQuery>({ name: 'Query' });
const ReqKey = createKey<Req>({ name: 'Req' });
const HttpMethodKey = createKey<HttpMethod>({ name: 'HttpMethod' });

type ContextOptions = {
  req: Req;
  method: HttpMethod;
  body: unknown;
  query: ParsedUrlQuery | null;
  mode: Mode;
};

export class Context extends Stack {
  static create({ mode, req, body, query, method }: ContextOptions): Context {
    return new Context().with(
      ReqKey.Provider(req),
      BodyKey.Provider(body),
      QueryKey.Provider(query ?? {}),
      ModeKey.Provider(mode),
      HttpMethodKey.Provider(method)
    );
  }

  static BodyKey = BodyKey;
  static ModeKey = ModeKey;
  static QueryKey = QueryKey;
  static ReqKey = ReqKey;
  static HttpMethodKey = HttpMethodKey;

  private constructor(internal: StackInternal<Context> | null = null) {
    super(internal);
  }

  get mode(): Mode {
    return this.getOrFail(ModeKey.Consumer);
  }

  get method(): HttpMethod {
    return this.getOrFail(HttpMethodKey.Consumer);
  }

  get body(): unknown {
    return this.getOrFail(BodyKey.Consumer);
  }

  get query(): ParsedUrlQuery {
    return this.getOrFail(QueryKey.Consumer);
  }

  get req(): Req {
    return this.getOrFail(ReqKey.Consumer);
  }

  with(...keys: Array<KeyProvider<any>>): Context {
    return Stack.applyKeys<Context>(this, keys, (internal) => new Context(internal));
  }
}
