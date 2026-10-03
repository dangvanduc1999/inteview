/** An error the API turns into a response with this status, code and optional details. */
export class HttpError extends Error {
  /** Set once a handler has logged this error, so the error middleware does not log it again. */
  logged = false;

  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

export const httpError = (status: number, code: string, message: string, details?: unknown) =>
  new HttpError(status, code, message, details);

export const badRequest = (message: string, details?: unknown) =>
  httpError(400, 'BAD_REQUEST', message, details);
export const unauthorized = (message = 'Unauthorized') => httpError(401, 'UNAUTHORIZED', message);
export const forbidden = (message = 'Forbidden') => httpError(403, 'FORBIDDEN', message);
export const notFound = (message = 'Not Found') => httpError(404, 'NOT_FOUND', message);
export const conflict = (message: string) => httpError(409, 'CONFLICT', message);
/** A bug on our side, such as a route missing the middleware its controller relies on. */
export const internal = (message: string) => httpError(500, 'INTERNAL', message);
