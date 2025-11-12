const express = require("express");
const router = express.Router();
const orderController = require("../controllers/order.controller");
const auth = require("../middlewares/auth");
const { validateBody } = require("../middlewares/validateBody");
const { 
    createQuickOrderSchema, 
    createOrderFromCartSchema, 
    cancelOrderSchema 
} = require("../validators/order.validator");

router.post("/from-cart", auth(["customer"]), orderController.createOrderFromCart);

router.get("/my-orders", auth(["customer"]), orderController.getMyOrders);

router.get("/detail/:orderId", auth(["customer"]), orderController.getOrderById);

router.delete("/cancel/:orderId", auth(["customer"]), orderController.cancelOrder);

module.exports = router;
