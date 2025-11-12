const express = require("express");
const router = express.Router();
const auth = require("../middlewares/auth");
const adminController = require("../controllers/adminController");

// User management
router.get("/users", auth(["admin"]), adminController.getAllUsers);
router.post("/users/detail", auth(["admin"]), adminController.getUserById);
router.post("/users/orders", auth(["admin"]), adminController.getUserOrders);
router.put("/users/status", auth(["admin"]), adminController.updateUserStatus);
router.put("/users/roles", auth(["admin"]), adminController.updateUserRoles);

// Orders overview
router.get("/orders", auth(["admin"]), adminController.getAllOrders);

// Reports and statistics
router.get("/reports/revenue", auth(["admin"]), adminController.getRevenueReports);
router.get("/reports/orders", auth(["admin"]), adminController.getOrderStatistics);
router.get("/dashboard", auth(["admin"]), adminController.getDashboardOverview);

module.exports = router;
