const mongoose = require("mongoose");

async function connectDb() {
  const mongoUrl = process.env.MONGO_URL;

  if (!mongoUrl) {
    console.log("MONGO_URL not found, using local memory data");
    return;
  }

  try {
    await mongoose.connect(mongoUrl);
    console.log("Mongo connected");
  } catch (error) {
    console.log("Mongo connection failed, using local memory data");
    console.log(error.message);
  }
}

function isDbConnected() {
  return mongoose.connection.readyState === 1;
}

module.exports = {
  connectDb,
  isDbConnected,
  mongoose,
};
