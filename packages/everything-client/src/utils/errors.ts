/**
 * Base error class for Everything client errors.
 */
export class EverythingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EverythingError";
    Object.setPrototypeOf(this, EverythingError.prototype);
  }
}

/**
 * Error thrown when connection to Everything fails.
 */
export class EverythingConnectionError extends EverythingError {
  constructor(message: string) {
    super(message);
    this.name = "EverythingConnectionError";
    Object.setPrototypeOf(this, EverythingConnectionError.prototype);
  }
}

/**
 * Error thrown when a search operation fails.
 */
export class EverythingSearchError extends EverythingError {
  constructor(message: string) {
    super(message);
    this.name = "EverythingSearchError";
    Object.setPrototypeOf(this, EverythingSearchError.prototype);
  }
}

/**
 * Error thrown when an IPC-specific operation fails.
 */
export class EverythingIPCError extends EverythingError {
  constructor(message: string) {
    super(message);
    this.name = "EverythingIPCError";
    Object.setPrototypeOf(this, EverythingIPCError.prototype);
  }
}

/**
 * Error thrown when a CLI-specific operation fails.
 */
export class EverythingCLIError extends EverythingError {
  constructor(message: string) {
    super(message);
    this.name = "EverythingCLIError";
    Object.setPrototypeOf(this, EverythingCLIError.prototype);
  }
}

/**
 * Error thrown when an HTTP-specific operation fails.
 */
export class EverythingHTTPError extends EverythingError {
  constructor(message: string) {
    super(message);
    this.name = "EverythingHTTPError";
    Object.setPrototypeOf(this, EverythingHTTPError.prototype);
  }
}
