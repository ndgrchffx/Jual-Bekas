import { Router } from "express";
import * as authController from "@/controllers/auth.controller";
import { authenticate } from "@/middlewares/auth.middleware";
import { validateBody } from "@/middlewares/validate.middleware";
import { authLimiter } from "@/middlewares/rateLimit.middleware";
import {
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema,
} from "@/validators/auth.validator";

const router = Router();

router.post("/register", authLimiter, validateBody(registerSchema), authController.registerHandler);
router.post("/login", authLimiter, validateBody(loginSchema), authController.loginHandler);
router.post("/refresh", authController.refreshHandler);
router.post("/logout", authController.logoutHandler);

router.post(
  "/forgot-password",
  authLimiter,
  validateBody(forgotPasswordSchema),
  authController.forgotPasswordHandler
);
router.post(
  "/reset-password",
  authLimiter,
  validateBody(resetPasswordSchema),
  authController.resetPasswordHandler
);

router.post(
  "/change-password",
  authenticate,
  validateBody(changePasswordSchema),
  authController.changePasswordHandler
);

router.get("/me", authenticate, authController.meHandler);

// Catatan: route Google OAuth (/auth/google, /auth/google/callback) akan
// ditambahkan saat integrasi Google OAuth dikerjakan — opsional sesuai
// requirement awal, butuh setup passport-google-oauth20 atau verifikasi
// id_token manual di sisi client (Next.js) lalu dikirim ke endpoint baru
// /auth/google/token.

export default router;
