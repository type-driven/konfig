import {
  isLeft,
  left,
  right,
} from "https://deno.land/x/fun@v.2.0.0-alpha.11/either.ts";
import { assert, assertEquals } from "std/testing/asserts.ts";
import { pipe } from "https://deno.land/x/fun@v.2.0.0-alpha.11/fn.ts";
import {
  env,
  fallback,
  flag,
  interpolation,
  missingKey,
  nth,
  pipeline,
  run,
  schema,
} from "./mod.ts";
import {
  json,
  number,
  string,
  struct,
} from "https://deno.land/x/fun@v.2.0.0-alpha.11/decoder.ts";
import {
  keyErr,
  manyErr,
} from "https://deno.land/x/fun@v.2.0.0-alpha.11/decoder.ts";

Deno.test("env", async (t) => {
  await t.step("right", () => {
    const expected = right("foo");
    const actual = env("FOOBAR").read({ FOOBAR: "foo" });
    assertEquals(actual, expected);
  });

  await t.step("left", () => {
    const actual = env("BAZ").read({ FOOBAR: "foo" });
    const expected = missingKey("BAZ", "Missing environment variable");
    assert(isLeft(actual), "Expected error, got: " + JSON.stringify(actual));
    assertEquals(actual, expected);
  });
});

Deno.test("flag", () => {
  const expected = right("bar");
  const actual = flag("foo").read(["--foo", "bar"]);
  assertEquals(actual, expected);
});

Deno.test("nth", () => {
  const expected = right("bar");
  const actual = nth(2).read(["foo", "bar"]);
  assertEquals(actual, expected);
});

Deno.test("fallback", () => {
  const expected = right("bar");
  const actual = fallback("bar").read({});
  assertEquals(actual, expected);
});

Deno.test("pipeline", async (t) => {
  const expected = right("foo");
  Deno.env.set("FOOBAR", "foo");
  await t.step("singleton", () => {
    const actual = pipeline(env("FOOBAR")).read({});
    assertEquals(actual, expected);
  });
  await t.step("with fallback", () => {
    const actual = pipeline(env("FOOBAR"), fallback("bar")).read({});
    assertEquals(actual, expected);
  });
  await t.step("with fallback and multi", () => {
    const actual = pipeline(env("FOOBAR"), flag("foo"), fallback("bar")).read(
      {},
    );
    assertEquals(actual, expected);
  });
});

Deno.test("schema", async (t) => {
  await t.step("simple", () => {
    Deno.env.set("FOOBAR", "foo");
    const expected = right({ foo: "foo" });
    const actual = pipe({ foo: env("FOOBAR") }, schema, (s) => s.read());
    assertEquals(actual, expected);
  });
  await t.step("nested", () => {
    Deno.env.set("FOOBAR", "foo");
    const expected = right({ foo: "foo", bar: { foo: "foo" } });
    const actual = pipe(
      { foo: env("FOOBAR"), bar: schema({ foo: env("FOOBAR") }) },
      schema,
      (s) => s.read(),
    );
    assertEquals(actual, expected);
  });
  await t.step("multiple errors", () => {
    const s1 = schema({
      env: env("FOOBAR"),
      flag: flag("foo", number),
      pipelined: pipeline(env("BAZ"), flag("bar")),
      jsonValue: pipeline(env("JSON_VAL", json(struct({ foo: string })))),
    });
    const expected = pipe(
      manyErr(
        keyErr(
          "flag",
          { tag: "Leaf", value: "foo", reason: "Missing argument" },
          "required",
        ),
        keyErr(
          "pipelined",
          { tag: "Leaf", value: "bar", reason: "Missing argument" },
          "required",
        ),
        keyErr(
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
  await t.step("pipelined with fallback - success", () => {
    Deno.env.set("JSON_VALUE", '{ "foo": "baz" }');
    const { read } = pipeline(
      env("JSON_VALUE", json(struct({ foo: string }))),
      fallback({ foo: "bar" }),
    );
    const expected = right({ foo: "baz" });
    const actual = read({});
    assertEquals(actual, expected);
  });
  await t.step("pipelined with fallback - fail", () => {
    const { read } = pipeline(
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
