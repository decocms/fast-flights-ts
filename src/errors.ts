export class FlightError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FlightError";
  }
}

export class HttpError extends FlightError {
  readonly status: number;
  readonly responseLength: number;

  constructor(status: number, responseLength: number, message?: string) {
    super(message ?? `HTTP ${status} (response: ${responseLength} bytes)`);
    this.name = "HttpError";
    this.status = status;
    this.responseLength = responseLength;
  }
}

export class CaptchaError extends HttpError {
  constructor(responseLength: number) {
    super(200, responseLength, `Google returned a CAPTCHA page (${responseLength} bytes). Use a proxy or reduce request rate.`);
    this.name = "CaptchaError";
  }
}

export class ParseError extends FlightError {
  constructor(message: string) {
    super(message);
    this.name = "ParseError";
  }
}

export class TimeoutError extends FlightError {
  constructor(ms: number) {
    super(`Request timed out after ${ms}ms`);
    this.name = "TimeoutError";
  }
}
