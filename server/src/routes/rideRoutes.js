const express = require("express");
const auth = require("../middlewares/auth");
const Driver = require("../models/Driver");
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

function isValidCoordinate(value) {
  if (value === undefined || value === null || value === "") {
    return false;
  }

  return !Number.isNaN(Number(value));
}

function checkDriverAccess(req, res) {
  if (req.user.role !== "driver") {
    res.status(403).json({ message: "Only drivers can use this route" });
    return false;
  }

  return true;
}

function checkRiderAccess(req, res) {
  if (req.user.role !== "rider") {
    res.status(403).json({ message: "Only riders can use this route" });
    return false;
  }

  return true;
}

function getDriverId(driver) {
  return String(driver._id || driver.id);
}

function canUpdateRideStatus(currentStatus, nextStatus) {
  if (nextStatus === "in_progress" && currentStatus === "driver_assigned") {
    return true;
  }

  if (nextStatus === "completed" && currentStatus === "in_progress") {
    return true;
  }

  return false;
}

function canCancelRide(currentStatus) {
  if (currentStatus === "searching" || currentStatus === "driver_assigned") {
    return true;
  }

  return false;
}

function buildAssignedDriverData(assignedDriver) {
  if (!assignedDriver) {
    return {
      driverId: null,
      driverName: "",
      driverVehicleType: "",
      status: "searching",
      acceptedAt: null
    };
  }

  return {
    driverId: assignedDriver.driverId,
    driverName: assignedDriver.name || "",
    driverVehicleType: assignedDriver.vehicleType || "",
    status: "driver_assigned",
    acceptedAt: new Date()
  };
}

async function findDriverByUserId(userId) {
  if (isDbConnected()) {
    return Driver.findOne({ userId: userId }).lean();
  }

  return memoryDb.drivers.find(function(item) {
    return item.userId === userId;
  });
}

async function findRiderRides(riderId) {
  if (isDbConnected()) {
    return Ride.find({ riderId: riderId }).sort({ createdAt: -1 }).lean();
  }

  return memoryDb.rides
    .filter(function(item) {
      return item.riderId === riderId;
    })
    .reverse();
}

async function findDriverRides(driverId) {
  if (isDbConnected()) {
    return Ride.find({ driverId: driverId }).sort({ createdAt: -1 }).lean();
  }

  return memoryDb.rides
    .filter(function(item) {
      return item.driverId === driverId;
    })
    .reverse();
}

async function findOpenRides() {
  if (isDbConnected()) {
    return Ride.find({ status: "searching" }).sort({ createdAt: -1 }).lean();
  }

  return memoryDb.rides
    .filter(function(item) {
      return item.status === "searching";
    })
    .reverse();
}

function isActiveRide(status) {
  return status === "searching" || status === "driver_assigned" || status === "in_progress";
}

function buildRiderStats(rides) {
  const stats = {
    totalRides: rides.length,
    activeRides: 0,
    completedRides: 0,
    cancelledRides: 0,
    spentAmount: 0
  };

  rides.forEach(function(ride) {
    if (isActiveRide(ride.status)) {
      stats.activeRides += 1;
    }

    if (ride.status === "completed") {
      stats.completedRides += 1;
    }

    if (ride.status === "cancelled") {
      stats.cancelledRides += 1;
    } else {
      stats.spentAmount += ride.fare || 0;
    }
  });

  return stats;
}

function buildDriverStats(rides, openRides) {
  const stats = {
    assignedRides: rides.length,
    activeRides: 0,
    completedRides: 0,
    openRides: openRides.length,
    earnedAmount: 0
  };

  rides.forEach(function(ride) {
    if (ride.status === "driver_assigned" || ride.status === "in_progress") {
      stats.activeRides += 1;
    }

    if (ride.status === "completed") {
      stats.completedRides += 1;
      stats.earnedAmount += ride.fare || 0;
    }
  });

  return stats;
}

