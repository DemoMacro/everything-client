import type { BaseAdapter } from "./base-adapter";
import {
  CLIAdapter,
  type CLIAdapterOptions,
  createCLIAdapter,
} from "./cli-adapter";
import {
  HTTPAdapter,
  type HTTPAdapterOptions,
  createHTTPAdapter,
} from "./http-adapter";
import {
  IPCAdapter,
  type IPCAdapterOptions,
  createIPCAdapter,
} from "./ipc-adapter";

export type { BaseAdapter };
export { CLIAdapter, IPCAdapter, HTTPAdapter };
export type { CLIAdapterOptions, IPCAdapterOptions, HTTPAdapterOptions };
export { createCLIAdapter, createIPCAdapter, createHTTPAdapter };
