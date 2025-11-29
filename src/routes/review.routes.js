const express = require("express");
const { validateBody } = require("../middlewares/validateBody");
const { createReviewSchema, updateReviewSchema } = require("../validators/review.validator");
const auth = require("../middlewares/auth");
const {
  listReviews,
  createReview,
  updateReview,
  deleteReview
} = require("../controllers/review.controller");

const router = express.Router();

// Public route - anyone can view reviews
router.get("/menu/:menuItemId", listReviews);

// Protected routes - require authentication (auth() without roles = all authenticated users)
router.post("/menu/:menuItemId/add", auth(), validateBody(createReviewSchema), createReview);
router.patch("/menu/:menuItemId/update", auth(), validateBody(updateReviewSchema), updateReview);
router.delete("/menu/:menuItemId", auth(), deleteReview);

module.exports = router;
