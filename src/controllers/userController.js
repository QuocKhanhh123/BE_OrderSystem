const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");
const User = require("../models/User");
const Order = require("../models/Order");
const UserPreference = require("../models/UserPreference");

exports.getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password");
    const preferences = await UserPreference.findOne({ user: req.user.id })
      .populate("favoriteDishes", "name image price");

    res.json({ 
      success: true, 
      data: { user, preferences } 
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateProfile = async (req, res) => {
  try {
    const { name, phone } = req.body;
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({ success: false, message: "Người dùng không tồn tại" });
    }

    if (phone && phone !== user.phone) {
      const phoneExists = await User.findOne({
        phone,
        _id: { $ne: req.user.id }
      });
      if (phoneExists) {
        return res.status(400).json({
          success: false,
          message: "Số điện thoại đã được sử dụng"
        });
      }
      user.phone = phone;
    }

    if (name) {
      user.name = name;
    }

    await user.save();

    const { password, ...safeUser } = user.toObject();

    res.json({
      success: true,
      data: safeUser
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({ success: false, message: "Người dùng không tồn tại" });
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({
        success: false,
        message: "Mật khẩu hiện tại không đúng"
      });
    }

    if (currentPassword === newPassword) {
      return res.status(400).json({
        success: false,
        message: "Mật khẩu mới phải khác mật khẩu hiện tại"
      });
    }

    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();

    res.json({
      success: true,
      message: "Đổi mật khẩu thành công"
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

exports.getAccountStats = async (req, res) => {
  try {
    const userId = new mongoose.Types.ObjectId(req.user.id);

    const [totalOrders, completedOrdersAgg, spendingAgg] = await Promise.all([
      Order.countDocuments({ user: userId }),
      Order.countDocuments({ user: userId, status: "completed" }),
      Order.aggregate([
        {
          $match: {
            user: userId,
            status: { $nin: ["cancelled"] }
          }
        },
        {
          $group: {
            _id: null,
            totalAmount: { $sum: "$totalAmount" }
          }
        }
      ])
    ]);

    const totalSpent = spendingAgg.length > 0 ? spendingAgg[0].totalAmount : 0;

    res.json({
      success: true,
      data: {
        totalOrders,
        completedOrders: completedOrdersAgg,
        totalSpent
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get user preferences
exports.getPreferences = async (req, res) => {
  try {
    let preferences = await UserPreference.findOne({ user: req.user.id })
      .populate("favoriteDishes", "name image price category");

    if (!preferences) {
      preferences = new UserPreference({ user: req.user.id });
      await preferences.save();
    }

    res.json({ success: true, data: preferences });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Update user preferences
exports.updatePreferences = async (req, res) => {
  try {
    let preferences = await UserPreference.findOne({ user: req.user.id });

    if (!preferences) {
      preferences = new UserPreference({ user: req.user.id, ...req.body });
    } else {
      Object.assign(preferences, req.body);
    }

    await preferences.save();

    res.json({ 
      success: true, 
      data: await UserPreference.findById(preferences._id)
        .populate("favoriteDishes", "name image price")
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// Add favorite dish
exports.addFavoriteDish = async (req, res) => {
  try {
    const { dishId } = req.body;
    let preferences = await UserPreference.findOne({ user: req.user.id });

    if (!preferences) {
      preferences = new UserPreference({ user: req.user.id });
    }

    if (!preferences.favoriteDishes.includes(dishId)) {
      preferences.favoriteDishes.push(dishId);
      await preferences.save();
    }

    res.json({ 
      success: true, 
      data: await UserPreference.findById(preferences._id)
        .populate("favoriteDishes", "name image price")
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// Remove favorite dish
exports.removeFavoriteDish = async (req, res) => {
  try {
    const { dishId } = req.params;
    const preferences = await UserPreference.findOne({ user: req.user.id });

    if (preferences) {
      preferences.favoriteDishes = preferences.favoriteDishes.filter(
        id => id.toString() !== dishId
      );
      await preferences.save();
    }

    res.json({ success: true, message: "Removed from favorites" });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// Add delivery address
exports.addDeliveryAddress = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    
    if (!user.deliveryAddresses) {
      user.deliveryAddresses = [];
    }

    user.deliveryAddresses.push(req.body);
    await user.save();

    res.json({ 
      success: true, 
      data: await User.findById(req.user.id).select("-password")
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// Update delivery address
exports.updateDeliveryAddress = async (req, res) => {
  try {
    const { addressId } = req.params;
    const user = await User.findById(req.user.id);

    if (!user.deliveryAddresses) {
      return res.status(404).json({ success: false, message: "Address not found" });
    }

    const addressIndex = user.deliveryAddresses.findIndex(
      addr => addr._id.toString() === addressId
    );

    if (addressIndex === -1) {
      return res.status(404).json({ success: false, message: "Address not found" });
    }

    Object.assign(user.deliveryAddresses[addressIndex], req.body);
    await user.save();

    res.json({ 
      success: true, 
      data: await User.findById(req.user.id).select("-password")
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// Delete delivery address
exports.deleteDeliveryAddress = async (req, res) => {
  try {
    const { addressId } = req.params;
    const user = await User.findById(req.user.id);

    if (!user.deliveryAddresses) {
      return res.status(404).json({ success: false, message: "Address not found" });
    }

    user.deliveryAddresses = user.deliveryAddresses.filter(
      addr => addr._id.toString() !== addressId
    );
    await user.save();

    res.json({ success: true, message: "Address deleted successfully" });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// Set default delivery address
exports.setDefaultAddress = async (req, res) => {
  try {
    const { addressId } = req.params;
    const user = await User.findById(req.user.id);

    if (!user.deliveryAddresses) {
      return res.status(404).json({ success: false, message: "Address not found" });
    }

    user.deliveryAddresses.forEach(addr => {
      addr.isDefault = addr._id.toString() === addressId;
    });
    await user.save();

    res.json({ 
      success: true, 
      data: await User.findById(req.user.id).select("-password")
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};
