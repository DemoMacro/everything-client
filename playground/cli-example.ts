import { exit } from "node:process";
import { createCLIAdapter } from "../packages/everything-client/src/adapters";

async function main() {
  // Create CLI adapter instance using factory function
  const adapter = createCLIAdapter({
    timeout: 10000, // Set timeout to 10 seconds
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

    // Monitor file changes
    console.log("\nStarting file change monitoring...");
    const unsubscribe = adapter.monitorFileChanges((changes) => {
      console.log("\nFile changes detected:");
      for (const change of changes) {
        console.log(`${change.type}: ${change.path}`);
      }
    });

    // Stop monitoring after 30 seconds
    setTimeout(() => {
      console.log("\nStopping file change monitoring");
      unsubscribe();
    }, 30000);
  } catch (error) {
    console.error("Error occurred:", error);
  } finally {
    // Disconnect
    adapter.disconnect();
    console.log("\nDisconnected");

    exit(0);
  }
}

// Run example
main().catch(console.error);
