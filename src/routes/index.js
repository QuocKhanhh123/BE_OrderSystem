const express = require("express");
const authRoutes = require("./auth");
const userRoutes = require("./users.routes");
const adminRoutes = require("./admin");
const menuItemRoutes = require("./menuItem.routes");
const reviewRoutes = require("./review.routes");
const cartRoutes = require("./cart.routes");
const paymentRoutes = require("./payment.routes");
const orderRoutes = require("./order.routes");

const router = express.Router();

router.use("/auth", authRoutes);
router.use("/users", userRoutes);
router.use("/admin", adminRoutes);
router.use("/menu-items", menuItemRoutes);
router.use("/reviews", reviewRoutes);
router.use("/cart", cartRoutes);
router.use("/payments", paymentRoutes);
router.use("/orders", orderRoutes);

module.exports = router;
