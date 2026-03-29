const mongoose = require("mongoose");

const driverSchema = new mongoose.Schema(
  {
    userId: String,
    name: String,
    phone: String,
    vehicleType: String,
    vehicleNumber: String,
    isOnline: {
      type: Boolean,
      default: false
    },
    lastSeenAt: Date
  },
  { timestamps: true }
);

module.exports = mongoose.models.Driver || mongoose.model("Driver", driverSchema);
