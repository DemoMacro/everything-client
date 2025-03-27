# everything-client

![GitHub](https://img.shields.io/github/license/DemoMacro/everything-client)
[![Contributor Covenant](https://img.shields.io/badge/Contributor%20Covenant-2.1-4baaaa.svg)](https://www.contributor-covenant.org/version/2/1/code_of_conduct/)

> A modern JavaScript library for interacting with the Everything search engine, providing a powerful cross-platform interface to search files on Windows systems.

## Overview

Everything is a powerful and lightweight file search engine for Windows that instantly finds files and folders by name. This library provides a unified interface to interact with Everything through multiple methods:

- Command line interface (CLI)
- IPC (Inter-Process Communication)
- HTTP API (via Everything's built-in HTTP server)

## Features

- 🔍 Instant file searching leveraging Everything's high-performance engine
- 📦 Flexible architecture with pluggable adapters (CLI, IPC, HTTP)
- 🎯 Advanced search syntax and filter support
- 🔄 Real-time file system monitoring
- 📊 Customizable result handling and pagination
- 🔒 Type-safe API with full TypeScript support
- 🌐 Cross-environment compatibility (Node.js and browsers)

## Requirements

- Windows operating system (target system)
- Everything search engine installed on the target Windows system
- Node.js >= 14.0.0 (for Node.js environment)
- Everything HTTP server enabled (for HTTP/browser access)

## Installation

```bash
# npm
$ npm install everything-client

# yarn
$ yarn add everything-client

# pnpm
$ pnpm add everything-client
```

## Usage

### Basic Usage

```typescript
import { createClient } from "everything-client";

// The client factory automatically selects the best available adapter
const everything = createClient();

// Simple search - returns a promise with results
const results = await everything.search("*.pdf");
console.log(results);

// Advanced search with options
const advancedResults = await everything.search("document", {
  matchCase: true,
  regex: false,
  maxResults: 100,
  sortBy: "date",
  sortOrder: "desc",
});
```

### Environment-Specific Configuration

```typescript
// Node.js with specific adapter
import { createClient } from "everything-client";

const everything = createClient({
  adapter: "ipc", // Explicitly use IPC adapter
  // IPC-specific options
  timeout: 5000,
});

// Browser environment
import { createClient } from "everything-client";
// or import from a browser-specific entry point
// import { createClient } from 'everything-client/browser';

const everything = createClient({
  adapter: "http", // Only HTTP adapter is available in browsers
  serverUrl: "http://localhost:8080",
  username: "admin", // HTTP authentication username
  password: "password", // HTTP authentication password
});
```

## API Reference

### Core API

```typescript
// Factory function - primary entry point
function createClient(options?: ClientOptions): EverythingClient;

// Main client interface
interface EverythingClient {
  // Core search functionality
  search(query: string, options?: SearchOptions): Promise<SearchResult[]>;

  // Connection management
  connect(): Promise<void>;
  disconnect(): void;
  isConnected(): boolean;

  // Utility methods
  getVersion(): Promise<string>;
  rebuildIndex(): Promise<void>;

  // Advanced functionality
  getSearchStatus(): Promise<SearchStatus>;
  monitorFileChanges(callback: FileChangeCallback): Unsubscribe;
}
```

### Configuration Types

```typescript
interface ClientOptions {
  adapter?: "cli" | "ipc" | "http" | "auto";
  timeout?: number;

  // Adapter-specific options
  cliPath?: string; // CLI adapter
  ipcPort?: number; // IPC adapter
  serverUrl?: string; // HTTP adapter
  username?: string; // HTTP adapter - username for authentication
  password?: string; // HTTP adapter - password for authentication
}

interface SearchOptions {
  matchCase?: boolean;
  matchWholeWord?: boolean;
  regex?: boolean;
  maxResults?: number;
  offset?: number;
  sortBy?: "name" | "path" | "size" | "date" | "run-count";
  sortOrder?: "asc" | "desc";
  includeHidden?: boolean;
  includeSystem?: boolean;
  includeDirectories?: boolean;
  includeFiles?: boolean;
}

interface SearchResult {
  name: string;
  path: string;
  fullPath: string;
  size: number;
  dateModified: Date;
  dateCreated: Date;
  dateAccessed: Date;
  attributes: number;
  isDirectory: boolean;
  isHidden: boolean;
  isSystem: boolean;
  isReadOnly: boolean;
}

interface SearchStatus {
  totalResults: number;
  indexingComplete: boolean;
  percentComplete: number;
}

type FileChangeCallback = (
  changes: Array<{
    path: string;
    type: "added" | "deleted" | "modified";
  }>,
) => void;

type Unsubscribe = () => void;
```

## Adapter Implementation Details

The library provides several adapters to communicate with Everything:

### CLI Adapter

- Works in Node.js environments
- Uses child processes to execute Everything commands
- Suitable for simple integration scenarios
- No continuous connection - stateless operation
- Supports basic search operations and result retrieval
- Limited support for advanced features due to CLI limitations

### IPC Adapter

- Windows-specific Node.js implementation
- Direct communication with Everything using Windows messages
- Highest performance option for Node.js applications on Windows
- Maintains persistent connection to Everything
- Full support for all Everything SDK features
- Requires Everything to be running on the same machine
- Supports real-time file monitoring through polling

### HTTP Adapter

- Works in both Node.js and browser environments
- Communicates with Everything's built-in HTTP server
- Cross-platform and cross-environment compatible
- Supports remote connections (not limited to local machine)
- Uses HTTP Basic Authentication with username and password
- Limited feature set compared to IPC adapter
- Requires Everything HTTP server to be enabled

## Error Handling

The library provides detailed error information with specific error types:

```typescript
try {
  const results = await everything.search("*.pdf");
} catch (error) {
  if (error instanceof EverythingConnectionError) {
    console.error("Connection to Everything failed:", error.message);
  } else if (error instanceof EverythingSearchError) {
    console.error("Search failed:", error.message);
  } else if (error instanceof EverythingCLIError) {
    console.error("CLI operation failed:", error.message);
  } else if (error instanceof EverythingIPCError) {
    console.error("IPC operation failed:", error.message);
  } else {
    console.error("Unexpected error:", error);
  }
}
```

## Security Considerations

- Input validation and sanitization for all search queries
- Secure handling of file paths to prevent path traversal attacks
- HTTP Basic Authentication for HTTP connections (username/password)
- CORS configuration options for browser environments
- Limited privileges when executing CLI commands
- Note: HTTP authentication sends credentials as plain text - use in trusted networks only

## Performance Optimization

- Automatic connection pooling for frequent searches
- Optional result caching with customizable cache strategies
- Batch processing for large result sets to reduce memory usage
- Incremental result fetching for large result sets
- Efficient file change monitoring through polling
- Optimized IPC communication for Windows environments

## Contributing

Contributions are welcome! Please read our contributing guidelines before submitting pull requests.

## Acknowledgments

- [Everything Search Engine](https://www.voidtools.com/)
- [Everything SDK Documentation](https://www.voidtools.com/support/everything/sdk/)

## License

- [MIT](LICENSE) &copy; [Demo Macro](https://imst.xyz/)
