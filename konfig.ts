import {
  array,
  compose as composeDecoders,
  Decoder,
  string,
  success,
} from "fun/decoder.ts";
import { DecodeError, key, leaf, many } from "fun/decode_error.ts";
import { flow, Fn, pipe } from "fun/fn.ts";
import { parse as parseFlags } from "std/flags/mod.ts";
import {
  alt,
  chain,
  Either,
  fromNullable,
  left,
  mapLeft,
  right,
  tryCatch,
  MonadEither
} from "fun/either.ts";
import { lookupAt, map, sequence } from "fun/record.ts";
import { match } from "fun/option.ts";
import { reduce } from "fun/array.ts";
import { FnEither } from "fun/fn_either.ts";

const sequenceStruct = sequence(MonadEither);

export interface Env<A, B extends {} = Record<string, unknown>> {
  _tag: "Env";
  read: FnEither<B, DecodeError, A>;
}

export interface Arg<A, B extends {} = string[]> {
  _tag: "Arg";
  read: FnEither<B, DecodeError, A>;
}

export interface Fallback<A, B extends {} = {}> {
  _tag: "Fallback";
  read: FnEither<B, DecodeError, A>;
}

export interface Compose<A, B extends {} = {}> {
  _tag: "Compose";
  read: FnEither<B, DecodeError, A>;
}

export interface Interpolation<A> {
  _tag: "Interpolation";
  read: FnEither<unknown, DecodeError, A>;
}

export type Schema<
  A,
> = {
  _tag: "Schema";
  read: FnEither<unknown, DecodeError, { [K in keyof A]: A[K] }>;
  props: { [K in keyof A]: Parser<A[K]> };
};
export type Parser<A, D extends any = any> =
  | Env<A, D>
  | Arg<A, D>
  | Compose<A, D>
  | Interpolation<A>
  | Fallback<A, D>
  | Schema<A>;

export type Konfig<A> = A extends Parser<infer B> ? B : never;

// Error
export const missing_key = flow(leaf, left);

// Read from Deno.env
export function env<A = string>(
  variable: string,
  decoder = <Decoder<unknown, A>> string,
): Env<A> {
  const missingEnv = missing_key(variable, "Missing environment variable");

  const read = flow(
    lookupAt(variable),
    match(() => missingEnv, (a) => right(a)),
    chain(decoder),
  );
  return ({
    _tag: "Env",
    read,
  });
}

// Read from Deno.args
export function arg<A = string>(
  name: string,
  decoder = <Decoder<unknown, A>> string,
): Arg<A> {
  const missingArg = missing_key(name, "Missing argument");
  const read = flow(
    parseFlags,
    lookupAt(name),
    match(() => missingArg, (a: A) => right(a)),
    chain(decoder),
  );
  return ({
    _tag: "Arg",
    read,
  });
}

// Fallback in case there's no value
export function fallback<A = any>(value: A): Fallback<A> {
  return {
    _tag: "Fallback",
    read: () => success(value),
  };
}

export function schema<A>(
  props: Readonly<{ [K in keyof A]: Parser<A[K]> }>,
): Schema<A> {
  const decodeErrors: DecodeError[] = [];
  const read = () =>
    pipe(
      props,
      map((parser: Parser<A[keyof A]>, prop) =>
        pipe(
          parser,
          run,
          mapLeft((e) => {
            const err = key(prop, e, "required");
            decodeErrors.push(err);
            return err;
          }),
        )
      ),
      (props) =>
        sequenceStruct(props) as Either<
          DecodeError,
          { [K in keyof A]: A[K] }
        >,
      mapLeft(() =>
        many(...decodeErrors as [DecodeError, DecodeError, ...DecodeError[]])
      ),
    );
  return {
    _tag: "Schema",
    props,
    read,
  };
}

// compose
export function compose<A>(...parsers: Parser<A>[]): Compose<A> {
  const read = () =>
    pipe(
      parsers,
      reduce(
        (acc, parser) => pipe(parser, run, alt, (or) => or(acc)),
        left<DecodeError, A>(leaf("compose", "No parsers matched")),
      ),
    );
  return {
    _tag: "Compose",
    read,
  };
}

// interpolate over a schema
export function interpolation<S extends Schema<any>, A>(
  fn: Fn<Konfig<S>, A>,
  decoder = <Decoder<unknown, A>> string,
): Fn<S, Interpolation<A>> {
  const evaluateFn = (a: any): Either<DecodeError, A> =>
    tryCatch(
      () => fn(a),
      (e) => leaf("interpolation", `Failed to interpolate: ${String(e)}`),
    );
  return (schema) => ({
    _tag: "Interpolation",
    read: () => pipe(schema, run, chain(evaluateFn), chain(decoder)),
  });
}

export function run<A>({ _tag, read }: Parser<A>): Either<DecodeError, A> {
  switch (_tag) {
    case "Env":
      return pipe(Deno.env.toObject(), read);
    case "Arg":
      return pipe(Deno.args, read);
    default:
      return read({});
  }
}

export function prop<P extends string, A, B>(
  prop: P,
  parser: Parser<A>,
) {
  return (
    { props }: Schema<B>,
  ): Schema<{ [K in keyof B | P]: K extends keyof B ? B[K] : A }> => {
    props = { ...props, [prop]: parser };
    return schema(props) as Schema<
      { [K in keyof B | P]: K extends keyof B ? B[K] : A }
    >;
  };
}

export function bind<P extends string, A, B>(
  property: P,
  fn: (b: B) => A,
) {
  return (
    s: Schema<B>,
  ): Schema<{ [K in keyof B | P]: K extends keyof B ? B[K] : A }> => {
    const parser = interpolation(fn)(s);
    return prop(property, parser)(s) as Schema<
      { [K in keyof B | P]: K extends keyof B ? B[K] : A }
    >;
  };
}

// Parser for 1st argument e.g. `deno run x.ts <first-arg>` (independent of flags)
export const firstArgument = pipe(
  array(string),
  composeDecoders(
    flow(
      ([entrypoint]: readonly string[]) => entrypoint,
      fromNullable(() => leaf("<entrypoint>", "Entrypoint was expected.")),
    ),
  ),
  (decoder) => arg("_", decoder),
);

