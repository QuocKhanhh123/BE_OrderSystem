const mongoose = require("mongoose");
const Review = require("../models/Review");
const MenuItem = require("../models/MenuItem");
const User = require("../models/User");
const Order = require("../models/Order");

async function recomputeMenuItemRating(menuItemId) {
  const agg = await Review.aggregate([
    { $match: { menuItemId: new mongoose.Types.ObjectId(menuItemId) } },
    { $group: { _id: "$menuItemId", avg: { $avg: "$rating" }, count: { $sum: 1 } } }
  ]);

  const avg = agg.length ? Number(agg[0].avg.toFixed(2)) : 0;
  const count = agg.length ? agg[0].count : 0;
  await MenuItem.findByIdAndUpdate(menuItemId, { $set: { rate: avg, rateCount: count } });
}

async function listReviews(req, res) {
  try {
    const { menuItemId } = req.params;
    if (!mongoose.isValidObjectId(menuItemId))
      return res.status(400).json({ message: "menuItemId không hợp lệ" });

    const reviews = await Review.find({ menuItemId })
      .populate("userId", "name email phone")
      .sort({ createdAt: -1 });

    res.json({ total: reviews.length, data: reviews });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
}

async function createReview(req, res) {
  try {
    const { menuItemId } = req.params;
    if (!mongoose.isValidObjectId(menuItemId))
      return res.status(400).json({ message: "menuItemId không hợp lệ" });

    // Get userId from authenticated user (req.user from middleware)
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ message: "Vui lòng đăng nhập" });
    }

    const { rating, comment, images } = req.body;

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User không tồn tại" });

    // Kiểm tra user đã mua món ăn này chưa
    const hasPurchased = await Order.findOne({
      user: userId,
      "items.dish": menuItemId,
      status: "completed"
    });

    if (!hasPurchased) {
      return res.status(403).json({ message: "Bạn cần mua món ăn này trước khi đánh giá" });
    }

    let review = await Review.findOne({ menuItemId, userId });
    if (review) {
      // Update existing review
      review.rating = rating;
      review.comment = comment;
      review.images = images || [];
      await review.save();
    } else {
      // Create new review
      review = await Review.create({ menuItemId, userId, rating, comment, images });
    }

    await recomputeMenuItemRating(menuItemId);

    // Populate user info before returning
    review = await Review.findById(review._id).populate("userId", "name email phone");

    res.status(201).json({ message: "Đánh giá thành công", data: review });
  } catch (err) {
    console.error(err);
    res.status(400).json({ message: err.message });
  }
}

async function updateReview(req, res) {
  try {
    const { menuItemId } = req.params;
    if (!mongoose.isValidObjectId(menuItemId))
      return res.status(400).json({ message: "menuItemId không hợp lệ" });

    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ message: "Vui lòng đăng nhập" });
    }

    const review = await Review.findOne({ menuItemId, userId });
    if (!review) return res.status(404).json({ message: "Không tìm thấy review" });

    // Update only allowed fields
    const { rating, comment, images } = req.body;
    if (rating !== undefined) review.rating = rating;
    if (comment !== undefined) review.comment = comment;
    if (images !== undefined) review.images = images;

    await review.save();
    await recomputeMenuItemRating(review.menuItemId);

    // Populate user info before returning
    const updatedReview = await Review.findById(review._id).populate("userId", "name email phone");

    res.json({ message: "Cập nhật review thành công", data: updatedReview });
  } catch (err) {
    console.error(err);
    res.status(400).json({ message: err.message });
  }
}

async function deleteReview(req, res) {
  try {
    const { menuItemId } = req.params;
    if (!mongoose.isValidObjectId(menuItemId))
      return res.status(400).json({ message: "menuItemId không hợp lệ" });

    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ message: "Vui lòng đăng nhập" });
    }

    const doc = await Review.findOneAndDelete({ menuItemId, userId });
    if (!doc) return res.status(404).json({ message: "Không tìm thấy review" });

    // Recompute rating after delete - use menuItemId from params to be safe
    await recomputeMenuItemRating(menuItemId);

    res.json({ message: "Đã xoá review", data: doc._id });
  } catch (err) {
    console.error("Error deleting review:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
}

module.exports = {
  listReviews,
  createReview,
  updateReview,
  deleteReview
};
