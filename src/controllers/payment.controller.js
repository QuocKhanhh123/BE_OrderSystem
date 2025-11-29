const { config: zaloConfig, computeMac } = require("../utils/zalo");
const Order = require("../models/Order");
const Payment = require("../models/Payment");
const MenuItem = require("../models/MenuItem");
const https = require("https");

function generateAppTransId() {
    const dateStr = new Date().toISOString().slice(2,10).replace(/-/g, ''); // yyMMddzz
    const unique = Date.now();
    return `${dateStr}_order_${unique}`;
}

async function postJson(url, payload) {
    if (typeof fetch === 'function') {
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        return res.json();
    }

    return new Promise((resolve, reject) => {
        const u = new URL(url);
        const data = JSON.stringify(payload);
        const options = {
            hostname: u.hostname,
            port: u.port || 443,
            path: u.pathname + (u.search || ''),
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(data)
            }
        };

        const req = https.request(options, (res) => {
            let body = '';
            res.on('data', (chunk) => body += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(body));
                } catch (err) {
                    reject(err);
                }
            });
        });

        req.on('error', reject);
        req.write(data);
        req.end();
    });
}

// Tạo payment và gọi ZaloPay để lấy order_url
exports.createZaloPayment = async (req, res) => {
    try {
        const userId = req.user.id;
        const { orderId } = req.body;

        // Tìm order
        const order = await Order.findById(orderId);
        if (!order) return res.status(404).json({ success: false, message: 'Không tìm thấy đơn hàng' });

        // Tạo app_trans_id
        const app_trans_id = generateAppTransId();

        // Lưu Payment record (pending)
        const payment = await Payment.create({
            order: order._id,
            user: userId,
            amount: order.totalAmount || order.subtotal || 0,
            method: 'zalopay',
            status: 'pending',
            transactionId: app_trans_id
        });

        const app_user = `user_${userId}`;
        const app_time = Date.now();
        const embed_data = JSON.stringify({ 
            redirecturl:`${process.env.FRONTEND_URL}/order-status/${app_trans_id}`
        });

        const items = (order.items || []).map(it => ({ itemid: it.dish?.toString?.() || '', itemname: it.name, itemprice: it.price, itemquantity: it.quantity }));

        const zaloOrder = {
            app_id: zaloConfig.app_id,
            app_trans_id,
            app_user,
            app_time,
            embed_data,
            item: JSON.stringify(items),
            description: `Thanh toan don hang ${app_trans_id}`,
            amount: payment.amount,
            callback_url: `${ process.env.BASE_URL || ''}/api/payments/zalopay/callback`
        };

        const dataToSign = `${zaloOrder.app_id}|${zaloOrder.app_trans_id}|${zaloOrder.app_user}|${zaloOrder.amount}|${zaloOrder.app_time}|${zaloOrder.embed_data}|${zaloOrder.item}`;
        zaloOrder.mac = computeMac(dataToSign, zaloConfig.key1);

        const result = await postJson(zaloConfig.create_order_endpoint, zaloOrder);

        if (result && result.return_code === 1 && result.order_url) {
            return res.status(200).json({ success: true, message: 'Khởi tạo thanh toán ZaloPay thành công', order_url: result.order_url, payment });
        }

        payment.status = 'failed';
        payment.gatewayResponse = result;
        await payment.save();

        return res.status(400).json({ success: false, message: 'Khởi tạo thanh toán thất bại', error: result });
    } catch (error) {
        console.error('Lỗi createZaloPayment:', error);
        return res.status(500).json({ success: false, message: 'Lỗi máy chủ khi gọi ZaloPay' });
    }
};

