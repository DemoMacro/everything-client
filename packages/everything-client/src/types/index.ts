/**
 * Client options for configuring the Everything client.
 */
export interface ClientOptions {
  /** Adapter type to use for communication with Everything */
  adapter?: "cli" | "ipc" | "http" | "auto";
  /** Timeout in milliseconds for operations */
  timeout?: number;
  /** Path to the Everything CLI executable */
  cliPath?: string;
  /** Port for IPC communication */
  ipcPort?: number;
  /** URL for the Everything HTTP server */
  serverUrl?: string;
  /** Username for HTTP authentication */
  username?: string;
  /** Password for HTTP authentication */
  password?: string;
}

/**
 * Options for configuring a search query.
 */
export interface SearchOptions {
  /** Whether to match case in search */
  matchCase?: boolean;
  /** Whether to match path in search */
  matchPath?: boolean;
  /** Whether to match whole words in search */
  matchWholeWord?: boolean;
  /** Whether to use regex in search */
  regex?: boolean;
  /** Maximum number of results to return */
  maxResults?: number;
  /** Offset for pagination */
  offset?: number;
  /** Field to sort results by */
  sortBy?: "name" | "path" | "size" | "date" | "run-count";
  /** Sort order */
  sortOrder?: "asc" | "desc";
  /** Whether to include hidden files */
  includeHidden?: boolean;
  /** Whether to include system files */
  includeSystem?: boolean;
  /** Whether to include directories */
  includeDirectories?: boolean;
  /** Whether to include files */
  includeFiles?: boolean;
}

/**
 * Represents a single search result.
 */
export interface SearchResult {
  /** Filename or directory name */
  name: string;
  /** Path to the directory containing the file */
  path: string;
  /** Full path to the file (path + name) */
  fullPath: string;
  /** File size in bytes */
  size: number;
  /** Date the file was last modified */
  dateModified: Date;
  /** Date the file was created */
  dateCreated: Date;
  /** Date the file was last accessed */
  dateAccessed: Date;
  /** File attributes (bitmask) */
  attributes: number;
  /** Whether the result is a directory */
  isDirectory: boolean;
  /** Whether the file is hidden */
  isHidden: boolean;
  /** Whether the file is a system file */
  isSystem: boolean;
  /** Whether the file is read-only */
  isReadOnly: boolean;
}

/**
 * Status information about the current search.
 */
export interface SearchStatus {
  /** Total number of results found */
  totalResults: number;
  /** Whether indexing is complete */
  indexingComplete: boolean;
  /** Percentage of indexing completion */
  percentComplete: number;
}

/**
 * Callback for file change monitoring.
 */
export type FileChangeCallback = (changes: FileChange[]) => void;

/**
 * Represents a file change event.
 */
export interface FileChange {
  /** Full path to the file */
  path: string;
  /** Type of change that occurred */
  type: "added" | "modified" | "deleted";
}

/**
 * Function to unsubscribe from file monitoring.
 */
export type Unsubscribe = () => void;

/**
 * The main Everything client interface.
 */
export interface EverythingClient {
  /**
   * Search for files and directories using Everything.
   * @param query The search query
   * @param options Optional search options
   * @returns Promise resolving to an array of search results
   */
  search(query: string, options?: SearchOptions): Promise<SearchResult[]>;

  /**
   * Connect to the Everything service.
   * @returns Promise resolving when connected
   */
  connect(): Promise<void>;

  /**
   * Disconnect from the Everything service.
   */
  disconnect(): void;

  /**
   * Check if the client is connected to Everything.
   * @returns Boolean indicating connection status
   */
  isConnected(): boolean;

  /**
   * Get the version of the Everything service.
   * @returns Promise resolving to the version string
   */
  getVersion(): Promise<string>;

  /**
   * Rebuild the Everything index.
   * @returns Promise resolving when index rebuild is initiated
   */
  rebuildIndex(): Promise<void>;

  /**
   * Get the current search status.
   * @returns Promise resolving to the search status
   */
  getSearchStatus(): Promise<SearchStatus>;

  /**
   * Monitor file changes and receive notifications.
   * @param callback Function to call when files change
   * @returns Function to call to stop monitoring
   */
  monitorFileChanges(callback: FileChangeCallback): Unsubscribe;
}
