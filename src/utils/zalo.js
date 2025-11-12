const crypto = require("crypto");

const config = {
    app_id: process.env.ZALO_APP_ID ? Number(process.env.ZALO_APP_ID) : 554,
    key1: "8NdU5pG5R2spGHGhyO99HN1OhD8IQJBn",
    key2: "uUfsWgfLkRLzq6W2uNXTCxrfxs51auny",
    create_order_endpoint: "https://sb-openapi.zalopay.vn/v2/create",
    query_order_endpoint: "https://sb-openapi.zalopay.vn/v2/query",
    // base_url dùng để redirect/callback, override bằng env nếu cần
    base_url: process.env.ZALO_BASE_URL || null
};

function computeMac(data, key) {
    return crypto.createHmac("sha256", key).update(data).digest("hex");
}

module.exports = { config, computeMac };
