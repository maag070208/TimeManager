import js from "@eslint/js";
import boundaries from "eslint-plugin-boundaries";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist", "dist-landing", "dist-electron", "release"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx,cts}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": [
        "warn",
        { allowConstantExport: true },
      ],
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
  {
    // Tests E2E: corren en Node, no en el navegador, y no son código React.
    // El `use()` de los fixtures de Playwright no es el hook `use` de React, y
    // su firma `async ({}, use) => {}` usa un patrón vacío a propósito.
    files: ["tests/**/*.ts", "playwright.config.ts", "electron/**/*.cts"],
    languageOptions: { globals: globals.node },
    rules: {
      "react-hooks/rules-of-hooks": "off",
      "react-refresh/only-export-components": "off",
      "no-empty-pattern": "off",
    },
  },
  {
    // Arquitectura FSD (src/app, src/shared, src/entities, src/features,
    // src/widgets, src/pages). Excepción: pages/features/widgets pueden
    // importar `@app/store` (sólo tipos RootState/AppDispatch) para tipado.
    files: ["src/**/*.{ts,tsx}"],
    plugins: { boundaries },
    settings: {
      "import/resolver": {
        typescript: { project: "./tsconfig.app.json" },
      },
      "boundaries/elements": [
        { type: "app", pattern: "app/*" },
        { type: "shared", pattern: "shared/*" },
        { type: "entities", pattern: "entities/*" },
        { type: "features", pattern: "features/*/*" },
        { type: "widgets", pattern: "widgets/*" },
        { type: "pages", pattern: "pages/*" },
      ],
    },
    rules: {
      "boundaries/dependencies": [
        "error",
        {
          default: "disallow",
          policies: [
            {
              from: { element: { type: "app" } },
              allow: { to: { element: { types: { anyOf: ["app", "shared", "entities", "features", "widgets", "pages"] } } } },
            },
            {
              from: { element: { type: "shared" } },
              allow: { to: { element: { type: "shared" } } },
            },
            {
              from: { element: { type: "entities" } },
              allow: { to: { element: { types: { anyOf: ["entities", "shared"] } } } },
            },
            {
              from: { element: { type: "features" } },
              allow: { to: { element: { types: { anyOf: ["app", "entities", "shared"] } } } },
            },
            {
              from: { element: { type: "widgets" } },
              allow: {
                to: {
                  element: {
                    types: { anyOf: ["app", "features", "entities", "shared"] },
                  },
                },
              },
            },
            {
              from: { element: { type: "pages" } },
              allow: {
                to: {
                  element: {
                    types: { anyOf: ["app", "widgets", "features", "entities", "shared"] },
                  },
                },
              },
            },
          ],
        },
      ],
    },
  }
);