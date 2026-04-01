const mongoose = require("mongoose");

const rideSchema = new mongoose.Schema(
  {
    riderId: String,
    riderName: String,
    driverId: String,
    driverName: String,
    driverVehicleType: String,
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
    acceptedAt: Date,
    startedAt: Date,
    completedAt: Date,
    cancelledAt: Date,
  },
  { timestamps: true }
);

module.exports = mongoose.models.Ride || mongoose.model("Ride", rideSchema);
