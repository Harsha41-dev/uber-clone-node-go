const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const memoryDb = require("../utils/memoryDb");
const { isDbConnected, mongoose } = require("../config/db");

const router = express.Router();

function getUserId(user) {
  if (user._id) {
    return user._id.toString();
  }

  return user.id;
}

function makeUserResponse(user) {
  return {
    id: getUserId(user),
    name: user.name,
    email: user.email,
    role: user.role
  };
}

router.post("/register", async (req, res) => {
  const { name, email, password, role } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ message: "name, email and password are required" });
  }

  let existingUser = null;

  if (isDbConnected()) {
    existingUser = await User.findOne({ email }).lean();
  } else {
    existingUser = memoryDb.users.find((item) => item.email === email);
  }

  if (existingUser) {
    return res.status(400).json({ message: "Email already exists" });
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  let user = null;

  if (isDbConnected()) {
    user = await User.create({
      name,
      email,
      password: hashedPassword,
      role: role || "rider"
    });
    user = user.toObject();
  } else {
    user = {
      _id: new mongoose.Types.ObjectId().toString(),
      name,
      email,
      password: hashedPassword,
      role: role || "rider"
    };
    memoryDb.users.push(user);
  }

  const safeUser = makeUserResponse(user);
  const token = jwt.sign(safeUser, process.env.JWT_SECRET || "uber_dev_secret", {
    expiresIn: "7d"
  });

  res.status(201).json({
    token,
    user: safeUser
  });
});

router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: "email and password are required" });
  }

  let user = null;

  if (isDbConnected()) {
    user = await User.findOne({ email }).lean();
  } else {
    user = memoryDb.users.find((item) => item.email === email);
  }

  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }

  const isMatch = await bcrypt.compare(password, user.password);

  if (!isMatch) {
    return res.status(400).json({ message: "Wrong password" });
  }

  const safeUser = makeUserResponse(user);
  const token = jwt.sign(safeUser, process.env.JWT_SECRET || "uber_dev_secret", {
    expiresIn: "7d"
  });

  res.json({
    token,
    user: safeUser
  });
});

module.exports = router;
