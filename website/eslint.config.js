import js from "@eslint/js";
import globals from "globals";
import react from "eslint-plugin-react";
import hooks from "eslint-plugin-react-hooks";
export default [
  { ignores: ["dist/**", ".build/**", "node_modules/**"] },
  js.configs.recommended,
  {
    files: [
      "src/**/*.{js,jsx,mjs}",
      "worker.js",
      "scripts/*.mjs",
      "vite.config.js",
    ],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: {
        ...globals.browser,
        ...globals.node,
        __BUILD_TIME__: "readonly",
      },
    },
    plugins: { react, "react-hooks": hooks },
    rules: {
      "react/jsx-uses-vars": "error",
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
      "no-unused-vars": [
        "error",
        { varsIgnorePattern: "^React$", argsIgnorePattern: "^_" },
      ],
    },
  },
  { files: ["tests/*.mjs"], languageOptions: { globals: globals.node } },
];
