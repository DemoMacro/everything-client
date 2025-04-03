import { type FetchOptions, ofetch } from "ofetch";
import type {
  FileChangeCallback,
  SearchOptions,
  SearchResult,
  SearchStatus,
  Unsubscribe,
} from "../types";
import {
  EverythingConnectionError,
  EverythingSearchError,
} from "../utils/errors";
import type { BaseAdapter } from "./base-adapter";

/**
 * Options for the HTTP adapter
 */
export interface HTTPAdapterOptions {
  /** URL for the Everything HTTP server */
  serverUrl: string;
  /** Username for HTTP authentication */
  username?: string;
  /** Password for HTTP authentication */
  password?: string;
  /** Timeout in milliseconds for requests */
  timeout?: number;
}

/**
 * Response types from the Everything HTTP API
 */
interface SearchResponse {
  totalResults: number;
  results: Array<{
    type: "folder" | "file";
    name: string;
    path?: string;
    size?: string | number;
    date_modified?: string;
    date_created?: string;
    date_accessed?: string;
    attributes?: number;
  }>;
}

/**
 * Default adapter options
 */
const DEFAULT_OPTIONS: HTTPAdapterOptions = {
  serverUrl: "http://localhost:8080",
  timeout: 5000,
};

/**
 * Create a new HTTP adapter with the provided options
 */
export function createHTTPAdapter(
  options: Partial<HTTPAdapterOptions> = {},
): HTTPAdapter {
  const adapterOptions: HTTPAdapterOptions = {
    ...DEFAULT_OPTIONS,
    ...options,
  };

  return new HTTPAdapter(adapterOptions);
}

/**
 * Adapter for HTTP communication with Everything's HTTP server
 */
export class HTTPAdapter implements BaseAdapter {
  private options: HTTPAdapterOptions;
  private connected = false;
  private connecting = false;
  private currentQuery?: string;

  /**
   * Create a new HTTP adapter
   */
  constructor(options: HTTPAdapterOptions) {
    this.options = options;
  }

