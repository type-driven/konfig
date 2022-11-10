import { json, number, string, struct } from "$fun/decoder.ts";
import { pipe } from "$fun/fn.ts";
import { arg, compose, env, fallback, schema, bind, Konfig } from "../mod.ts";

export const s1 = pipe(
  schema({
    env: compose(env("FOOBAR"), fallback("foo")),
    arg: compose(arg("foo", number), fallback(1)),
    composed: compose(env("BAZ"), arg("bar"), fallback("foobar")),
    jsonValue: compose(
      env("JSON_VAL", json(struct({ foo: string }))),
      fallback({ foo: "bar" }),
    ),
  }),
  bind("bound", ({ env, arg, composed }) => `${env}-${arg}-${composed}`),
);
export type S1 = Konfig<typeof s1>;

console.log(JSON.stringify(s1.read(), null, 4));
