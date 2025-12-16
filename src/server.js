require("dotenv").config();
const express = require("express");
const { connectDB } = require("./config/db");
const cors = require("cors");
const { setupVectorIndex } = require("./services/openai.service");

const app = express();
app.use(express.json());
app.use(cors("*"));

app.get("/health", (req, res) => {
  res.json({ 
    status: "OK", 
    timestamp: new Date().toISOString(),
    openai: !!process.env.OPENAI_API_KEY
  });
});

const routes = require("./routes");
app.use("/api", routes);

app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ 
    error: "Internal server error",
    message: process.env.NODE_ENV === "development" ? err.message : undefined
  });
});

const PORT = process.env.PORT || 4000;

async function startServer() {
  try {
    await connectDB();
    console.log("✅ Đã kết nối MongoDB");

    await setupVectorIndex();

    app.listen(PORT, () => {
      console.log(`🚀 Server đang chạy tại http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("❌ Lỗi khi khởi động server:", error);
    process.exit(1);
  }
}

startServer();
