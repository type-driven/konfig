import convict from "npm:convict";
import { pipe } from "https://deno.land/x/fun@v.2.0.0-alpha.11/fn.ts";
import { getOrElse } from "https://deno.land/x/fun@v.2.0.0-alpha.11/either.ts";
import { env, fallback, flag, pipeline, schema } from "./mod.ts";
import { parse as parseFlags } from "std/flags/mod.ts";

Deno.env.set("NODE_ENV", "production");

Deno.bench("Deno.env.get", { group: "performance", baseline: true }, () => {
  const env = Deno.env.get("NODE_ENV");
  const args = parseFlags(Deno.args, { "--": true });
  const nodeEnv = args["node-env"] ?? env ?? "development";
  if (nodeEnv !== "production" && nodeEnv !== "development") {
    throw new Error("Invalid NODE_ENV");
  }
});

Deno.bench("convict", { group: "performance" }, () => {
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

Deno.bench("konfig", { group: "performance" }, () => {
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
