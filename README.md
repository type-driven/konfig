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
import { bind, env, extract, fallback, flag, schema } from "konfig";

export const config = pipe(
  schema({
    env: [
      env("FOOBAR"),
      fallback("foo"),
    ],
    arg: [
      flag("foo", number),
      fallback(1),
    ],
    composed: [
      env("BAZ"),
      flag("bar"),
      fallback("foobar"),
    ],
    jsonValue: [
      env("JSON_VAL", json(struct({ foo: string }))),
      fallback({ foo: "bar" }),
    ],
    naked: {
      foo: env("FOO"),
      env: [env("NESTED"), fallback("nested")],
    },
  }),
  bind("bound", ({ env, arg, composed }) => `${env}-${arg}-${composed}`),
  extract,
);

type Config = typeof config;
/*
type Config = {
  env: string;
  arg: number;
  composed: string;
  jsonValue: {
      readonly foo: string;
  };
  naked: {
      foo: string;
      env: string;
      nestedNaked: {
          env: string;
      };
  };
  bound: string;
}
*/

console.log(JSON.stringify(config, null, 4));
/* Outputs
{
    "env": "foo",
    "arg": 1,
    "composed": "foobar",
    "jsonValue": {
        "foo": "bar"
    },
    "naked": {
        "foo": "foo",
        "env": "nested",
        "nestedNaked": {
            "env": "nested-nested"
        }
    },
    "bound": "foo-1-foobar"
}
*/
```
