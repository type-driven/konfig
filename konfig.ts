import { Decoder, string, success } from "$fun/decoder.ts";
import { DecodeError, key, leaf, many } from "$fun/decode_error.ts";
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

export interface Env<A, B extends any[] = [Record<string, unknown>]> {
  _tag: "Env";
  read: FnEither<B, DecodeError, A>;
}

export interface Arg<A, B extends any[] = [string[]]> {
  _tag: "Arg";
  read: FnEither<B, DecodeError, A>;
}

export interface Fallback<A, B extends any[] = unknown[]> {
  _tag: "Fallback";
  read: FnEither<B, DecodeError, A>;
}

export interface Compose<A, B extends any[] = any[]> {
  _tag: "Compose";
  read: FnEither<B, DecodeError, A>;
}

export interface Interpolation<A, B extends any[] = [Record<string, any>]> {
  _tag: "Interpolation";
  read: FnEither<B, DecodeError, A>;
}

export type Schema<
  A,
> = {
  _tag: "Schema";
  read: FnEither<[], DecodeError, { [K in keyof A]: A[K] }>;
  props: { [K in keyof A]: Parser<A[K]> };
};
export type Parser<A, B extends any[] = any[]> =
  | Env<A, B>
  | Arg<A, B>
  | Compose<A, B>
  | Interpolation<A, B>
  | Fallback<A, B>
  | Schema<A>;

// Error
export const missing_key = (key: string, msg: string) =>
  pipe(
    leaf(key, msg),
    left,
  );

// Read from Deno.env
export function env<A = string>(
  variable: string,
  decoder = <Decoder<unknown, A>> string,
): Env<A> {
  const missing_env_var = missing_key(variable, "Missing environment variable");

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
  const missing_arg = missing_key(name, "Missing argument");
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
  const decodeErrors: DecodeError[] = [];
  const read = () =>
    pipe(
      props,
      map((parser, prop) =>
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

export function run<A>({ _tag, read }: Parser<A>): Either<DecodeError, A> {
  switch (_tag) {
    case "Env":
      return pipe(Deno.env.toObject(), read);
    case "Arg":
      return pipe(Deno.args, read);
    default:
      return read();
  }
}
