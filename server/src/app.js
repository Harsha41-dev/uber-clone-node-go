require("dotenv").config();

const express = require("express");
const cors = require("cors");
const authRoutes = require("./routes/authRoutes");
const driverRoutes = require("./routes/driverRoutes");
const userRoutes = require("./routes/userRoutes");

const app = express();

app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:5173"
  })
);
app.use(express.json());

app.get("/api/health", (req, res) => {
  res.json({
    service: "uber-api",
    ok: true
  });
});

app.use("/api/auth", authRoutes);
app.use("/api/drivers", driverRoutes);
app.use("/api/users", userRoutes);

module.exports = app;
