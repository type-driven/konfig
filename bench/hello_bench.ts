import { hello_deno } from "../src/mod.ts";
import convict from "npm:convict";

const config = convict({
  env: {
    doc: "The applicaton environment.",
    format: ["production", "development", "test"],
    default: "development",
    env: "NODE_ENV",
    arg: "node-env",
  },
});

Deno.bench("Hello Bench! You fast?", () => {
  hello_deno();
});
