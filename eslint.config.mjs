import nextVitals from "eslint-config-next/core-web-vitals";

const config = [...nextVitals, { ignores: [".tmp-test/**", ".tmp-tests/**"] }];

export default config;
