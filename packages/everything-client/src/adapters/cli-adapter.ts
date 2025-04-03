import { exec } from "node:child_process";
import { existsSync } from "node:fs";
import { arch, platform } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import type {
  FileChangeCallback,
  SearchOptions,
  SearchResult,
  SearchStatus,
  Unsubscribe,
} from "../types";
import {
  EverythingCLIError,
  EverythingConnectionError,
  EverythingSearchError,
} from "../utils/errors";
import type { BaseAdapter } from "./base-adapter";

const execPromise = promisify(exec);

/**
 * Options for the CLI adapter
 */
export interface CLIAdapterOptions {
  cliPath?: string;
  timeout?: number;
}

/**
 * Default adapter options
 */
const DEFAULT_OPTIONS: CLIAdapterOptions = {
  timeout: 10000,
};

/**
 * Create a new CLI adapter with the provided options
 */
export function createCLIAdapter(options: CLIAdapterOptions = {}): CLIAdapter {
  return new CLIAdapter(options);
}

/**
 * Adapter for CLI communication with Everything
 */
export class CLIAdapter implements BaseAdapter {
  private options: CLIAdapterOptions;
  private cliPath: string;
  private connected = false;
  private currentQuery?: string;

  /**
   * Create a new CLI adapter
   */
  constructor(options: CLIAdapterOptions = {}) {
    if (platform() !== "win32") {
      throw new EverythingCLIError("CLI adapter is only available on Windows");
    }

    this.options = { ...DEFAULT_OPTIONS, ...options };
    this.cliPath = this.resolveCLIPath();
  }

  /**
   * Resolve the path to the Everything CLI executable
   */
  private resolveCLIPath(): string {
    // Check if user provided a path
    if (this.options.cliPath && existsSync(this.options.cliPath)) {
      return this.options.cliPath;
    }

    // Check if we have the CLI in our package
    const packageCliPath = join(
      __dirname,
      "..",
      "..",
      "assets",
      "bin",
      arch() === "x64" ? "es64.exe" : "es32.exe",
    );

    if (existsSync(packageCliPath)) {
      return packageCliPath;
    }

    // Default to 'es' and let Windows find it in PATH
    return "es";
  }

  /**
   * Connect to the Everything service
   */
  public async connect(): Promise<void> {
    if (this.connected) {
      return;
    }

    try {
      // Test if we can run the CLI
      await execPromise(`"${this.cliPath}" -h`, {
        timeout: this.options.timeout,
      });
      this.connected = true;
    } catch (error) {
      throw new EverythingConnectionError(
        `Failed to connect to Everything CLI: ${error instanceof Error ? error.message : String(error)}`,
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
      // Build command line arguments
      const args: string[] = [];

      // Search options
      if (options.matchCase) {
        args.push("-case");
      }

      if (options.matchWholeWord) {
        args.push("-whole-word");
      }

      if (options.regex) {
        args.push("-regex");
      }

      // Result limit
      if (typeof options.maxResults === "number") {
        args.push("-n", options.maxResults.toString());
      }

      if (typeof options.offset === "number") {
        args.push("-o", options.offset.toString());
      }

      // Sorting
      if (options.sortBy) {
        switch (options.sortBy) {
          case "date":
            args.push("-s"); // Use the simpler sorting option
            break;
          case "name":
            // Default sort is by name, no need to specify
            break;
          case "size":
            args.push("/os"); // DIR style size sorting
            break;
          case "path":
            args.push("-s"); // Path sorting
            break;
        }
        // Add descending sorting if needed
        if (options.sortOrder === "desc") {
          if (options.sortBy === "size") {
            args.push("/o-s"); // DIR style descending size sort
          } else if (options.sortBy === "date") {
            args.push("/o-d"); // DIR style descending date sort
          } else if (options.sortBy === "name") {
            args.push("/o-n"); // DIR style descending name sort
          }
        }
      }

      // Format as CSV to make parsing easier
      args.push("-csv");

      // Escape the query if it has spaces
      const escapedQuery = query.includes(" ") ? `"${query}"` : query;

      // Execute the command
      const command = `"${this.cliPath}" ${args.join(" ")} ${escapedQuery}`;
      const { stdout, stderr } = await execPromise(command, {
        timeout: this.options.timeout,
      });

      if (stderr) {
        throw new Error(stderr);
      }

      // Parse the results
      return this.parseCSVResults(stdout);
    } catch (error) {
      throw new EverythingSearchError(
        `Search failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Parse CSV results from the CLI output
   */
  private parseCSVResults(csvData: string): SearchResult[] {
    const results: SearchResult[] = [];
    const lines = csvData.trim().split("\n");

    // Skip if empty
    if (lines.length === 0) {
      return results;
    }

    // Process each line
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      // Split the CSV line, handling quoted values
      const values = line.split(",").map((value) => {
        if (value.startsWith('"') && value.endsWith('"')) {
          return value.substring(1, value.length - 1);
        }
        return value;
      });

      if (values.length < 1) {
        continue; // Skip malformed lines
      }

      const fullPath = values[0];

      // Extract file name and path
      let fileName = fullPath;
      let path = "";

      const lastBackslashIndex = fullPath.lastIndexOf("\\");
      if (lastBackslashIndex !== -1) {
        fileName = fullPath.substring(lastBackslashIndex + 1);
        path = fullPath.substring(0, lastBackslashIndex);
      }

      // Get file stats to determine if it's a directory
      const isDirectory = fullPath.endsWith("\\") || fileName === "";

      results.push({
        name: fileName,
        path,
        fullPath,
        size: 0, // Default to 0 as we don't have size info
        dateModified: new Date(), // Default to current date
        dateCreated: new Date(),
        dateAccessed: new Date(),
        attributes: 0,
        isDirectory,
        isHidden: false,
        isSystem: false,
        isReadOnly: false,
      });
    }

    return results;
  }

  /**
   * Get the Everything version
   */
  public async getVersion(): Promise<string> {
    if (!this.connected) {
      await this.connect();
    }

    try {
      const { stdout } = await execPromise(`"${this.cliPath}" -version`, {
        timeout: this.options.timeout,
      });
      return stdout.trim();
    } catch (error) {
      throw new EverythingCLIError(
        `Failed to get version: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Rebuild the Everything index
   */
  public async rebuildIndex(): Promise<void> {
    if (!this.connected) {
      await this.connect();
    }

    try {
      await execPromise(`"${this.cliPath}" -rebuild`, {
        timeout: this.options.timeout,
      });
    } catch (error) {
      throw new EverythingCLIError(
        `Failed to rebuild index: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Get the current search status
   */
  public async getSearchStatus(): Promise<SearchStatus> {
    if (!this.connected) {
      await this.connect();
    }

    try {
      // Use -get-result-count option with the current search query
      const command = `"${this.cliPath}" -get-result-count ${this.currentQuery || "*"}`;
      const { stdout } = await execPromise(command, {
        timeout: this.options.timeout,
      });
      const totalResults = Number.parseInt(stdout.trim(), 10);

      return {
        totalResults,
        indexingComplete: true,
        percentComplete: 100,
      };
    } catch (error) {
      throw new EverythingCLIError(
        `Failed to get search status: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Monitor file changes - not well supported by CLI
   */
  public monitorFileChanges(callback: FileChangeCallback): Unsubscribe {
    // CLI doesn't provide good monitoring capabilities
    // Use a polling approach
    let running = true;
    let lastResults: SearchResult[] = [];

    const poll = async () => {
      if (!running) return;

      try {
        // Get all files with a simple query
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
      setTimeout(poll, 10000); // Longer interval for CLI to reduce load
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
