const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/payment.controller');
const auth = require('../middlewares/auth');
const { validateBody } = require('../middlewares/validateBody');
const { createZaloPaymentSchema } = require('../validators/payment.validator');

// Tạo thanh toán ZaloPay (user phải login)
router.post('/zalopay/create', auth(), validateBody(createZaloPaymentSchema), paymentController.createZaloPayment);

// Endpoint callback ZaloPay (ZaloPay gọi tới)
router.post('/zalopay/callback', express.json(), paymentController.zaloCallback);

// Query trạng thái đơn hàng ZaloPay (admin hoặc gọi nội bộ)
router.get('/zalopay/query/:app_trans_id', paymentController.queryZaloOrder);

// Lấy hóa đơn sau thanh toán
router.get('/invoice/:app_trans_id', paymentController.getInvoice);

module.exports = router;