router.post("/estimate", async (req, res) => {
  const { pickupLat, pickupLng, dropLat, dropLng } = req.body;

  if (
    !isValidCoordinate(pickupLat) ||
    !isValidCoordinate(pickupLng) ||
    !isValidCoordinate(dropLat) ||
    !isValidCoordinate(dropLng)
  ) {
    return res.status(400).json({ message: "Valid ride coordinates are required" });
  }

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
    !isValidCoordinate(pickupLat) ||
    !isValidCoordinate(pickupLng) ||
    !isValidCoordinate(dropLat) ||
    !isValidCoordinate(dropLng)
  ) {
    return res.status(400).json({ message: "Valid ride fields are required" });
  }

  const distanceKm = getDistanceKm(
    Number(pickupLat),
    Number(pickupLng),
    Number(dropLat),
    Number(dropLng)
  );

  const nearbyDrivers = await getNearbyDrivers(Number(pickupLat), Number(pickupLng));
  const assignedDriver = nearbyDrivers[0];
  const assignedDriverData = buildAssignedDriverData(assignedDriver);

  const rideData = {
    riderId: req.user.id,
    riderName: req.user.name || "",
    driverId: assignedDriverData.driverId,
    driverName: assignedDriverData.driverName,
    driverVehicleType: assignedDriverData.driverVehicleType,
    pickupText,
    dropText,
    pickupLat: Number(pickupLat),
    pickupLng: Number(pickupLng),
    dropLat: Number(dropLat),
    dropLng: Number(dropLng),
    distanceKm: Number(distanceKm.toFixed(2)),
    fare: getFare(distanceKm),
    status: assignedDriverData.status,
    acceptedAt: assignedDriverData.acceptedAt
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
  const rides = await findRiderRides(req.user.id);

  res.json({ rides });
});

router.get("/driver", auth, async (req, res) => {
  if (!checkDriverAccess(req, res)) {
    return;
  }

  const driver = await findDriverByUserId(req.user.id);

  if (!driver) {
    return res.status(404).json({ message: "Driver profile not found" });
  }

  const driverId = getDriverId(driver);
  const rides = await findDriverRides(driverId);

  res.json({ rides });
});

router.get("/open", auth, async (req, res) => {
  if (!checkDriverAccess(req, res)) {
    return;
  }

  const driver = await findDriverByUserId(req.user.id);

  if (!driver) {
    return res.status(404).json({ message: "Driver profile not found" });
  }

  const rides = await findOpenRides();

  res.json({ rides });
});

router.get("/stats/rider", auth, async (req, res) => {
  if (!checkRiderAccess(req, res)) {
    return;
  }

  const rides = await findRiderRides(req.user.id);
  const stats = buildRiderStats(rides);

  res.json({ stats });
});

router.get("/stats/driver", auth, async (req, res) => {
  if (!checkDriverAccess(req, res)) {
    return;
  }

  const driver = await findDriverByUserId(req.user.id);

  if (!driver) {
    return res.status(404).json({ message: "Driver profile not found" });
  }

  const driverId = getDriverId(driver);
  const rides = await findDriverRides(driverId);
  const openRides = await findOpenRides();
  const stats = buildDriverStats(rides, openRides);

  res.json({ stats });
});

router.patch("/:rideId/claim", auth, async (req, res) => {
  if (!checkDriverAccess(req, res)) {
    return;
  }

  const driver = await findDriverByUserId(req.user.id);

  if (!driver) {
    return res.status(404).json({ message: "Driver profile not found" });
  }

  if (!driver.isOnline) {
    return res.status(400).json({ message: "Go online first to accept rides" });
  }

  const driverId = getDriverId(driver);

  if (isDbConnected()) {
    const ride = await Ride.findById(req.params.rideId);

    if (!ride) {
      return res.status(404).json({ message: "Ride not found" });
    }

    if (ride.status !== "searching") {
      return res.status(400).json({ message: "Ride is no longer open" });
    }

    ride.driverId = driverId;
    ride.driverName = driver.name || "";
    ride.driverVehicleType = driver.vehicleType || "";
    ride.status = "driver_assigned";
    ride.acceptedAt = new Date();
    await ride.save();

    return res.json({
      ride: ride.toObject()
    });
  }

  const ride = memoryDb.rides.find(function(item) {
    const rideId = item._id || item.id;

    return rideId === req.params.rideId;
  });

  if (!ride) {
    return res.status(404).json({ message: "Ride not found" });
  }

  if (ride.status !== "searching") {
    return res.status(400).json({ message: "Ride is no longer open" });
  }

  ride.driverId = driverId;
  ride.driverName = driver.name || "";
  ride.driverVehicleType = driver.vehicleType || "";
  ride.status = "driver_assigned";
  ride.acceptedAt = new Date().toISOString();

  res.json({ ride });
});

