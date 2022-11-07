import { Decoder, string, success } from "$fun/decoder.ts";
import { DecodeError, leaf } from "$fun/decode_error.ts";
import { flow, pipe } from "$fun/fn.ts";
import { parse as parseFlags } from "$std/flags/mod.ts";
import { alt, chain, left, right } from "$fun/either.ts";
import { lookupAt } from "$fun/record.ts";
import { fold } from "$fun/option.ts";
import { reduce } from "$fun/array.ts";
import { FnEither } from "$fun/fn_either.ts";

interface Env<A, B extends any[]> {
  _tag: "Env";
  read: FnEither<B, DecodeError, A>;
}
interface Arg<A, B extends any[]> {
  _tag: "Arg";
  read: FnEither<B, DecodeError, A>;
}
interface Fallback<A, B extends any[] = any[]> {
  _tag: "Fallback";
  read: FnEither<B, DecodeError, A>;
}

interface Compose<A, B extends any[] = [Record<string, any>]> {
  _tag: "Compose";
  read: FnEither<B, DecodeError, A>;
}

interface Interpolation<A, B extends any[] = [Record<string, any>]> {
  _tag: "Interpolation";
  read: FnEither<B, DecodeError, A>;
}

type Parser<A, B extends any[] = any[]> =
  | Env<A, B>
  | Arg<A, B>
  | Compose<A, B>
  | Interpolation<A, B>
  | Fallback<A, B>;

type Schema<A> = {
  _tag: "Schema";
  props: { [K in keyof A]: Parser<A[K]> };
};

// Read from Deno.env
export function env<A = string>(
  variable: string,
  decoder = <Decoder<unknown, A>> string,
): Env<A, [Record<string, string>]> {
  const read: FnEither<[Record<string, string>], DecodeError, A> = flow(
    lookupAt(variable),
    fold(
      () => pipe(leaf(variable, "Missing environment variable"), left),
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
): Arg<A, [string[]]> {
  const read = flow(
    parseFlags,
    lookupAt(name),
    fold(() => pipe(leaf(name, "Missing arugment"), left), (a) => right(a)),
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

// deno-lint-ignore ban-types
export function schema<A extends object>(
  props: { [k in keyof A]: Parser<A[k]> },
): Schema<A> {
  return {
    _tag: "Schema",
    props,
  };
}

// compose
export function compose<A>(...parsers: Parser<A>[]): Parser<A> {
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
        left<DecodeError, A>(leaf("multiple", "No parsers matched")),
      ),
    );
  return {
    _tag: "Compose",
    read,
  };
}

// export function combine<
//   A extends Record<string, unknown>,
//   S extends Schema<A>,
//   B extends A = A,
// >(schema: S): FnEither<[A], DecodeError, B> {
//   return pipe(
//     schema,
//     chain(a => success(a)),
//     _ => () => _
//   )
// }

// interpolate
// export function interpolate<A>(schema: Schema<,A>): Parser<A> {
//   return {
//     _tag: "Interpolation",
//     read: () => success({} as A),
//   };
// }
