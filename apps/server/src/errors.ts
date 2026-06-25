export class ApiError extends Error {
  public readonly status: number;
  public readonly code: string;
  public readonly details: unknown;
  public readonly recoverable: boolean | undefined;

  constructor(options: {
    status: number;
    code: string;
    message: string;
    details?: unknown;
    recoverable?: boolean;
  }) {
    super(options.message);
    this.name = "ApiError";
    this.status = options.status;
    this.code = options.code;
    this.details = options.details;
    this.recoverable = options.recoverable;
  }
}
