const express = require("express");
const router = express.Router();
const chatbotController = require("../controllers/chatbot.controller");

router.post("/send", chatbotController.sendMessage);
router.post("/clear", chatbotController.clearSession);
router.post("/chat", chatbotController.chat);
router.post("/update-embedding", chatbotController.updateEmbedding);
router.post("/update-all-embeddings", chatbotController.updateAllEmbeddings);

module.exports = router;
