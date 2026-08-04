import eslint from "@eslint/js";
import globals from "globals";

export default [
  {
    ignores: ["node_modules/**", "*.db", "*.sqlite", "*.sqlite3"],
  },
  {
    ...eslint.configs.recommended,
    files: ["**/*.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: globals.node,
    },
    rules: {
      "no-unused-vars": "warn",
    },
  },
];
