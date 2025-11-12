const express = require("express");
const router = express.Router();
const cartController = require("../controllers/cart.controller");
const auth = require("../middlewares/auth");
const { validateBody } = require("../middlewares/validateBody");
const { addToCartSchema, updateCartItemSchema } = require("../validators/cart.validator");


router.get("/my-cart", auth(["customer"]), cartController.getCart);
router.post("/add-to-cart", auth(["customer"]), validateBody(addToCartSchema), cartController.addToCart);
router.put("/update-cart-item", auth(["customer"]), validateBody(updateCartItemSchema), cartController.updateCartItem);
router.delete("/remove-from-cart/:cartItemId", auth(["customer"]), cartController.removeFromCart);
router.delete("/clear-cart", auth(["customer"]), cartController.clearCart);

module.exports = router;
