# Konfig

Modern configuration management with type-safety included.

```ts
import {
  json,
  number,
  string,
  struct,
} from "https://deno.land/x/fun@v2.0.0-alpha.10/decoder.ts";
import { pipe } from "https://deno.land/x/fun@v2.0.0-alpha.10/fn.ts";
import {
  bind,
  env,
  fallback,
  flag,
  handleDecodeError,
  pipeline,
  run,
  schema,
  unwrapOrPanic,
} from "konfig";

export const config = pipe(
  schema({
    env: pipeline(env("FOOBAR"), fallback("foo")),
    arg: pipeline(flag("foo", number), fallback(1)),
    composed: pipeline(env("BAZ"), flag("bar"), fallback("foobar")),
    jsonValue: pipeline(
      env("JSON_VAL", json(struct({ foo: string }))),
      fallback({ foo: "bar" })
    ),
    nested: schema({
      env: pipeline(env("NESTED"), fallback("nested")),
    }),
  }),
  bind("bound", ({ env, arg, composed }) => `${env}-${arg}-${composed}`),
  run,
  handleDecodeError,
  unwrapOrPanic
);

console.log(JSON.stringify(config, null, 4));
/* Outputs
{
    "env": "foo",
    "arg": 1,
    "composed": "foobar",
    "jsonValue": {
        "foo": "bar"
    },
    "nested": {
        "env": "nested"
    },
    "bound": "foo-1-foobar"
}
*/

```