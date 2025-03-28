# everything-client

![npm version](https://img.shields.io/npm/v/everything-client)
![npm downloads](https://img.shields.io/npm/dw/everything-client)
![npm license](https://img.shields.io/npm/l/everything-client)
[![Contributor Covenant](https://img.shields.io/badge/Contributor%20Covenant-2.1-4baaaa.svg)](https://www.contributor-covenant.org/version/2/1/code_of_conduct/)

> A modern JavaScript library for interacting with the Everything search engine, providing a powerful cross-platform interface to search files on Windows systems.

## Overview

Everything is a powerful and lightweight file search engine for Windows that instantly finds files and folders by name. This library provides a unified interface to interact with Everything through multiple methods:

- Command line interface
- IPC (Inter-Process Communication)
- HTTP API (via Everything's built-in HTTP server)

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

const everything = createClient({
  adapter: "http", // Only HTTP adapter is available in browsers
  serverUrl: "http://localhost:8080", // Optional - defaults to "http://localhost:8080"
  username: "admin", // HTTP authentication username
  password: "password", // HTTP authentication password
});
```

## Adapters

The library provides three adapters to communicate with Everything:

### CLI Adapter

Works in Node.js environments by using child processes to execute Everything commands. Suitable for simple integration scenarios.

```typescript
import { createCLIAdapter } from "everything-client";

const adapter = createCLIAdapter({
  cliPath: "path/to/es.exe", // Optional - defaults to "es" in PATH
  timeout: 10000, // Optional - defaults to 10000ms
});
```

### IPC Adapter

Windows-specific Node.js implementation with direct communication with Everything using Windows messages. This is the highest performance option for Node.js applications on Windows.

```typescript
import { createIPCAdapter } from "everything-client";

const adapter = createIPCAdapter({
  timeout: 5000, // Optional - defaults to 5000ms
});
```

### HTTP Adapter

Works in both Node.js and browser environments by communicating with Everything's built-in HTTP server using [ofetch](https://github.com/unjs/ofetch). This adapter is cross-platform and cross-environment compatible.

```typescript
import { createHTTPAdapter } from "everything-client";

const adapter = createHTTPAdapter({
  serverUrl: "http://localhost:8080", // Optional - defaults to "http://localhost:8080"
  username: "admin", // Optional - for HTTP authentication
  password: "password", // Optional - for HTTP authentication
  timeout: 5000, // Optional - defaults to 5000ms
});
```

## Features

- 🚀 Built with modern ESM and TypeScript
- 🔄 Uses ofetch for HTTP communication with better performance and robustness
- 🔌 Dynamically loads optional dependencies for better compatibility
- 📦 Optimized package structure with smaller installation size

## API Reference

See the [main project documentation](https://github.com/DemoMacro/everything-client) for full API details.

## License

- [MIT](LICENSE) &copy; [Demo Macro](https://imst.xyz/)
