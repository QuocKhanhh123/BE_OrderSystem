const mongoose = require("mongoose");
require("dotenv").config();
const Order = require("../models/Order");

async function checkPaymentStatus() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log("Connected to MongoDB");

        // Check all orders
        const allOrders = await Order.find({}).select("_id status paymentStatus paymentMethod totalAmount");

        console.log("\n===== ALL ORDERS =====");
        console.log("Total orders:", allOrders.length);

        // Group by paymentStatus
        const statusGroups = {};
        allOrders.forEach(order => {
            const key = `${order.status} - ${order.paymentStatus}`;
            if (!statusGroups[key]) {
                statusGroups[key] = [];
            }
            statusGroups[key].push(order);
        });

        console.log("\n===== ORDERS BY STATUS & PAYMENT =====");
        Object.keys(statusGroups).forEach(key => {
            console.log(`${key}: ${statusGroups[key].length} orders`);
        });

        // Count paid orders
        const paidOrders = await Order.countDocuments({ paymentStatus: "paid" });
        console.log("\n===== PAID ORDERS =====");
        console.log("Total paid orders:", paidOrders);

        // Show confirmed orders
        const confirmedOrders = await Order.find({ status: "confirmed" })
            .select("_id status paymentStatus paymentMethod totalAmount createdAt");

        console.log("\n===== CONFIRMED ORDERS =====");
        console.log("Total confirmed orders:", confirmedOrders.length);
        confirmedOrders.forEach(order => {
            console.log(`- ID: ${order._id}, Payment: ${order.paymentMethod}, Status: ${order.paymentStatus}, Amount: ${order.totalAmount}`);
        });

        await mongoose.disconnect();
        console.log("\nDisconnected from MongoDB");
    } catch (error) {
        console.error("Error:", error);
        process.exit(1);
    }
}

checkPaymentStatus();