  /**
   * Connect to the Everything service
   */
  public async connect(): Promise<void> {
    if (this.connected) {
      return;
    }

    if (this.connecting) {
      throw new EverythingConnectionError("Connection already in progress");
    }

    this.connecting = true;

    try {
      // Test connection by making a simple search request
      const url = new URL("?j=1&s=*", this.options.serverUrl).toString();
      await ofetch(url, {
        responseType: "json",
        timeout: this.options.timeout,
      });

      this.connected = true;
    } catch (error) {
      throw new EverythingConnectionError(
        `Failed to connect to Everything HTTP server: ${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      this.connecting = false;
    }
  }

  /**
   * Make an HTTP request to the Everything HTTP server
   */
  private async makeRequest<T>(
    path: string,
    options: FetchOptions<"json"> = {},
  ): Promise<T> {
    if (!this.connected) {
      await this.connect();
    }

    const url = new URL(path, this.options.serverUrl).toString();

    const fetchOptions: FetchOptions<"json"> = {
      ...options,
      responseType: "json",
      headers: {
        ...options.headers,
        ...(this.options.username && this.options.password
          ? {
              Authorization: `Basic ${Buffer.from(
                `${this.options.username}:${this.options.password}`,
              ).toString("base64")}`,
            }
          : {}),
      },
      timeout: this.options.timeout,
    };

    try {
      return await ofetch<T>(url, fetchOptions);
    } catch (error) {
      throw new EverythingConnectionError(
        `HTTP request failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Disconnect from the Everything service
   */
  public disconnect(): void {
    this.connected = false;
  }

  /**
   * Check if connected to the Everything service
   */
  public isConnected(): boolean {
    return this.connected;
  }

  /**
   * Search for files and folders
   */
  public async search(
    query: string,
    options: SearchOptions = {},
  ): Promise<SearchResult[]> {
    if (!this.connected) {
      await this.connect();
    }

    this.currentQuery = query;

    try {
      // Build query parameters according to Everything HTTP API format
      const params = new URLSearchParams();
      params.append("s", query); // Search query
      params.append("o", "0"); // Offset
      params.append("c", "32"); // Count per page
      params.append("j", "1"); // JSON output
      params.append("i", options.matchCase ? "1" : "0"); // Case sensitive
      params.append("w", options.matchWholeWord ? "1" : "0"); // Whole word
      params.append("p", "1"); // Path
      params.append("r", options.regex ? "1" : "0"); // Regex
      params.append("m", options.matchCase ? "1" : "0"); // Match case
      params.append("path_column", "1");
      params.append("size_column", "1");
      params.append("date_modified_column", "1");
      params.append("date_created_column", "1");
      params.append("attributes_column", "1");
      params.append("sort", options.sortBy || "name");
      params.append("ascending", options.sortOrder === "asc" ? "1" : "0");

      // Override default parameters based on options
      if (typeof options.maxResults === "number") {
        params.set("c", options.maxResults.toString());
      }
      if (typeof options.offset === "number") {
        params.set("o", options.offset.toString());
      }

      // Make the request
      const data = await this.makeRequest<SearchResponse>(
        `?${params.toString()}`,
      );

      // Parse the results
      return this.parseSearchResults(data);
    } catch (error) {
      throw new EverythingSearchError(
        `Search failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Parse search results from the Everything HTTP API
   */
  private parseSearchResults(data: SearchResponse): SearchResult[] {
    if (!Array.isArray(data.results)) {
      return [];
    }

    return data.results.map((item) => {
      // Parse size, handle empty string case
      const size = item.size === "" ? 0 : Number(item.size);

      // Parse dates from Everything's timestamp format
      const parseDate = (timestamp?: string) => {
        if (!timestamp) return new Date();
        // Everything uses 100-nanosecond intervals since January 1, 1601
        const intervals = BigInt(timestamp);
        const milliseconds = Number(intervals / BigInt(10000));
        return new Date(milliseconds);
      };

      const dateModified = parseDate(item.date_modified);
      const dateCreated = parseDate(item.date_created);
      const dateAccessed = parseDate(item.date_accessed);

      // Parse file attributes
      const attributes = item.attributes || 0;
      const isDirectory = item.type === "folder";
      const isHidden = (attributes & 0x2) !== 0;
      const isSystem = (attributes & 0x4) !== 0;
      const isReadOnly = (attributes & 0x1) !== 0;

      return {
        name: item.name || "",
        path: item.path || "",
        fullPath: item.path ? `${item.path}\\${item.name}` : item.name,
        size,
        dateModified,
        dateCreated,
        dateAccessed,
        attributes,
        isDirectory,
        isHidden,
        isSystem,
        isReadOnly,
      };
    });
  }

  /**
   * Get the Everything version
   */
  public async getVersion(): Promise<string> {
    // Everything HTTP server doesn't provide version information
    return "Unknown Version";
  }

  /**
   * Rebuild the Everything index
   */
  public async rebuildIndex(): Promise<void> {
    await this.makeRequest("?j=1&rebuild=1");
  }

  /**
   * Get the current search status
   */
  public async getSearchStatus(): Promise<SearchStatus> {
    if (!this.connected) {
      await this.connect();
    }

    try {
      // Build query parameters according to Everything HTTP API format
      const params = new URLSearchParams();
      params.append("s", this.currentQuery || "*"); // Search query
      params.append("j", "1"); // JSON output
      params.append("count", "1"); // Only get count

      // Make the request
      const data = await this.makeRequest<SearchResponse>(
        `?${params.toString()}`,
      );

      return {
        totalResults: data.totalResults || 0,
        indexingComplete: true,
        percentComplete: 100,
      };
    } catch (error) {
      throw new EverythingSearchError(
        `Failed to get search status: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Monitor file changes
   */
  public monitorFileChanges(callback: FileChangeCallback): Unsubscribe {
    let lastResults: SearchResult[] = [];
    const interval = setInterval(async () => {
      try {
        const newResults = await this.search("*");
        const changes = this.detectChanges(lastResults, newResults);
        if (changes.length > 0) {
          callback(changes);
        }
        lastResults = newResults;
      } catch (error) {
        console.error("Error monitoring file changes:", error);
      }
    }, 1000);

    return () => clearInterval(interval);
  }

  private detectChanges(
    oldResults: SearchResult[],
    newResults: SearchResult[],
  ): Array<{ path: string; type: "added" | "deleted" | "modified" }> {
    const oldPathMap = new Map<string, SearchResult>();
    const newPathMap = new Map<string, SearchResult>();

    for (const result of oldResults) {
      oldPathMap.set(result.fullPath, result);
    }
    for (const result of newResults) {
      newPathMap.set(result.fullPath, result);
    }

    const changes = [];

    // Check for deleted files
    for (const [path, oldResult] of oldPathMap) {
      if (!newPathMap.has(path)) {
        changes.push({ path, type: "deleted" as const });
      }
    }

    // Check for added and modified files
    for (const [path, newResult] of newPathMap) {
      const oldResult = oldPathMap.get(path);
      if (!oldResult) {
        changes.push({ path, type: "added" as const });
      } else if (
        newResult.dateModified.getTime() !== oldResult.dateModified.getTime()
      ) {
        changes.push({ path, type: "modified" as const });
      }
    }

    return changes;
  }
}
