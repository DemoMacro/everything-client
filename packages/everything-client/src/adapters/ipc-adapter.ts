import { existsSync } from "node:fs";
import { arch, platform } from "node:os";
import { join } from "node:path";
import koffi from "koffi";
import type {
  FileChangeCallback,
  SearchOptions,
  SearchResult,
  SearchStatus,
  Unsubscribe,
} from "../types";
import {
  EverythingConnectionError,
  EverythingIPCError,
  EverythingSearchError,
} from "../utils/errors";
import type { BaseAdapter } from "./base-adapter";

/**
 * Options for the IPC adapter
 */
export interface IPCAdapterOptions {
  timeout?: number;
}

/**
 * Default adapter options
 */
const DEFAULT_OPTIONS: IPCAdapterOptions = {
  timeout: 5000,
};

/**
 * Create a new IPC adapter with the provided options
 */
export function createIPCAdapter(options: IPCAdapterOptions = {}): IPCAdapter {
  return new IPCAdapter(options);
}

// Type for the Everything Library interface
interface EverythingLib {
  Everything_SetSearchW: (query: string) => void;
  Everything_SetMatchPath: (enable: boolean) => void;
  Everything_SetMatchCase: (enable: boolean) => void;
  Everything_SetMatchWholeWord: (enable: boolean) => void;
  Everything_SetRegex: (enable: boolean) => void;
  Everything_SetMax: (max: number) => void;
  Everything_SetOffset: (offset: number) => void;
  Everything_SetSort: (sort: number) => void;
  Everything_QueryW: () => boolean;
  Everything_GetNumResults: () => number;
  Everything_GetResultFileNameW: (index: number) => string;
  Everything_GetResultPathW: (index: number) => string;
  Everything_GetResultSize: (index: number) => number;
  Everything_GetResultDateModified: (index: number) => number;
  Everything_GetResultDateCreated: (index: number) => number;
  Everything_GetResultDateAccessed: (index: number) => number;
  Everything_GetResultAttributes: (index: number) => number;
  Everything_IsFolderResult: (index: number) => boolean;
  Everything_GetLastError: () => number;
  Everything_GetMajorVersion: () => number;
  Everything_GetMinorVersion: () => number;
  Everything_GetRevision: () => number;
  Everything_GetBuildNumber: () => number;
  Everything_RebuildDB: () => void;
  Everything_GetTotResults: () => number;
  Everything_IsDBLoaded: () => boolean;
  Everything_IsAdmin: () => boolean;
  Everything_IsAppData: () => boolean;
  Everything_Reset: () => void;
}

/**
 * Adapter for IPC communication with Everything on Windows
 */
export class IPCAdapter implements BaseAdapter {
  private connected = false;
  private options: IPCAdapterOptions;
  private dllPath: string;
  private everything: EverythingLib | null = null;
  private currentQuery: string | null = null;

  /**
   * Create a new IPC adapter
   */
  constructor(options: IPCAdapterOptions = {}) {
    if (platform() !== "win32") {
      throw new EverythingIPCError("IPC adapter is only available on Windows");
    }

    this.options = { ...DEFAULT_OPTIONS, ...options };
    this.dllPath = this.resolveDllPath();
  }

  /**
   * Resolve the path to the Everything DLL
   */
  private resolveDllPath(): string {
    // First check if we have the DLL in our package
    const packageDllPath = join(
      __dirname,
      "..",
      "..",
      "assets",
      "bin",
      arch() === "x64" ? "Everything64.dll" : "Everything32.dll",
    );

    if (existsSync(packageDllPath)) {
      return packageDllPath;
    }

    // If not, return the name and let Windows find it
    return arch() === "x64" ? "Everything64.dll" : "Everything32.dll";
  }

