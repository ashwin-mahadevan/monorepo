import { defineConfig, globalIgnores } from "eslint/config";
import webvitals from "eslint-config-next/core-web-vitals";
import ts from "eslint-config-next/typescript";

export default defineConfig([
  ...webvitals,
  ...ts,
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts"]),
]);
