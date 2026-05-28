module.exports = {
  ci: {
    collect: {
      startServerCommand: "SQLITE_PATH=./drizzle/e2e.db ADMIN_TOKEN=e2e-secret npm run start -- -H 127.0.0.1 -p 4173",
      startServerReadyPattern: "Ready",
      startServerReadyTimeout: 120000,
      url: ["http://127.0.0.1:4173/", "http://127.0.0.1:4173/admin"],
      numberOfRuns: 1,
      settings: {
        preset: "desktop",
        chromeFlags: "--headless=new --no-sandbox --disable-gpu",
      },
    },
    assert: {
      assertions: {
        "categories:performance": ["warn", { minScore: 0.9 }],
        "categories:accessibility": ["error", { minScore: 0.9 }],
        "categories:best-practices": ["error", { minScore: 0.9 }],
        "categories:seo": ["error", { minScore: 0.9 }],
        "largest-contentful-paint": ["warn", { maxNumericValue: 2500 }],
        "cumulative-layout-shift": ["error", { maxNumericValue: 0.1 }],
        "total-blocking-time": ["warn", { maxNumericValue: 300 }],
      },
    },
    upload: {
      target: "filesystem",
      outputDir: ".lighthouseci",
    },
  },
};