  /**
   * Connect to the Everything service
   */
  public async connect(): Promise<void> {
    if (this.connected) {
      return;
    }

    try {
      // Load the Everything DLL using koffi
      const lib = koffi.load(this.dllPath);

      // Define the Everything interface using koffi
      this.everything = {
        Everything_SetSearchW: lib.func(
          "void Everything_SetSearchW(const wchar_t *)",
        ),
        Everything_SetMatchPath: lib.func("void Everything_SetMatchPath(bool)"),
        Everything_SetMatchCase: lib.func("void Everything_SetMatchCase(bool)"),
        Everything_SetMatchWholeWord: lib.func(
          "void Everything_SetMatchWholeWord(bool)",
        ),
        Everything_SetRegex: lib.func("void Everything_SetRegex(bool)"),
        Everything_SetMax: lib.func("void Everything_SetMax(uint32)"),
        Everything_SetOffset: lib.func("void Everything_SetOffset(uint32)"),
        Everything_SetSort: lib.func("void Everything_SetSort(uint32)"),
        Everything_QueryW: lib.func("bool Everything_QueryW()"),
        Everything_GetNumResults: lib.func("uint32 Everything_GetNumResults()"),
        Everything_GetResultFileNameW: lib.func(
          "const wchar_t *Everything_GetResultFileNameW(uint32)",
        ),
        Everything_GetResultPathW: lib.func(
          "const wchar_t *Everything_GetResultPathW(uint32)",
        ),
        Everything_GetResultSize: lib.func(
          "uint64 Everything_GetResultSize(uint32)",
        ),
        Everything_GetResultDateModified: lib.func(
          "uint64 Everything_GetResultDateModified(uint32)",
        ),
        Everything_GetResultDateCreated: lib.func(
          "uint64 Everything_GetResultDateCreated(uint32)",
        ),
        Everything_GetResultDateAccessed: lib.func(
          "uint64 Everything_GetResultDateAccessed(uint32)",
        ),
        Everything_GetResultAttributes: lib.func(
          "uint32 Everything_GetResultAttributes(uint32)",
        ),
        Everything_IsFolderResult: lib.func(
          "bool Everything_IsFolderResult(uint32)",
        ),
        Everything_GetLastError: lib.func("uint32 Everything_GetLastError()"),
        Everything_GetMajorVersion: lib.func(
          "uint32 Everything_GetMajorVersion()",
        ),
        Everything_GetMinorVersion: lib.func(
          "uint32 Everything_GetMinorVersion()",
        ),
        Everything_GetRevision: lib.func("uint32 Everything_GetRevision()"),
        Everything_GetBuildNumber: lib.func(
          "uint32 Everything_GetBuildNumber()",
        ),
        Everything_RebuildDB: lib.func("void Everything_RebuildDB()"),
        Everything_GetTotResults: lib.func("uint32 Everything_GetTotResults()"),
        Everything_IsDBLoaded: lib.func("bool Everything_IsDBLoaded()"),
        Everything_IsAdmin: lib.func("bool Everything_IsAdmin()"),
        Everything_IsAppData: lib.func("bool Everything_IsAppData()"),
        Everything_Reset: lib.func("void Everything_Reset()"),
      } as EverythingLib;

      // Check if Everything service is running
      if (!this.everything.Everything_IsDBLoaded()) {
        throw new Error(
          "Everything service is not running or database is not loaded",
        );
      }

      // Reset search state
      this.everything.Everything_Reset();

      // Test connection with a simple search
      this.everything.Everything_SetSearchW("*");
      if (!this.everything.Everything_QueryW()) {
        const lastError = this.everything.Everything_GetLastError();
        throw new Error(
          `Everything search failed with error code: ${lastError}`,
        );
      }

      this.connected = true;
    } catch (error) {
      throw new EverythingConnectionError(
        `Failed to connect to Everything: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Disconnect from the Everything service
   */
  public disconnect(): void {
    this.everything = null;
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

    if (!this.everything) {
      throw new EverythingConnectionError("Not connected to Everything");
    }

    try {
      // Reset search state
      this.everything.Everything_Reset();

      // Set search options
      this.everything.Everything_SetSearchW(query);
      this.everything.Everything_SetMatchPath(!!options.matchPath);
      this.everything.Everything_SetMatchCase(!!options.matchCase);
      this.everything.Everything_SetMatchWholeWord(!!options.matchWholeWord);
      this.everything.Everything_SetRegex(!!options.regex);

      // Set max results and offset for pagination
      if (typeof options.maxResults === "number") {
        this.everything.Everything_SetMax(options.maxResults);
      } else {
        this.everything.Everything_SetMax(1000); // Default limit
      }

      if (typeof options.offset === "number") {
        this.everything.Everything_SetOffset(options.offset);
      } else {
        this.everything.Everything_SetOffset(0);
      }

      // Set sort order
      if (options.sortBy) {
        const sortMap: Record<string, number> = {
          "name-asc": 1,
          "name-desc": 2,
          "path-asc": 3,
          "path-desc": 4,
          "size-asc": 5,
          "size-desc": 6,
          "date-asc": 13,
          "date-desc": 14,
          "run-count-asc": 19,
          "run-count-desc": 20,
        };

        const sortKey = `${options.sortBy}-${options.sortOrder || "asc"}`;
        const sortValue = sortMap[sortKey];
        if (sortValue) {
          this.everything.Everything_SetSort(sortValue);
        }
      }

      // Execute search
      if (!this.everything.Everything_QueryW()) {
        const lastError = this.everything.Everything_GetLastError();
        throw new Error(`Search failed with error code: ${lastError}`);
      }

      // Get results
      const numResults = this.everything.Everything_GetNumResults();
      const results: SearchResult[] = [];

      for (let i = 0; i < numResults; i++) {
        const result = await this.getResult(i);
        if (result) {
          results.push(result);
        }
      }

      this.currentQuery = query;
      return results;
    } catch (error) {
      throw new EverythingSearchError(
        `Search failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Get the Everything version
   */
  public async getVersion(): Promise<string> {
    if (!this.connected) {
      await this.connect();
    }

    if (!this.everything) {
      throw new EverythingConnectionError("Not connected to Everything");
    }

    const major = this.everything.Everything_GetMajorVersion();
    const minor = this.everything.Everything_GetMinorVersion();
    const revision = this.everything.Everything_GetRevision();
    const build = this.everything.Everything_GetBuildNumber();

    return `${major}.${minor}.${revision}.${build}`;
  }

  /**
   * Rebuild the Everything index
   */
  public async rebuildIndex(): Promise<void> {
    if (!this.connected) {
      await this.connect();
    }

    if (!this.everything) {
      throw new EverythingConnectionError("Not connected to Everything");
    }

    this.everything.Everything_RebuildDB();
  }

  /**
   * Get the current search status
   */
  public async getSearchStatus(): Promise<SearchStatus> {
    if (!this.connected) {
      await this.connect();
    }

    if (!this.everything) {
      throw new EverythingConnectionError("Not connected to Everything");
    }

    try {
      // Check if database is loaded
      const indexingComplete = this.everything.Everything_IsDBLoaded();

      // Get total results for current search
      const totalResults = this.everything.Everything_GetTotResults();

      // If no search has been performed, do a simple search to get total count
      if (totalResults === 0 && this.currentQuery) {
        this.everything.Everything_Reset();
        this.everything.Everything_SetSearchW(this.currentQuery);
        this.everything.Everything_QueryW();
        return {
          totalResults: this.everything.Everything_GetTotResults(),
          indexingComplete,
          percentComplete: indexingComplete ? 100 : 50,
        };
      }

      return {
        totalResults,
        indexingComplete,
        percentComplete: indexingComplete ? 100 : 50,
      };
    } catch (error) {
      throw new EverythingConnectionError(
        `Failed to get search status: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Monitor file changes
   */
  public monitorFileChanges(callback: FileChangeCallback): Unsubscribe {
    // Unfortunately, the Everything SDK doesn't provide a way to monitor file changes directly
    // This is a simplified implementation that just polls for changes
    let running = true;
    let lastResults: SearchResult[] = [];

    const poll = async () => {
      if (!running) return;

      try {
        // Perform a wildcard search to get all indexed files
        const results = await this.search("*");

        // Compare with last results to detect changes
        if (lastResults.length > 0) {
          const changes = this.detectChanges(lastResults, results);

          if (changes.length > 0) {
            callback(changes);
          }
        }

        lastResults = results;
      } catch (error) {
        // Ignore errors during polling
      }

      // Poll again after a delay
      setTimeout(poll, 5000);
    };

    // Start polling
    poll();

    // Return function to stop monitoring
    return () => {
      running = false;
    };
  }

  /**
   * Detect changes between two sets of results
   */
  private detectChanges(
    oldResults: SearchResult[],
    newResults: SearchResult[],
  ): Array<{ path: string; type: "added" | "deleted" | "modified" }> {
    const oldPaths = new Map<string, SearchResult>();
    const newPaths = new Map<string, SearchResult>();

    for (const result of oldResults) {
      oldPaths.set(result.fullPath, result);
    }
    for (const result of newResults) {
      newPaths.set(result.fullPath, result);
    }

    const changes = [];

    // Check for deleted files
    for (const [path, oldResult] of oldPaths) {
      if (!newPaths.has(path)) {
        changes.push({ path, type: "deleted" as const });
      }
    }

    // Check for added and modified files
    for (const [path, newResult] of newPaths) {
      const oldResult = oldPaths.get(path);
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

  /**
   * Convert Windows file time to JavaScript Date
   */
  private fileTimeToDate(fileTime: number): Date {
    // Windows file time is in 100-nanosecond intervals since January 1, 1601 UTC
    // JavaScript Date time is in milliseconds since January 1, 1970 UTC
    // Need to convert between these two
    if (fileTime === 0) {
      return new Date(0);
    }

    // 116444736000000000 is the number of 100-nanosecond intervals between
    // January 1, 1601 UTC and January 1, 1970 UTC
    const WINDOWS_EPOCH_OFFSET = 116444736000000000;

    // Convert to milliseconds and adjust epoch
    const milliseconds = (fileTime - WINDOWS_EPOCH_OFFSET) / 10000;

    return new Date(milliseconds);
  }

  private async getResult(index: number): Promise<SearchResult | null> {
    if (!this.connected) {
      await this.connect();
    }

    if (!this.everything) {
      throw new EverythingConnectionError("Not connected to Everything");
    }

    try {
      const fileName = this.everything.Everything_GetResultFileNameW(index);
      const path = this.everything.Everything_GetResultPathW(index);
      const size = this.everything.Everything_GetResultSize(index);
      const dateModifiedRaw =
        this.everything.Everything_GetResultDateModified(index);
      const dateCreatedRaw =
        this.everything.Everything_GetResultDateCreated(index);
      const dateAccessedRaw =
        this.everything.Everything_GetResultDateAccessed(index);
      const attributes = this.everything.Everything_GetResultAttributes(index);
      const isDirectory = this.everything.Everything_IsFolderResult(index);

      // Convert Windows file time to JavaScript Date
      const dateModified = this.fileTimeToDate(dateModifiedRaw);
      const dateCreated = this.fileTimeToDate(dateCreatedRaw);
      const dateAccessed = this.fileTimeToDate(dateAccessedRaw);

      // Create result object
      return {
        name: fileName,
        path,
        fullPath: path ? `${path}\\${fileName}` : fileName,
        size,
        dateModified,
        dateCreated,
        dateAccessed,
        attributes,
        isDirectory,
        isHidden: !!(attributes & 0x2), // FILE_ATTRIBUTE_HIDDEN
        isSystem: !!(attributes & 0x4), // FILE_ATTRIBUTE_SYSTEM
        isReadOnly: !!(attributes & 0x1), // FILE_ATTRIBUTE_READONLY
      };
    } catch (error) {
      throw new EverythingConnectionError(
        `Failed to get result: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
