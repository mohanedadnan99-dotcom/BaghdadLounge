import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypeScript from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTypeScript,
  {
    rules: {
      // This project predates the strict Next 16 defaults and its database
      // adapter intentionally returns dynamic row shapes. Keep lint useful for
      // correctness issues without turning the existing application into a
      // type-migration project.
      "@typescript-eslint/no-explicit-any": "off",
      "react-hooks/set-state-in-effect": "off",
    },
  },
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts", "public/pdf.worker.min.mjs"]),
]);