router.patch("/:rideId/retry", auth, async (req, res) => {
  if (!checkRiderAccess(req, res)) {
    return;
  }

  if (isDbConnected()) {
    const ride = await Ride.findById(req.params.rideId);

    if (!ride || String(ride.riderId) !== req.user.id) {
      return res.status(404).json({ message: "Ride not found" });
    }

    if (ride.status !== "searching") {
      return res.status(400).json({ message: "Driver search is only for searching rides" });
    }

    const nearbyDrivers = await getNearbyDrivers(ride.pickupLat, ride.pickupLng);
    const assignedDriver = nearbyDrivers[0];

    if (!assignedDriver) {
      return res.json({
        ride: ride.toObject(),
        nearbyDrivers
      });
    }

    const assignedDriverData = buildAssignedDriverData(assignedDriver);

    ride.driverId = assignedDriverData.driverId;
    ride.driverName = assignedDriverData.driverName;
    ride.driverVehicleType = assignedDriverData.driverVehicleType;
    ride.status = assignedDriverData.status;
    ride.acceptedAt = assignedDriverData.acceptedAt;
    await ride.save();

    return res.json({
      ride: ride.toObject(),
      nearbyDrivers
    });
  }

  const ride = memoryDb.rides.find(function(item) {
    const rideId = item._id || item.id;

    return rideId === req.params.rideId && item.riderId === req.user.id;
  });

  if (!ride) {
    return res.status(404).json({ message: "Ride not found" });
  }

  if (ride.status !== "searching") {
    return res.status(400).json({ message: "Driver search is only for searching rides" });
  }

  const nearbyDrivers = await getNearbyDrivers(ride.pickupLat, ride.pickupLng);
  const assignedDriver = nearbyDrivers[0];

  if (!assignedDriver) {
    return res.json({ ride, nearbyDrivers });
  }

  const assignedDriverData = buildAssignedDriverData(assignedDriver);

  ride.driverId = assignedDriverData.driverId;
  ride.driverName = assignedDriverData.driverName;
  ride.driverVehicleType = assignedDriverData.driverVehicleType;
  ride.status = assignedDriverData.status;
  ride.acceptedAt = assignedDriverData.acceptedAt;

  res.json({ ride, nearbyDrivers });
});

router.patch("/:rideId/cancel", auth, async (req, res) => {
  if (!checkRiderAccess(req, res)) {
    return;
  }

  if (isDbConnected()) {
    const ride = await Ride.findById(req.params.rideId);

    if (!ride || String(ride.riderId) !== req.user.id) {
      return res.status(404).json({ message: "Ride not found" });
    }

    if (!canCancelRide(ride.status)) {
      return res.status(400).json({ message: "Ride cannot be cancelled now" });
    }

    ride.status = "cancelled";
    ride.cancelledAt = new Date();
    await ride.save();

    return res.json({
      ride: ride.toObject()
    });
  }

  const ride = memoryDb.rides.find(function(item) {
    const rideId = item._id || item.id;

    return rideId === req.params.rideId && item.riderId === req.user.id;
  });

  if (!ride) {
    return res.status(404).json({ message: "Ride not found" });
  }

  if (!canCancelRide(ride.status)) {
    return res.status(400).json({ message: "Ride cannot be cancelled now" });
  }

  ride.status = "cancelled";
  ride.cancelledAt = new Date().toISOString();

  res.json({ ride });
});

router.patch("/:rideId/status", auth, async (req, res) => {
  if (!checkDriverAccess(req, res)) {
    return;
  }

  const nextStatus = req.body.status;

  if (nextStatus !== "in_progress" && nextStatus !== "completed") {
    return res.status(400).json({ message: "Invalid ride status" });
  }

  const driver = await findDriverByUserId(req.user.id);

  if (!driver) {
    return res.status(404).json({ message: "Driver profile not found" });
  }

  const driverId = getDriverId(driver);

  if (isDbConnected()) {
    const ride = await Ride.findById(req.params.rideId);

    if (!ride || String(ride.driverId) !== driverId) {
      return res.status(404).json({ message: "Ride not found" });
    }

    if (!canUpdateRideStatus(ride.status, nextStatus)) {
      return res.status(400).json({ message: "Ride status update not allowed" });
    }

    ride.status = nextStatus;

    if (nextStatus === "in_progress") {
      ride.startedAt = new Date();
    }

    if (nextStatus === "completed") {
      ride.completedAt = new Date();
    }

    await ride.save();

    return res.json({
      ride: ride.toObject()
    });
  }

  const ride = memoryDb.rides.find(function(item) {
    const rideId = item._id || item.id;

    return rideId === req.params.rideId && item.driverId === driverId;
  });

  if (!ride) {
    return res.status(404).json({ message: "Ride not found" });
  }

  if (!canUpdateRideStatus(ride.status, nextStatus)) {
    return res.status(400).json({ message: "Ride status update not allowed" });
  }

  ride.status = nextStatus;

  if (nextStatus === "in_progress") {
    ride.startedAt = new Date().toISOString();
  }

  if (nextStatus === "completed") {
    ride.completedAt = new Date().toISOString();
  }

  res.json({ ride });
});

module.exports = router;
