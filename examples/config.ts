import { json, number, string, struct } from "$fun/decoder.ts";
import { pipe } from "$fun/fn.ts";
import { interpolation, Konfig, prop } from "../konfig.ts";
import { arg, compose, env, fallback, schema } from "../mod.ts";

export const s1 = schema({
  env: compose(env("FOOBAR"), fallback("foo")),
  arg: compose(arg("foo", number), fallback(1)),
  composed: compose(env("BAZ"), arg("bar"), fallback("foobar")),
  jsonValue: compose(
    env("JSON_VAL", json(struct({ foo: string }))),
    fallback({ foo: "bar" }),
  ),
});
export type S1 = Konfig<typeof s1>;

export const interpolated = pipe(
  s1,
  interpolation(({ env, arg, composed }) => `${env}-${arg}-${composed}`),
);

export const s2 = schema({
  ...s1.props,
  interpolated,
});

console.log(JSON.stringify(s2.read(), null, 4));

export const s3 = pipe(
  s1,
  prop("property_assignment", interpolated),
);

console.log(JSON.stringify(s3.read(), null, 4));
