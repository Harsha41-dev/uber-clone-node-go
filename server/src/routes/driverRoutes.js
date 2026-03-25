const express = require("express");
const auth = require("../middlewares/auth");
const Driver = require("../models/Driver");
const memoryDb = require("../utils/memoryDb");
const { isDbConnected, mongoose } = require("../config/db");

const router = express.Router();

function checkDriverAccess(req, res) {
  if (req.user.role !== "driver") {
    res.status(403).json({ message: "Only drivers can use this route" });
    return false;
  }

  return true;
}

router.get("/me", auth, async (req, res) => {
  if (!checkDriverAccess(req, res)) {
    return;
  }

  let driver = null;

  if (isDbConnected()) {
    driver = await Driver.findOne({ userId: req.user.id }).lean();
  } else {
    driver = memoryDb.drivers.find(function(item) {
      return item.userId === req.user.id;
    });
  }

  if (!driver) {
    return res.status(404).json({ message: "Driver profile not found" });
  }

  res.json({ driver });
});

router.post("/onboard", auth, async (req, res) => {
  if (!checkDriverAccess(req, res)) {
    return;
  }

  const { name, phone, vehicleType, vehicleNumber } = req.body;

  if (!name || !phone || !vehicleType || !vehicleNumber) {
    return res.status(400).json({ message: "All driver fields are required" });
  }

  let driver = null;

  if (isDbConnected()) {
    driver = await Driver.findOne({ userId: req.user.id });

    if (!driver) {
      driver = await Driver.create({
        userId: req.user.id,
        name: name,
        phone: phone,
        vehicleType: vehicleType,
        vehicleNumber: vehicleNumber,
        isOnline: false
      });
    } else {
      driver.name = name;
      driver.phone = phone;
      driver.vehicleType = vehicleType;
      driver.vehicleNumber = vehicleNumber;
      await driver.save();
    }

    return res.json({
      driver: driver.toObject()
    });
  }

  driver = memoryDb.drivers.find(function(item) {
    return item.userId === req.user.id;
  });

  if (!driver) {
    driver = {
      _id: new mongoose.Types.ObjectId().toString(),
      userId: req.user.id,
      name: name,
      phone: phone,
      vehicleType: vehicleType,
      vehicleNumber: vehicleNumber,
      isOnline: false
    };

    memoryDb.drivers.push(driver);
  } else {
    driver.name = name;
    driver.phone = phone;
    driver.vehicleType = vehicleType;
    driver.vehicleNumber = vehicleNumber;
  }

  res.json({ driver });
});

router.patch("/me/status", auth, async (req, res) => {
  if (!checkDriverAccess(req, res)) {
    return;
  }

  const isOnline = !!req.body.isOnline;
  let driver = null;

  if (isDbConnected()) {
    driver = await Driver.findOne({ userId: req.user.id });

    if (!driver) {
      return res.status(404).json({ message: "Driver profile not found" });
    }

    driver.isOnline = isOnline;
    driver.lastSeenAt = new Date();
    await driver.save();

    return res.json({
      driver: driver.toObject()
    });
  }

  driver = memoryDb.drivers.find(function(item) {
    return item.userId === req.user.id;
  });

  if (!driver) {
    return res.status(404).json({ message: "Driver profile not found" });
  }

  driver.isOnline = isOnline;
  driver.lastSeenAt = new Date().toISOString();

  res.json({ driver });
});

module.exports = router;
