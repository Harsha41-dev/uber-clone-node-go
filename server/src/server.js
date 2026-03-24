require("dotenv").config();

const app = require("./app");
const { connectDb } = require("./config/db");

const port = process.env.PORT || 4000;

async function startServer() {
  await connectDb();

  app.listen(port, () => {
    console.log(`API running on port ${port}`);
  });
}

startServer();
