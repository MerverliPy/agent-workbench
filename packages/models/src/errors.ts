export class ProviderConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProviderConfigError";
  }
}

export class ProviderAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProviderAuthError";
  }
}

export class ProviderRateLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProviderRateLimitError";
  }
}

export class ProviderServerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProviderServerError";
  }
}

export class ProviderResponseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProviderResponseError";
  }
}
