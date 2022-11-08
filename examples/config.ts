import { json, number, string, struct } from "$fun/decoder.ts";
import { arg, compose, env, fallback, schema } from "../mod.ts";

export const s1 = schema({
  env: env("FOOBAR"),
  arg: arg("foo", number),
  composed: compose(env("BAZ"), arg("bar"), fallback("foobar")),
  jsonValue: compose(
    env("JSON_VAL", json(struct({ foo: string }))),
    fallback({ foo: "bar" }),
  ),
});
