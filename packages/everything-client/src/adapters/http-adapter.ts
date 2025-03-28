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
  results: Array<{
    name: string;
    path: string;
    full_path?: string;
    size?: number;
    date_modified: number;
    date_created: number;
    date_accessed: number;
    attributes?: number;
    is_directory?: boolean;
    is_hidden?: boolean;
    is_system?: boolean;
    is_readonly?: boolean;
  }>;
}

interface VersionResponse {
  version: string;
}

interface StatusResponse {
  total_results: number;
  indexing_complete: boolean;
  percent_complete: number;
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
    try {
      // Test connection by getting version
      await this.getVersion();
      this.connected = true;
    } catch (error) {
      throw new EverythingConnectionError(
        `Failed to connect to Everything HTTP server: ${error instanceof Error ? error.message : String(error)}`,
      );
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

    try {
      // Build query parameters
      const params = new URLSearchParams();
      params.append("search", query);

      if (options.matchCase) {
        params.append("case", "1");
      }

      if (options.matchWholeWord) {
        params.append("whole_word", "1");
      }

      if (options.regex) {
        params.append("regex", "1");
      }

      if (typeof options.maxResults === "number") {
        params.append("max_results", options.maxResults.toString());
      }

      if (typeof options.offset === "number") {
        params.append("offset", options.offset.toString());
      }

      if (options.sortBy) {
        let sortParam = options.sortBy;
        if (options.sortOrder === "desc") {
          sortParam += "_desc";
        }
        params.append("sort", sortParam);
      }

      // Make the request
      const data = await this.makeRequest<SearchResponse>(
        `api/search?${params.toString()}`,
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
      // Create dates from timestamps
      const dateModified = new Date(item.date_modified * 1000);
      const dateCreated = new Date(item.date_created * 1000);
      const dateAccessed = new Date(item.date_accessed * 1000);

      return {
        name: item.name,
        path: item.path,
        fullPath: item.full_path || `${item.path}\\${item.name}`,
        size: item.size || 0,
        dateModified,
        dateCreated,
        dateAccessed,
        attributes: item.attributes || 0,
        isDirectory: !!item.is_directory,
        isHidden: !!item.is_hidden,
        isSystem: !!item.is_system,
        isReadOnly: !!item.is_readonly,
      };
    });
  }

  /**
   * Get the Everything version
   */
  public async getVersion(): Promise<string> {
    const data = await this.makeRequest<VersionResponse>("api/version");
    return data.version;
  }

  /**
   * Rebuild the Everything index
   */
  public async rebuildIndex(): Promise<void> {
    await this.makeRequest("api/rebuild");
  }

  /**
   * Get the current search status
   */
  public async getSearchStatus(): Promise<SearchStatus> {
    const data = await this.makeRequest<StatusResponse>("api/status");

    return {
      totalResults: data.total_results,
      indexingComplete: data.indexing_complete,
      percentComplete: data.percent_complete,
    };
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
