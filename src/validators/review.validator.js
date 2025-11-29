const { z } = require("zod");

const createReviewSchema = z.object({
  // userId không cần nữa vì lấy từ req.user (token)
  rating: z.number().min(0, "Rating tối thiểu là 0").max(5, "Rating tối đa là 5"),
  comment: z.string().min(1, "Vui lòng nhập nhận xét").max(1000, "Nhận xét tối đa 1000 ký tự"),
  images: z.array(z.string()).optional().default([])
});

const updateReviewSchema = z.object({
  rating: z.number().min(0, "Rating tối thiểu là 0").max(5, "Rating tối đa là 5").optional(),
  comment: z.string().min(1, "Vui lòng nhập nhận xét").max(1000, "Nhận xét tối đa 1000 ký tự").optional(),
  images: z.array(z.string()).optional()
});

module.exports = {
  createReviewSchema,
  updateReviewSchema
};
