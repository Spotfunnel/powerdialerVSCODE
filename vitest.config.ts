import { defineConfig } from "vitest/config";

export default defineConfig({
    resolve: {
        tsconfigPaths: true,
    } as any,
    test: {
        environment: "node",
        include: ["tests/**/*.test.ts"],
        globals: false,
    },
});
