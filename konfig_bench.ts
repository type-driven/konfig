import convict from "npm:convict";
import { pipe } from "https://deno.land/x/fun@v.2.0.0-alpha.11/fn.ts";
import { env, extract, fallback, flag, schema } from "./mod.ts";
import { parse as parseFlags } from "https://deno.land/std@0.192.0/flags/mod.ts";

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
  pipe(
    schema({
      env: [env("NODE_ENV"), flag("node-env"), fallback("development")],
    }),
    extract,
  );
});
