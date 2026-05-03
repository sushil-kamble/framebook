// @ts-check

import { tanstackConfig } from "@tanstack/eslint-config"

export default [
  {
    ignores: [
      "node_modules/**",
      "packages/*/node_modules/**",
      "dist/**",
      "packages/*/dist/**",
      ".output/**",
      "packages/*/.output/**",
      ".tanstack/**",
      "packages/*/.tanstack/**",
      "eslint.config.js",
    ],
  },
  ...tanstackConfig,
]
