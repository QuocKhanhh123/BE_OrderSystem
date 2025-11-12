const mongoose = require("mongoose");

const PaymentSchema = new mongoose.Schema({
    order: { type: mongoose.Schema.Types.ObjectId, ref: "Order", required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

    amount: { type: Number, required: true, min: 0 },

    method: {
        type: String,
        enum: ["cash", "card", "momo", "zalopay", "banking"],
        required: true
    },

    status: {
        type: String,
        enum: ["pending", "processing", "success", "failed", "refunded"],
        default: "pending"
    },

    transactionId: { type: String },

    gatewayResponse: { type: mongoose.Schema.Types.Mixed },

    paidAt: { type: Date },
    refundedAt: { type: Date },
    refundAmount: { type: Number, default: 0, min: 0 },
    refundReason: { type: String },

    notes: { type: String }
}, {
    timestamps: true
});

// Indexes
PaymentSchema.index({ order: 1 });
PaymentSchema.index({ user: 1, createdAt: -1 });
PaymentSchema.index({ status: 1 });
PaymentSchema.index({ transactionId: 1 });

const Payment = mongoose.model("Payment", PaymentSchema);
module.exports = Payment;
