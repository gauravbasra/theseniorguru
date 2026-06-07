import nextVitals from "eslint-config-next/core-web-vitals";

const eslintConfig = [
  {
    ignores: [
      "apps/mobile/android/app/build/**",
      "apps/mobile/android/**/build/**",
      "apps/mobile/build/**",
      "apps/mobile/.expo/**"
    ]
  },
  ...nextVitals,
  {
    rules: {
      "react/no-unescaped-entities": "off"
    }
  }
];

export default eslintConfig;
