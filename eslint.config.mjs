import nextVitals from "eslint-config-next/core-web-vitals";
import reactHooks from "eslint-plugin-react-hooks";

/** @type {import("eslint").Linter.Config[]} */
const config = [
  ...nextVitals,
  {
    plugins: { "react-hooks": reactHooks },
    rules: {
      "react/no-unescaped-entities": "off",
      // Next 16 ships newer React Hooks rules than the project's previous
      // Next 14 lint setup. Keep their findings visible while existing code
      // is migrated incrementally.
      "@next/next/no-html-link-for-pages": "warn",
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/purity": "warn",
      "react-hooks/static-components": "warn",
      "react-hooks/error-boundaries": "warn",
      "react-hooks/immutability": "warn",
    },
  },
];

export default config;