// Endpoint callback từ ZaloPay
exports.zaloCallback = async (req, res) => {
    try {
        const body = req.body || req;
        // ZaloPay gửi dạng { data: '<json-string>', mac: '...' }
        const dataString = body.data || (body && body.data);
        const mac = body.mac;

        if (!dataString || !mac) {
            return res.status(400).json({ return_code: -1, return_message: 'Thiếu data hoặc mac' });
        }

        // Validate mac
        const expectedMac = computeMac(dataString, zaloConfig.key2);
        if (expectedMac !== mac) {
            console.warn('Callback MAC không hợp lệ');
            return res.status(400).json({ return_code: -1, return_message: 'mac not equal' });
        }

        const payload = JSON.parse(dataString);
        const app_trans_id = payload.app_trans_id;
        const return_code = payload.return_code; // thường 1 = success

        // Tìm payment
        const payment = await Payment.findOne({ transactionId: app_trans_id });
        if (!payment) {
            console.warn('Không tìm thấy payment cho app_trans_id', app_trans_id);
            return res.json({ return_code: 0, return_message: 'payment not found' });
        }

        // Cập nhật payment và order
        if (return_code === 1) {
            payment.status = 'success';
            payment.gatewayResponse = payload;
            payment.paidAt = new Date();
            await payment.save();

            // cập nhật order
            const order = await Order.findOne({ _id: payment.order });
            if (order) {
                order.paymentStatus = 'paid';
                order.status = 'confirmed';
                order.confirmedAt = new Date();
                await order.save();
            }

            return res.json({ return_code: 1, return_message: 'success' });
        } else {
            payment.status = 'failed';
            payment.gatewayResponse = payload;
            await payment.save();
            return res.json({ return_code: 2, return_message: 'failed' });
        }
    } catch (err) {
        console.error('Error in zaloCallback:', err);
        return res.json({ return_code: 0, return_message: 'error' });
    }
};

// Query order status tại ZaloPay
exports.queryZaloOrder = async (req, res) => {
    try {
        const { app_trans_id } = req.params;
        if (!app_trans_id) return res.status(400).json({ success: false, message: 'Thiếu app_trans_id' });

        const dataToSign = `${zaloConfig.app_id}|${app_trans_id}|${zaloConfig.key1}`;
        const mac = computeMac(dataToSign, zaloConfig.key1);

        const payload = { app_id: zaloConfig.app_id, app_trans_id, mac };
        const result = await postJson(zaloConfig.query_order_endpoint, payload);

        // nếu ZaloPay báo thanh toán thành công, cập nhật payment/order tương ứng
        if (result && result.return_code === 1) {
            const payment = await Payment.findOne({ transactionId: app_trans_id });
            if (payment && payment.status !== 'success') {
                payment.status = 'success';
                payment.gatewayResponse = result;
                payment.paidAt = new Date();
                await payment.save();

                const order = await Order.findById(payment.order);
                if (order) {
                    order.paymentStatus = 'paid';
                    order.status = 'confirmed';
                    order.confirmedAt = new Date();
                    await order.save();
                }
            }
        }

        return res.json(result);
    } catch (err) {
        console.error('Error queryZaloOrder:', err);
        return res.status(500).json({ success: false, message: 'Lỗi khi truy vấn ZaloPay' });
    }
};

// Lấy thông tin hóa đơn sau thanh toán
exports.getInvoice = async (req, res) => {
    try {
        const { app_trans_id } = req.params;
        
        // Tìm payment theo transactionId
        const payment = await Payment.findOne({ transactionId: app_trans_id })
            .populate({
                path: 'order',
                populate: {
                    path: 'items.dish',
                    select: 'name thumbnail'
                }
            })
            .populate('user', 'name email phone');

        if (!payment) {
            return res.status(404).json({ 
                success: false, 
                message: 'Không tìm thấy hóa đơn' 
            });
        }

        const order = payment.order;

        // Trả về thông tin hóa đơn
        return res.status(200).json({
            success: true,
            message: 'Lấy hóa đơn thành công',
            data: {
                invoice: {
                    transactionId: payment.transactionId,
                    orderId: order._id,
                    orderDate: order.createdAt,
                    paymentDate: payment.paidAt,
                    paymentMethod: payment.method,
                    paymentStatus: payment.status,
                    orderStatus: order.status,
                    items: order.items.map(item => ({
                        name: item.name,
                        thumbnail: item.dish?.thumbnail,
                        quantity: item.quantity,
                        price: item.price,
                        subtotal: item.subtotal
                    })),
                    subtotal: order.subtotal,
                    tax: order.tax,
                    deliveryFee: order.deliveryFee,
                    discount: order.discount,
                    totalAmount: order.totalAmount,
                    notes: order.notes,
                    customer: {
                        name: payment.user?.name,
                        email: payment.user?.email,
                        phone: payment.user?.phone
                    }
                }
            }
        });

    } catch (error) {
        console.error('Lỗi khi lấy hóa đơn:', error);
        return res.status(500).json({ 
            success: false, 
            message: 'Lỗi máy chủ khi lấy hóa đơn' 
        });
    }
};
