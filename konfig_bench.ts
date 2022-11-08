import convict from "npm:convict";
import { pipe } from "$fun/fn.ts";
import { env, schema } from "./mod.ts";
import { getOrElse } from "$fun/either.ts";

Deno.env.set("NODE_ENV", "production");

Deno.bench("convict", () => {
  const config = convict({
    env: {
      doc: "The applicaton environment.",
      format: ["production", "development", "test"],
      default: "development",
      env: "NODE_ENV",
      arg: "node-env",
    },
  });
  config.validate();
  config.get();
});

Deno.bench("konfig", () => {
  pipe(
    { foo: env("NODE_ENV") },
    schema,
    (s) => s.read(),
    getOrElse((): any => {
      throw new Error("Invalid configuration");
    }),
  );
});
