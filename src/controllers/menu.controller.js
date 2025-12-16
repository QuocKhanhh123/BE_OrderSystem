const mongoose = require("mongoose");
const MenuItem = require("../models/MenuItem");

async function listMenuItems(req, res) {
    try {
        const { category, type, available, activeDiscount, keyword } = req.query;
        const q = {};

        if (category) q.category = category;
        if (type) q.type = type;
        if (available === "true") q.isAvailable = true;
        if (available === "false") q.isAvailable = false;

        if (keyword) {
            q.$or = [
                { name: { $regex: keyword, $options: "i" } },
                { description: { $regex: keyword, $options: "i" } },
                { tags: { $elemMatch: { $regex: keyword, $options: "i" } } }
            ];
        }

        let items = await MenuItem.find(q).select("-embedding").sort({ createdAt: -1 });

        if (activeDiscount === "true") items = items.filter((it) => it.isDiscountActive);
        if (activeDiscount === "false") items = items.filter((it) => !it.isDiscountActive);

        res.json({ total: items.length, data: items });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server error" });
    }
}

async function getMenuItemById(req, res) {
    try {
        const { id } = req.params;
        if (!mongoose.isValidObjectId(id)) {
            return res.status(400).json({ message: "id không hợp lệ" });
        }
        const item = await MenuItem.findById(id).select("-embedding");
        if (!item) return res.status(404).json({ message: "Không tìm thấy món" });
        res.json(item);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server error" });
    }
}


async function createMenuItem(req, res) {
    try {
        const doc = new MenuItem(req.body);
        await doc.save();
        res.status(201).json({ message: "Tạo món thành công", data: doc });
    } catch (err) {
        console.error(err);
        res.status(400).json({ message: err.message });
    }
}
async function updateMenuItem(req, res) {
    try {
        const { id } = req.params;
        if (!mongoose.isValidObjectId(id)) {
            return res.status(400).json({ message: "id không hợp lệ" });
        }

        const updated = await MenuItem.findByIdAndUpdate(
            id,
            { $set: req.body },
            { new: true, runValidators: true, select: "-embedding" }
        );
        if (!updated) return res.status(404).json({ message: "Không tìm thấy món" });

        res.json({ message: "Cập nhật thành công", data: updated });
    } catch (err) {
        console.error(err);
        res.status(400).json({ message: err.message });
    }
}

async function deleteMenuItem(req, res) {
    try {
        const { id } = req.params;
        if (!mongoose.isValidObjectId(id)) {
            return res.status(400).json({ message: "id không hợp lệ" });
        }

        const deleted = await MenuItem.findByIdAndDelete(id);
        if (!deleted) return res.status(404).json({ message: "Không tìm thấy món" });

        res.json({ message: "Đã xóa món", data: deleted._id });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server error" });
    }
}

module.exports = {
    listMenuItems,
    getMenuItemById,
    createMenuItem,
    updateMenuItem,
    deleteMenuItem
};