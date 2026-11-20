import { defineConfig } from "vitest/config";

// 單元測試只測純函式,不載入 Cloudflare / React Router 的 Vite 外掛
export default defineConfig({
	test: {
		include: ["tests/**/*.test.ts"],
	},
});
