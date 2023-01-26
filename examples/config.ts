import { json, number, string, struct } from "fun/decoder.ts";
import { pipe } from "fun/fn.ts";
import { bind, env, fallback, flag, Konfig, pipeline, schema } from "konfig";

export const s1 = pipe(
  schema({
    env: pipeline(env("FOOBAR"), fallback("foo")),
    arg: pipeline(flag("foo", number), fallback(1)),
    composed: pipeline(env("BAZ"), flag("bar"), fallback("foobar")),
    jsonValue: pipeline(
      env("JSON_VAL", json(struct({ foo: string }))),
      fallback({ foo: "bar" }),
    ),
    nested: schema({
      env: pipeline(env("NESTED"), fallback("nested")),
    }),
  }),
  bind("bound", ({ env, arg, composed }) => `${env}-${arg}-${composed}`),
);
export type S1 = Konfig<typeof s1>;

console.log(JSON.stringify(s1.read(), null, 4));
