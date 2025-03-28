import { platform } from "node:os";
import {
  type BaseAdapter,
  createCLIAdapter,
  createHTTPAdapter,
  createIPCAdapter,
} from "./adapters";
import type {
  ClientOptions,
  EverythingClient,
  FileChangeCallback,
  SearchOptions,
  SearchResult,
  SearchStatus,
  Unsubscribe,
} from "./types";
import { EverythingError } from "./utils/errors";

/**
 * Create a new Everything client
 */
export function createClient(options: ClientOptions = {}): EverythingClient {
  // Determine the best adapter to use
  const adapter = selectAdapter(options);

  // Create a client that uses the selected adapter
  return new EverythingClientImpl(adapter);
}

/**
 * Select the best adapter based on environment and options
 */
function selectAdapter(options: ClientOptions): BaseAdapter {
  // If user specified an adapter, use it
  if (options.adapter && options.adapter !== "auto") {
    switch (options.adapter) {
      case "cli":
        return createCLIAdapter({
          cliPath: options.cliPath,
          timeout: options.timeout,
        });
      case "ipc":
        return createIPCAdapter({
          timeout: options.timeout,
        });
      case "http":
        return createHTTPAdapter({
          serverUrl: options.serverUrl,
          username: options.username,
          password: options.password,
          timeout: options.timeout,
        });
      default:
        throw new EverythingError(`Unknown adapter: ${options.adapter}`);
    }
  }

  // Auto-select the best adapter

  // In browser environment, only HTTP adapter is available
  if (typeof window !== "undefined" && typeof process === "undefined") {
    return createHTTPAdapter({
      serverUrl: options.serverUrl,
      username: options.username,
      password: options.password,
      timeout: options.timeout,
    });
  }

  // In Node.js environment, select based on platform
  const isWindows = platform() === "win32";

  if (isWindows) {
    try {
      // Prefer IPC adapter on Windows
      return createIPCAdapter({
        timeout: options.timeout,
      });
    } catch (error) {
      // Fall back to CLI if IPC fails
      return createCLIAdapter({
        cliPath: options.cliPath,
        timeout: options.timeout,
      });
    }
  }

  // On non-Windows platforms, HTTP is the only option that might work remotely
  return createHTTPAdapter({
    serverUrl: options.serverUrl,
    username: options.username,
    password: options.password,
    timeout: options.timeout,
  });
}

/**
 * Implementation of the Everything client
 */
class EverythingClientImpl implements EverythingClient {
  private adapter: BaseAdapter;

  constructor(adapter: BaseAdapter) {
    this.adapter = adapter;
  }

  /**
   * Search for files and directories
   */
  public async search(
    query: string,
    options?: SearchOptions,
  ): Promise<SearchResult[]> {
    return this.adapter.search(query, options);
  }

  /**
   * Connect to the Everything service
   */
  public async connect(): Promise<void> {
    return this.adapter.connect();
  }

  /**
   * Disconnect from the Everything service
   */
  public disconnect(): void {
    this.adapter.disconnect();
  }

  /**
   * Check if connected to the Everything service
   */
  public isConnected(): boolean {
    return this.adapter.isConnected();
  }

  /**
   * Get the Everything version
   */
  public async getVersion(): Promise<string> {
    return this.adapter.getVersion();
  }

  /**
   * Rebuild the Everything index
   */
  public async rebuildIndex(): Promise<void> {
    return this.adapter.rebuildIndex();
  }

  /**
   * Get the current search status
   */
  public async getSearchStatus(): Promise<SearchStatus> {
    return this.adapter.getSearchStatus();
  }

  /**
   * Monitor file changes
   */
  public monitorFileChanges(callback: FileChangeCallback): Unsubscribe {
    return this.adapter.monitorFileChanges(callback);
  }
}
