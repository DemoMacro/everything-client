import { existsSync } from "node:fs";
import { arch, platform } from "node:os";
import { join } from "node:path";
import type * as FFI from "ffi-napi";
import type * as Ref from "ref-napi";
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

// Type for the FFI Library interface
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
}

/**
 * Adapter for IPC communication with Everything on Windows
 */
export class IPCAdapter implements BaseAdapter {
  private connected = false;
  private options: IPCAdapterOptions;
  private dllPath: string;
  private ffi: typeof FFI | null = null;
  private ref: typeof Ref | null = null;
  private everything: EverythingLib | null = null;

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
      if (!this.ffi || !this.ref) {
        try {
          // Dynamic import, because FFI is Node.js specific and not available in browsers
          const ffiModule = await import("ffi-napi");
          const refModule = await import("ref-napi");
          this.ffi = ffiModule;
          this.ref = refModule;
        } catch (error) {
          throw new Error(
            "Failed to load FFI modules. Make sure ffi-napi and ref-napi are installed.",
          );
        }
      }

      // Define the FFI interface to the Everything DLL
      this.everything = this.ffi.Library(this.dllPath, {
        Everything_SetSearchW: ["void", ["string"]],
        Everything_SetMatchPath: ["void", ["bool"]],
        Everything_SetMatchCase: ["void", ["bool"]],
        Everything_SetMatchWholeWord: ["void", ["bool"]],
        Everything_SetRegex: ["void", ["bool"]],
        Everything_SetMax: ["void", ["uint32"]],
        Everything_SetOffset: ["void", ["uint32"]],
        Everything_SetSort: ["void", ["uint32"]],
        Everything_QueryW: ["bool", []],
        Everything_GetNumResults: ["uint32", []],
        Everything_GetResultFileNameW: ["string", ["uint32"]],
        Everything_GetResultPathW: ["string", ["uint32"]],
        Everything_GetResultSize: ["uint64", ["uint32"]],
        Everything_GetResultDateModified: ["uint64", ["uint32"]],
        Everything_GetResultDateCreated: ["uint64", ["uint32"]],
        Everything_GetResultDateAccessed: ["uint64", ["uint32"]],
        Everything_GetResultAttributes: ["uint32", ["uint32"]],
        Everything_IsFolderResult: ["bool", ["uint32"]],
        Everything_GetLastError: ["uint32", []],
        Everything_GetMajorVersion: ["uint32", []],
        Everything_GetMinorVersion: ["uint32", []],
        Everything_GetRevision: ["uint32", []],
        Everything_GetBuildNumber: ["uint32", []],
        Everything_RebuildDB: ["void", []],
        Everything_GetTotResults: ["uint32", []],
        Everything_IsDBLoaded: ["bool", []],
      }) as unknown as EverythingLib;

      // Test connection
      const lastError = this.everything.Everything_GetLastError();
      if (lastError !== 0) {
        throw new Error(`Everything error code: ${lastError}`);
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
    this.ffi = null;
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

      // Execute the query
      const success = this.everything.Everything_QueryW();
      if (!success) {
        throw new EverythingSearchError("Failed to execute search query");
      }

      // Wait for results
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Get total results
      const totalResults = this.everything.Everything_GetTotResults();
      if (totalResults === 0) {
        return [];
      }

      // Get results
      const results: SearchResult[] = [];
      for (let i = 0; i < totalResults; i++) {
        const result = await this.getResult(i);
        if (result) {
          results.push(result);
        }
      }

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
      // Get total results using Everything_GetTotResults
      const totalResults = this.everything.Everything_GetTotResults();

      // Check if database is loaded
      const indexingComplete = this.everything.Everything_IsDBLoaded();

      return {
        totalResults,
        indexingComplete,
        percentComplete: indexingComplete ? 100 : 50, // This is approximate
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
