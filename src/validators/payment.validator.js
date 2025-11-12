const { z } = require("zod");

// Helper để validate MongoDB ObjectId
const mongoIdString = z.string().regex(/^[0-9a-fA-F]{24}$/, "ID không hợp lệ");

// Tạo payment ZaloPay
const createZaloPaymentSchema = z.object({
    orderId: mongoIdString
});

// Callback từ ZaloPay
const zaloCallbackSchema = z.object({
    data: z.string().min(1, "Dữ liệu callback không được để trống"),
    mac: z.string().min(1, "MAC không được để trống")
});

// Tạo payment generic
const createPaymentSchema = z.object({
    orderId: mongoIdString,
    method: z.enum(["cash", "card", "momo", "zalopay", "banking"], {
        errorMap: () => ({ message: "Phương thức thanh toán không hợp lệ" })
    }),
    amount: z.number().min(0, "Số tiền phải lớn hơn hoặc bằng 0").optional()
});

// Refund payment (admin)
const refundPaymentSchema = z.object({
    refundAmount: z.number().min(0, "Số tiền hoàn phải lớn hơn hoặc bằng 0"),
    refundReason: z.string().min(1, "Lý do hoàn tiền không được để trống")
});

module.exports = {
    createZaloPaymentSchema,
    zaloCallbackSchema,
    createPaymentSchema,
    refundPaymentSchema
};
