import type { Request, Response, NextFunction } from "express";
import type { ZodSchema } from "zod";
import { BadRequestError } from "@/utils/errors";

// Middleware generik untuk validasi request body menggunakan zod schema.
// Hasil parsing (termasuk transformasi seperti .trim(), .toLowerCase())
// ditulis kembali ke req.body agar controller menerima data yang sudah bersih.
export function validateBody(schema: ZodSchema) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      const fieldErrors = result.error.flatten().fieldErrors;
      return next(new BadRequestError("Validasi input gagal", fieldErrors));
    }

    req.body = result.data;
    next();
  };
}

export function validateQuery(schema: ZodSchema) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.query);

    if (!result.success) {
      const fieldErrors = result.error.flatten().fieldErrors;
      return next(new BadRequestError("Parameter query tidak valid", fieldErrors));
    }

    req.query = result.data as typeof req.query;
    next();
  };
}
