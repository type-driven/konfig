import { isLeft, left, right } from "fun/either.ts";
import { assert, assertEquals } from "std/testing/asserts.ts";
import { pipe } from "fun/fn.ts";
import {
  arg,
  compose,
  env,
  fallback,
  interpolation,
  missing_key,
  run,
  schema,
} from "./mod.ts";
import { json, number, string, struct } from "fun/decoder.ts";
import { key, many } from "fun/decode_error.ts";

Deno.test("env", async (t) => {
  await t.step("right", () => {
    const expected = right("foo");
    const actual = env("FOOBAR").read({ FOOBAR: "foo" });
    assertEquals(actual, expected);
  });

  await t.step("left", () => {
    const actual = env("BAZ").read({ FOOBAR: "foo" });
    const expected = missing_key("BAZ", "Missing environment variable");
    assert(isLeft(actual), "Expected error, got: " + JSON.stringify(actual));
    assertEquals(actual, expected);
  });
});

Deno.test("arg", () => {
  const expected = right("bar");
  const actual = arg("foo").read(["--foo", "bar"]);
  assertEquals(actual, expected);
});

Deno.test("fallback", () => {
  const expected = right("bar");
  const actual = fallback("bar").read({});
  assertEquals(actual, expected);
});

Deno.test("compose", async (t) => {
  const expected = right("foo");
  Deno.env.set("FOOBAR", "foo");
  await t.step("singleton", () => {
    const actual = compose(env("FOOBAR")).read({});
    assertEquals(actual, expected);
  });
  await t.step("with fallback", () => {
    const actual = compose(env("FOOBAR"), fallback("bar")).read({});
    assertEquals(actual, expected);
  });
  await t.step("with fallback and multi", () => {
    const actual = compose(env("FOOBAR"), arg("foo"), fallback("bar")).read({});
    assertEquals(actual, expected);
  });
});

Deno.test("schema", async (t) => {
  await t.step("simple", () => {
    Deno.env.set("FOOBAR", "foo");
    const expected = right({ foo: "foo" });
    const actual = pipe({ foo: env("FOOBAR") }, schema, (s) => s.read({}));
    assertEquals(actual, expected);
  });
  await t.step("nested", () => {
    Deno.env.set("FOOBAR", "foo");
    const expected = right({ foo: "foo", bar: { foo: "foo" } });
    const actual = pipe(
      { foo: env("FOOBAR"), bar: schema({ foo: env("FOOBAR") }) },
      schema,
      (s) => s.read({}),
    );
    assertEquals(actual, expected);
  });
  await t.step("multiple errors", () => {
    const s1 = schema({
      env: env("FOOBAR"),
      arg: arg("foo", number),
      composed: compose(env("BAZ"), arg("bar")),
      jsonValue: compose(
        env("JSON_VAL", json(struct({ foo: string }))),
      ),
    });
    const expected = pipe(
      many(
        key(
          "arg",
          { tag: "Leaf", value: "foo", reason: "Missing argument" },
          "required",
        ),
        key(
          "composed",
          { tag: "Leaf", value: "bar", reason: "Missing argument" },
          "required",
        ),
        key(
          "jsonValue",
          {
            tag: "Leaf",
            value: "JSON_VAL",
            reason: "Missing environment variable",
          },
          "required",
        ),
      ),
      left,
    );
    const actual = pipe(s1, run);
    console.log(actual);
    assert(isLeft(actual), "Expected error, got: " + JSON.stringify(actual));
    assertEquals(actual, expected);
  });
});

Deno.test("json", async (t) => {
  await t.step("singletion env", () => {
    const { read } = env("foo", json(struct({ foo: string })));
    const expected = right({ foo: "bar" });
    const actual = read({ foo: '{ "foo": "bar" }' });
    assertEquals(actual, expected);
  });
  await t.step("composed with fallback - success", () => {
    Deno.env.set("JSON_VALUE", '{ "foo": "baz" }');
    const { read } = compose(
      env("JSON_VALUE", json(struct({ foo: string }))),
      fallback({ foo: "bar" }),
    );
    const expected = right({ foo: "baz" });
    const actual = read({});
    assertEquals(actual, expected);
  });
  await t.step("composed with fallback - fail", () => {
    const { read } = compose(
      env("NOT_SET", json(struct({ foo: string }))),
      fallback({ foo: "bar" }),
    );
    const expected = right({ foo: "bar" });
    const actual = read({});
    assertEquals(actual, expected);
  });
});

Deno.test("interpolate", () => {
  const s1 = schema({
    foo: fallback("FOO"),
    bar: fallback("BAR"),
  });
  const expected = right("foobar");
  const actual = pipe(
    s1,
    interpolation(({ foo, bar }) => `${foo}${bar}`.toLowerCase()),
    run,
  );
  assertEquals(actual, expected);
});
