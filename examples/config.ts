import { number } from "$fun/decoder.ts";
import { arg, compose, env, fallback, schema } from "../src/mod.ts";

const constants = schema({
  env: env("FOOBAR"),
  arg: arg("foo", number),
  composed: compose(env("BAZ"), arg("bar"), fallback("foobar")),
});
