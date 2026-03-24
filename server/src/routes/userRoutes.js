const express = require("express");
const auth = require("../middlewares/auth");
const User = require("../models/User");
const memoryDb = require("../utils/memoryDb");
const { isDbConnected } = require("../config/db");

const router = express.Router();

router.get("/me", auth, async (req, res) => {
  let user = null;

  if (isDbConnected()) {
    user = await User.findById(req.user.id).lean();
  } else {
    user = memoryDb.users.find(function(item) {
      if (!item._id) {
        return false;
      }

      return item._id.toString() === req.user.id;
    });
  }

  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }

  let id = user.id;

  if (user._id) {
    id = user._id.toString();
  }

  res.json({
    user: {
      id: id,
      name: user.name,
      email: user.email,
      role: user.role
    }
  });
});

module.exports = router;
