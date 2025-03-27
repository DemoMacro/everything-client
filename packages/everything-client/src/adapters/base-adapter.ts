import type {
  FileChangeCallback,
  SearchOptions,
  SearchResult,
  SearchStatus,
  Unsubscribe,
} from "../types";

/**
 * Base interface for all adapter implementations.
 */
export interface BaseAdapter {
  /**
   * Search for files and directories.
   */
  search(query: string, options?: SearchOptions): Promise<SearchResult[]>;

  /**
   * Connect to the Everything service.
   */
  connect(): Promise<void>;

  /**
   * Disconnect from the Everything service.
   */
  disconnect(): void;

  /**
   * Check if connected to the Everything service.
   */
  isConnected(): boolean;

  /**
   * Get the Everything version.
   */
  getVersion(): Promise<string>;

  /**
   * Rebuild the Everything index.
   */
  rebuildIndex(): Promise<void>;

  /**
   * Get the current search status.
   */
  getSearchStatus(): Promise<SearchStatus>;

  /**
   * Monitor file changes.
   */
  monitorFileChanges(callback: FileChangeCallback): Unsubscribe;
}
