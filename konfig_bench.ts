import convict from "npm:convict";
import { pipe } from "fun/fn.ts";
import { getOrElse } from "fun/either.ts";
import { env, fallback, flag, pipeline, schema } from "./mod.ts";

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
  const config = schema({
    env: pipeline(env("NODE_ENV"), flag("node-env"), fallback("development")),
  });
  pipe(
    config,
    (s) => s.read(),
    getOrElse((): any => {
      throw new Error("Invalid configuration");
    }),
  );
});
