const { z } = require("zod");

// Helper để validate MongoDB ObjectId
const mongoIdString = z.string().regex(/^[0-9a-fA-F]{24}$/, "ID không hợp lệ");

const addToCartSchema = z.object({
    menuItemId: mongoIdString.min(1, "ID món ăn không được để trống"),
    quantity: z.preprocess(
        (val) => typeof val === 'string' ? parseInt(val, 10) : val,
        z.number().int().min(1, "Số lượng phải là số nguyên dương lớn hơn 0")
    ),
    notes: z.string().optional().default("") // Ghi chú cho món
});

const updateCartItemSchema = z.object({
    cartItemId: mongoIdString.min(1, "ID món trong giỏ hàng không được để trống"),
    quantity: z.preprocess(
        (val) => typeof val === 'string' ? parseInt(val, 10) : val,
        z.number().int().min(1, "Số lượng phải là số nguyên dương lớn hơn 0")
    ),
    notes: z.string().optional() // Ghi chú cho món
});

module.exports = {
    addToCartSchema,
    updateCartItemSchema
};
