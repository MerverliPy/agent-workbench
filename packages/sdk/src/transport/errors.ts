export class SdkError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = "SdkError";
  }
}

export class ApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number,
    public readonly requestId?: string,
    public readonly recoverable?: boolean,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}
