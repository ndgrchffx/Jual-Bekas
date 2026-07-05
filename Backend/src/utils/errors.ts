// Custom error classes.
// Dipakai di service layer agar controller/middleware bisa membedakan jenis
// error (400 vs 401 vs 404 vs 409) tanpa harus parsing message string.

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly details?: unknown;

  constructor(message: string, statusCode: number, details?: unknown) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    this.details = details;
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

export class BadRequestError extends AppError {
  constructor(message = "Permintaan tidak valid", details?: unknown) {
    super(message, 400, details);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Anda harus login untuk mengakses ini") {
    super(message, 401);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "Anda tidak memiliki akses untuk aksi ini") {
    super(message, 403);
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Data tidak ditemukan") {
    super(message, 404);
  }
}

export class ConflictError extends AppError {
  constructor(message = "Data sudah ada / konflik dengan data lain") {
    super(message, 409);
  }
}

export class TooManyRequestsError extends AppError {
  constructor(message = "Terlalu banyak permintaan, coba lagi nanti") {
    super(message, 429);
  }
}
