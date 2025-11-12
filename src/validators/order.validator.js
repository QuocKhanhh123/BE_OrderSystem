const { z } = require("zod");

// Helper để validate MongoDB ObjectId
const mongoIdString = z.string().regex(/^[0-9a-fA-F]{24}$/, "ID không hợp lệ");

// Schema cho địa chỉ giao hàng
const deliveryAddressSchema = z.object({
    street: z.string().min(1, "Địa chỉ đường không được để trống"),
    city: z.string().min(1, "Thành phố không được để trống"),
    district: z.string().optional(),
    ward: z.string().optional(),
    phone: z.string().min(10, "Số điện thoại phải có ít nhất 10 ký tự"),
    notes: z.string().optional()
});

// Tạo order nhanh từ 1 món
const createQuickOrderSchema = z.object({
    menuItemId: mongoIdString,
    quantity: z.preprocess(
        (val) => typeof val === 'string' ? parseInt(val, 10) : val,
        z.number().int().min(1, "Số lượng phải là số nguyên dương").default(1)
    ),
    deliveryAddress: deliveryAddressSchema.optional()
});

// Tạo order từ giỏ hàng
// const createOrderFromCartSchema = z.object({
//     notes: z.string().optional()
// });

// Hủy order
const cancelOrderSchema = z.object({
    cancelReason: z.string().min(1, "Lý do hủy không được để trống").optional()
});

// Update order status (admin)
const updateOrderStatusSchema = z.object({
    status: z.enum([
        "pending", 
        "confirmed", 
        "preparing", 
        "ready", 
        "delivering", 
        "completed", 
        "cancelled"
    ], {
        errorMap: () => ({ message: "Trạng thái đơn hàng không hợp lệ" })
    })
});

module.exports = {
    createQuickOrderSchema,
    cancelOrderSchema,
    updateOrderStatusSchema,
    deliveryAddressSchema
};
