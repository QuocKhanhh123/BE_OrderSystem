require("dotenv").config();
const express = require("express");
const { connectDB } = require("./config/db");
cors = require("cors");

const app = express();
app.use(express.json());

let corsOptions = {
   origin: '*',
}

app.use(cors("*"));

connectDB();

const routes = require("./routes");
app.use("/api", routes);

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
