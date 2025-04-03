import { exit } from "node:process";
import { createIPCAdapter } from "../packages/everything-client/src/adapters";
import {
  EverythingConnectionError,
  EverythingSearchError,
} from "../packages/everything-client/src/utils/errors";

async function main() {
  // Create IPC adapter instance using factory function
  const adapter = createIPCAdapter({
    timeout: 5000, // Set timeout to 5 seconds
  });

  try {
    // Connect to Everything service
    console.log("Connecting to Everything service...");
    await adapter.connect();
    console.log("Connected successfully!");

    // Get Everything version
    const version = await adapter.getVersion();
    console.log(`Everything version: ${version}`);

    // Execute search with standardized options
    console.log("\nExecuting search...");
    const results = await adapter.search("*.txt", {
      matchCase: false,
      matchWholeWord: false,
      maxResults: 10,
      sortBy: "name",
      sortOrder: "asc",
    });

    // Display search results
    console.log("\nSearch results:");
    for (const [index, result] of results.entries()) {
      console.log(`\n${index + 1}. ${result.fullPath}`);
      console.log(`   Size: ${result.size} bytes`);
      console.log(`   Modified: ${result.dateModified}`);
      console.log(`   Created: ${result.dateCreated}`);
      console.log(`   Accessed: ${result.dateAccessed}`);
      console.log(`   Type: ${result.isDirectory ? "Directory" : "File"}`);
      console.log(
        `   Attributes: ${result.isHidden ? "Hidden" : ""} ${result.isSystem ? "System" : ""} ${result.isReadOnly ? "Read-only" : ""}`,
      );
    }

    // Get search status
    const status = await adapter.getSearchStatus();
    console.log("\nSearch status:");
    console.log(`Total results: ${status.totalResults}`);
    console.log(`Indexing complete: ${status.indexingComplete ? "Yes" : "No"}`);
    console.log(`Completion percentage: ${status.percentComplete}%`);
  } catch (error) {
    if (error instanceof EverythingConnectionError) {
      console.error("Connection error:", error.message);
    } else if (error instanceof EverythingSearchError) {
      console.error("Search error:", error.message);
    } else {
      console.error("Unexpected error:", error);
    }
  } finally {
    // Disconnect
    console.log("\nDisconnecting...");
    adapter.disconnect();
    // Wait for resources to be released
    await new Promise((resolve) => setTimeout(resolve, 1000));
    console.log("Disconnected");

    exit(0);
  }
}

// Run example
main().catch((error) => {
  console.error("Fatal error:", error);
  exit(1);
});
