import { defineBuildConfig } from "unbuild";

export default defineBuildConfig({
  declaration: true,
  entries: [
    {
      input: "src/index",
    },
    {
      input: "src/adapters/cli-adapter.ts",
      name: "cli-adapter",
    },
    {
      input: "src/adapters/http-adapter.ts",
      name: "http-adapter",
    },
    {
      input: "src/adapters/ipc-adapter.ts",
      name: "ipc-adapter",
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
