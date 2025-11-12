const Cart = require("../models/Cart");
const MenuItem = require("../models/MenuItem");

// Lấy giỏ hàng của user
exports.getCart = async (req, res) => {
    try {
        const userId = req.user.id;

        let cart = await Cart.findOne({ user: userId }).populate("items.menuItem", "name price thumbnail isAvailable");

        if (!cart) {
            cart = await Cart.create({ user: userId, items: [] });
        }

        return res.status(200).json({
            success: true,
            message: "Lấy giỏ hàng thành công",
            data: cart
        });
    } catch (error) {
        console.error("Lỗi khi lấy giỏ hàng:", error);
        return res.status(500).json({
            success: false,
            message: "Lỗi máy chủ khi lấy giỏ hàng"
        });
    }
};

// Thêm món vào giỏ hàng
exports.addToCart = async (req, res) => {
    try {
        const userId = req.user.id;
        const { menuItemId, quantity, notes } = req.body;

        // Kiểm tra món ăn có tồn tại không
        const menuItem = await MenuItem.findById(menuItemId);
        if (!menuItem) {
            return res.status(404).json({
                success: false,
                message: "Không tìm thấy món ăn"
            });
        }

        // Kiểm tra món ăn còn bán không
        if (!menuItem.isAvailable) {
            return res.status(400).json({
                success: false,
                message: "Món ăn hiện không còn bán"
            });
        }

        // Tìm hoặc tạo giỏ hàng
        let cart = await Cart.findOne({ user: userId });
        if (!cart) {
            cart = new Cart({ user: userId, items: [] });
        }

        // Kiểm tra món đã có trong giỏ chưa (cùng món + cùng ghi chú)
        const existingItemIndex = cart.items.findIndex(
            item => item.menuItem.toString() === menuItemId && item.notes === (notes || "")
        );

        if (existingItemIndex > -1) {
            // Nếu đã có cùng món và cùng ghi chú, cập nhật số lượng
            cart.items[existingItemIndex].quantity += quantity;
            cart.items[existingItemIndex].price = menuItem.finalPrice;
        } else {
            // Nếu chưa có hoặc khác ghi chú, thêm mới
            cart.items.push({
                menuItem: menuItemId,
                name: menuItem.name,
                price: menuItem.finalPrice,
                thumbnail: menuItem.thumbnail,
                quantity: quantity,
                notes: notes || "",
                subtotal: menuItem.finalPrice * quantity
            });
        }

        await cart.save();

        // Populate lại để trả về đầy đủ thông tin
        await cart.populate("items.menuItem", "name price thumbnail isAvailable");

        return res.status(200).json({
            success: true,
            message: "Thêm vào giỏ hàng thành công",
            data: cart
        });
    } catch (error) {
        console.error("Lỗi khi thêm vào giỏ hàng:", error);
        return res.status(500).json({
            success: false,
            message: "Lỗi máy chủ khi thêm vào giỏ hàng"
        });
    }
};

// Cập nhật số lượng món trong giỏ
exports.updateCartItem = async (req, res) => {
    try {
        const userId = req.user.id;
        const { cartItemId, quantity, notes } = req.body;

        const cart = await Cart.findOne({ user: userId });
        if (!cart) {
            return res.status(404).json({
                success: false,
                message: "Không tìm thấy giỏ hàng"
            });
        }

        const item = cart.items.id(cartItemId);
        if (!item) {
            return res.status(404).json({
                success: false,
                message: "Không tìm thấy món trong giỏ hàng"
            });
        }

        // Cập nhật số lượng và ghi chú
        item.quantity = quantity;
        if (notes !== undefined) {
            item.notes = notes;
        }

        await cart.save();
        await cart.populate("items.menuItem", "name price thumbnail isAvailable");

        return res.status(200).json({
            success: true,
            message: "Cập nhật giỏ hàng thành công",
            data: cart
        });
    } catch (error) {
        console.error("Lỗi khi cập nhật giỏ hàng:", error);
        return res.status(500).json({
            success: false,
            message: "Lỗi máy chủ khi cập nhật giỏ hàng"
        });
    }
};

// Xóa món khỏi giỏ hàng
exports.removeFromCart = async (req, res) => {
    try {
        const userId = req.user.id;
        const { cartItemId } = req.params;

        const cart = await Cart.findOne({ user: userId });
        if (!cart) {
            return res.status(404).json({
                success: false,
                message: "Không tìm thấy giỏ hàng"
            });
        }

        // Xóa item khỏi giỏ hàng
        cart.items = cart.items.filter(item => item._id.toString() !== cartItemId);

        await cart.save();
        await cart.populate("items.menuItem", "name price thumbnail isAvailable");

        return res.status(200).json({
            success: true,
            message: "Xóa món khỏi giỏ hàng thành công",
            data: cart
        });
    } catch (error) {
        console.error("Lỗi khi xóa món khỏi giỏ hàng:", error);
        return res.status(500).json({
            success: false,
            message: "Lỗi máy chủ khi xóa món khỏi giỏ hàng"
        });
    }
};

// Xóa toàn bộ giỏ hàng
exports.clearCart = async (req, res) => {
    try {
        const userId = req.user.id;

        const cart = await Cart.findOne({ user: userId });
        if (!cart) {
            return res.status(404).json({
                success: false,
                message: "Không tìm thấy giỏ hàng"
            });
        }

        cart.items = [];
        await cart.save();

        return res.status(200).json({
            success: true,
            message: "Xóa toàn bộ giỏ hàng thành công",
            data: cart
        });
    } catch (error) {
        console.error("Lỗi khi xóa giỏ hàng:", error);
        return res.status(500).json({
            success: false,
            message: "Lỗi máy chủ khi xóa giỏ hàng"
        });
    }
};
