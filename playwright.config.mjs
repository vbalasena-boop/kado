export default {
  testDir: "./e2e",
  workers: 1,
  use: { baseURL: process.env.E2E_BASE_URL || "http://localhost:3100" },
};
