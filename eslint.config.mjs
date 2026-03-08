import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: [
      "src/lib/actions/**/*.ts",
      "src/lib/inventory/**/*.ts",
      "src/app/api/export/**/*.ts",
      "src/app/api/import/**/*.ts",
      "src/app/api/photos/**/*.ts",
      "src/app/api/search/**/*.ts",
      "src/app/api/storage/**/*.ts",
      "src/app/api/suggestions/**/*.ts",
    ],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@/server/db/admin",
              message:
                "Tenant-scoped modules must use withRlsUserContext and tenant DB access.",
            },
          ],
        },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
