import { Decoder, string, success } from "$fun/decoder.ts";
import { DecodeError, draw, leaf } from "$fun/decode_error.ts";
import { flow, pipe } from "$fun/fn.ts";
import { parse as parseFlags } from "$std/flags/mod.ts";
import {
  alt,
  chain,
  Either,
  left,
  mapLeft,
  right,
  sequenceStruct,
} from "$fun/either.ts";
import { lookupAt, map } from "$fun/record.ts";
import { fold } from "$fun/option.ts";
import { reduce } from "$fun/array.ts";
import { FnEither } from "$fun/fn_either.ts";

interface Env<A, B extends any[] = [Record<string, unknown>]> {
  _tag: "Env";
  read: FnEither<B, DecodeError, A>;
}

interface Arg<A, B extends any[] = [string[]]> {
  _tag: "Arg";
  read: FnEither<B, DecodeError, A>;
}

interface Fallback<A, B extends any[] = unknown[]> {
  _tag: "Fallback";
  read: FnEither<B, DecodeError, A>;
}

interface Compose<A, B extends any[] = any[]> {
  _tag: "Compose";
  read: FnEither<B, DecodeError, A>;
}

interface Interpolation<A, B extends any[] = [Record<string, any>]> {
  _tag: "Interpolation";
  read: FnEither<B, DecodeError, A>;
}

type Schema<
  A,
> = {
  _tag: "Schema";
  read: FnEither<[], DecodeError, { [K in keyof A]: A[K] }>;
  props: { [K in keyof A]: Parser<A[K]> };
};
type Parser<A, B extends any[] = any[]> =
  | Env<A, B>
  | Arg<A, B>
  | Compose<A, B>
  | Interpolation<A, B>
  | Fallback<A, B>
  | Schema<A>;

// Read from Deno.env
export function env<A = string>(
  variable: string,
  decoder = <Decoder<unknown, A>> string,
): Env<A> {
  const missing_env_var = pipe(
    leaf(variable, "Missing environment variable"),
    left,
  );
  const read = flow(
    lookupAt(variable),
    fold(
      () => missing_env_var,
      (a) => right(a),
    ),
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
  const missing_arg = pipe(leaf(name, "Missing arugment"), left);
  const read = flow(
    parseFlags,
    lookupAt(name),
    fold(() => missing_arg, (a) => right(a)),
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
  return {
    _tag: "Schema",
    props,
    read: () =>
      pipe(
        props,
        map((p: Parser<A[keyof A]>) => compose(p).read()),
        map(mapLeft((e) => {
          console.log(draw(e));
          return e;
        })),
        (props) =>
          sequenceStruct(props) as Either<
            DecodeError,
            { [K in keyof A]: A[K] }
          >,
      ),
  };
}

// compose
export function compose<A>(...parsers: Parser<A>[]): Compose<A> {
  const read = () =>
    pipe(
      parsers,
      reduce(
        (acc, { _tag, read }) => {
          switch (_tag) {
            case "Env":
              return pipe(Deno.env.toObject(), read, alt(acc));
            case "Arg":
              return pipe(Deno.args, read, alt(acc));
            case "Fallback":
              return pipe(acc, alt(read()));
            default:
              return acc;
          }
        },
        left<DecodeError, A>(leaf("compose", "No parsers matched")),
      ),
    );
  return {
    _tag: "Compose",
    read,
  };
}
