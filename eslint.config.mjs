import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTypescript,
  // Legacy CommonJS functions stay operational during the staged cut-over and
  // retain their existing lint conventions. Phase 1 lint gates the new app.
  globalIgnores([".next/**", "node_modules/**", ".netlify/**", "api/**", "lib/**/*.js", "scripts/**", "sw.js"]),
]);
