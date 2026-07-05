import { Router } from "express";
import authRoutes from "@/routes/auth.routes";
import chatRoutes from "@/routes/chat.routes";
import productRoutes from "@/routes/product.routes";
import marketplaceRoutes from "@/routes/marketplace.routes";

const router = Router();

router.use("/auth", authRoutes);
router.use("/chat", chatRoutes);
router.use("/products", productRoutes);
router.use("/marketplace", marketplaceRoutes);

// Modul berikutnya akan didaftarkan di sini secara bertahap:
// router.use("/users", userRoutes);
// router.use("/orders", orderRoutes);
// router.use("/payments", paymentRoutes);
// router.use("/escrow", escrowRoutes);
// router.use("/reviews", reviewRoutes);
// router.use("/admin", adminRoutes);

export default router;
