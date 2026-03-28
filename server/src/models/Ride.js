const mongoose = require("mongoose");

const rideSchema = new mongoose.Schema(
  {
    riderId: String,
    driverId: String,
    pickupText: String,
    dropText: String,
    pickupLat: Number,
    pickupLng: Number,
    dropLat: Number,
    dropLng: Number,
    distanceKm: Number,
    fare: Number,
    status: {
      type: String,
      default: "searching",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.models.Ride || mongoose.model("Ride", rideSchema);
