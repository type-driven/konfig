import { right } from "$fun/either.ts";
import { assertEquals } from "https://deno.land/std@0.162.0/testing/asserts.ts";
import { pipe } from "$fun/fn.ts";
import { arg, compose, env, fallback, schema } from "../src/mod.ts";

Deno.test("env", () => {
  const expected = right("foo");
  const actual = env("FOOBAR").read({ FOOBAR: "foo" });
  assertEquals(actual, expected);
});

Deno.test("arg", () => {
  const expected = right("bar");
  const actual = arg("foo").read(["--foo", "bar"]);
  assertEquals(actual, expected);
});

Deno.test("fallback", () => {
  const expected = right("bar");
  const actual = fallback("bar").read();
  assertEquals(actual, expected);
});

Deno.test("compose", async (t) => {
  const expected = right("foo");
  Deno.env.set("FOOBAR", "foo");
  await t.step("env", () => {
    const actual = compose(env("FOOBAR")).read();
    assertEquals(actual, expected);
  });
  await t.step("with fallback", () => {
    const actual = compose(env("FOOBAR"), fallback("bar")).read();
    assertEquals(actual, expected);
  });
  await t.step("with fallback and multi", () => {
    const actual = compose(env("FOOBAR"), arg("foo"), fallback("bar")).read();
    assertEquals(actual, expected);
  });
});

Deno.test("schema", () => {
  Deno.env.set("FOOBAR", "foo");
  const expected = right({ foo: "foo" });
  const actual = pipe({ foo: env("FOOBAR") }, schema, (s) => s.read());
  assertEquals(actual, expected);
});
