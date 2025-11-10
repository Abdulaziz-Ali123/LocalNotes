// eslint.config.js
import js from "@eslint/js";
import parser from "@typescript-eslint/parser";
import tseslint from "@typescript-eslint/eslint-plugin";
import react from "eslint-plugin-react";
import prettier from "eslint-config-prettier";
import unusedImports from "eslint-plugin-unused-imports";

export default [
  // Base ESLint JS recommendations
  js.configs.recommended,
  // TypeScript + React logic rules
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      parser,
      parserOptions: {
        project: "./tsconfig.json",
        ecmaFeatures: { jsx: true },
      },
    },
    plugins: {
      "@typescript-eslint": tseslint,
      react,
      "unused-imports": unusedImports,
    },
    rules: {
      ...tseslint.configs.recommended.rules,
      // --- Logic & Safety Rules ---
      "no-unused-vars": "off", // Use TS version
      "@typescript-eslint/no-unused-vars": "off", // Let unused-imports handle it
      "unused-imports/no-unused-imports": "error",
      "unused-imports/no-unused-vars": [
        "warn",
        {
          vars: "all",
          varsIgnorePattern: "^_",
          args: "after-used",
          argsIgnorePattern: "^_",
        },
      ],
      "no-undef": "error",
      "no-console": ["warn", { allow: ["warn", "error"] }],
      "react/jsx-uses-react": "off", // Not needed with React 17+
      "react/react-in-jsx-scope": "off",
      "react/prop-types": "off",
      // --- Disabled Style Rules (Prettier handles them) ---
      semi: "off",
      quotes: "off",
      "comma-dangle": "off",
      "arrow-parens": "off",
      "object-curly-spacing": "off",
      indent: "off",
      "space-before-function-paren": "off",
    },
  },
  // Disable remaining stylistic ESLint rules (let Prettier format)
  prettier,
];
