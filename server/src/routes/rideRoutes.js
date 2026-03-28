const express = require("express");
const auth = require("../middlewares/auth");
const Ride = require("../models/Ride");
const memoryDb = require("../utils/memoryDb");
const { isDbConnected, mongoose } = require("../config/db");
const { getNearbyDrivers } = require("../services/realtimeService");

const router = express.Router();

function toRad(value) {
  return (value * Math.PI) / 180;
}

function getDistanceKm(lat1, lng1, lat2, lng2) {
  const earthRadius = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadius * c;
}

function getFare(distanceKm) {
  return Math.round(50 + distanceKm * 18);
}

router.post("/estimate", async (req, res) => {
  const { pickupLat, pickupLng, dropLat, dropLng } = req.body;

  const distanceKm = getDistanceKm(
    Number(pickupLat),
    Number(pickupLng),
    Number(dropLat),
    Number(dropLng)
  );

  res.json({
    distanceKm: Number(distanceKm.toFixed(2)),
    fare: getFare(distanceKm),
  });
});

router.post("/", auth, async (req, res) => {
  const {
    pickupText,
    dropText,
    pickupLat,
    pickupLng,
    dropLat,
    dropLng,
  } = req.body;

  if (
    !pickupText ||
    !dropText ||
    pickupLat === undefined ||
    pickupLng === undefined ||
    dropLat === undefined ||
    dropLng === undefined
  ) {
    return res.status(400).json({ message: "Ride fields are missing" });
  }

  const distanceKm = getDistanceKm(
    Number(pickupLat),
    Number(pickupLng),
    Number(dropLat),
    Number(dropLng)
  );

  const nearbyDrivers = await getNearbyDrivers(Number(pickupLat), Number(pickupLng));
  const assignedDriver = nearbyDrivers[0];

  const rideData = {
    riderId: req.user.id,
    driverId: assignedDriver ? assignedDriver.driverId : null,
    pickupText,
    dropText,
    pickupLat: Number(pickupLat),
    pickupLng: Number(pickupLng),
    dropLat: Number(dropLat),
    dropLng: Number(dropLng),
    distanceKm: Number(distanceKm.toFixed(2)),
    fare: getFare(distanceKm),
    status: assignedDriver ? "driver_assigned" : "searching",
  };

  let ride = null;

  if (isDbConnected()) {
    ride = await Ride.create(rideData);
    ride = ride.toObject();
  } else {
    ride = {
      _id: new mongoose.Types.ObjectId().toString(),
      ...rideData,
      createdAt: new Date().toISOString(),
    };
    memoryDb.rides.push(ride);
  }

  res.status(201).json({
    ride,
    nearbyDrivers,
  });
});

router.get("/", auth, async (req, res) => {
  let rides = [];

  if (isDbConnected()) {
    rides = await Ride.find({ riderId: req.user.id }).sort({ createdAt: -1 }).lean();
  } else {
    rides = memoryDb.rides
      .filter((item) => item.riderId === req.user.id)
      .reverse();
  }

  res.json({ rides });
});

module.exports = router;
