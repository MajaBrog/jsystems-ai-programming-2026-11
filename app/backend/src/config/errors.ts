import type { FastifyError, FastifyInstance } from 'fastify';

/** Error codes of the non-SSE error model (ADR-001 §4); NOT_FOUND covers unknown /api routes (ADR-005 TAC-005-04). */
export type ErrorCode =
  | 'VALIDATION_FAILED'
  | 'CASE_NOT_FOUND'
  | 'FILE_TOO_LARGE'
  | 'UNSUPPORTED_IMAGE'
  | 'REPLY_IN_PROGRESS'
  | 'INTERNAL_ERROR'
  | 'NOT_FOUND';

export type FieldError = { field: string; message: string };

export class ApiError extends Error {
  readonly status: number;
  readonly code: ErrorCode;
  readonly fieldErrors: FieldError[];

  constructor(status: number, code: ErrorCode, message: string, fieldErrors: FieldError[] = []) {
    super(message);
    this.status = status;
    this.code = code;
    this.fieldErrors = fieldErrors;
  }

  static validation(fieldErrors: FieldError[]): ApiError {
    return new ApiError(400, 'VALIDATION_FAILED', 'Popraw zaznaczone pola.', fieldErrors);
  }
  static caseNotFound(): ApiError {
    return new ApiError(404, 'CASE_NOT_FOUND', 'Nie znaleziono zgłoszenia.');
  }
  static fileTooLarge(): ApiError {
    return new ApiError(413, 'FILE_TOO_LARGE', 'Plik przekracza limit 10 MB.');
  }
  static unsupportedImage(): ApiError {
    return new ApiError(415, 'UNSUPPORTED_IMAGE', 'Dozwolone formaty: JPG, PNG, WEBP.');
  }
  static replyInProgress(): ApiError {
    return new ApiError(409, 'REPLY_IN_PROGRESS', 'Poczekaj na zakończenie odpowiedzi.');
  }
}

const INTERNAL_MESSAGE = 'Wystąpił nieoczekiwany błąd. Spróbuj ponownie.';

function body(code: ErrorCode, message: string, fieldErrors: FieldError[] = []) {
  return { code, message, fieldErrors };
}

/** Registers the JSON error handler and 404 handler. Never exposes internal error details. */
export function registerErrorHandling(app: FastifyInstance, opts: { spaFallback?: boolean } = {}): void {
  app.setErrorHandler((error: FastifyError | ApiError | Error, request, reply) => {
    if (error instanceof ApiError) {
      return reply.status(error.status).send(body(error.code, error.message, error.fieldErrors));
    }
    const code = (error as FastifyError).code;
    if (code === 'FST_REQ_FILE_TOO_LARGE' || code === 'FST_FILES_LIMIT' || code === 'FST_ERR_CTP_BODY_TOO_LARGE') {
      const e = ApiError.fileTooLarge();
      return reply.status(e.status).send(body(e.code, e.message));
    }
    const status = (error as FastifyError).statusCode;
    if (status !== undefined && status >= 400 && status < 500) {
      return reply.status(400).send(body('VALIDATION_FAILED', 'Nieprawidłowe żądanie.'));
    }
    request.log.error({ err: { name: error.name, code } }, 'unhandled error');
    return reply.status(500).send(body('INTERNAL_ERROR', INTERNAL_MESSAGE));
  });

  app.setNotFoundHandler((request, reply) => {
    const path = request.url.split('?')[0] ?? '/';
    const isClientRoute = request.method === 'GET' && !path.startsWith('/api/') && path !== '/api' && !/\.[a-z0-9]+$/i.test(path);
    if (opts.spaFallback && isClientRoute) {
      // Bundled mode: Angular client routes (e.g. /case/{id}) get index.html (ADR-001 SpaForwardingController).
      return reply.type('text/html; charset=utf-8').sendFile('index.html');
    }
    return reply.status(404).send(body('NOT_FOUND', 'Nie znaleziono zasobu.'));
  });
}
