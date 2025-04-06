import { defineBuildConfig } from "unbuild";

export default defineBuildConfig({
  declaration: true,
  entries: [
    {
      input: "src/index",
    },
    {
      input: "src/adapters/cli-adapter.ts",
      name: "cli",
    },
    {
      input: "src/adapters/http-adapter.ts",
      name: "http",
    },
    {
      input: "src/adapters/ipc-adapter.ts",
      name: "ipc",
    },
  ],
  rollup: {
    inlineDependencies: true,
    emitCJS: true,
    esbuild: {
      minify: true,
    },
  },
});
