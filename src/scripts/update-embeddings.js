require("dotenv").config();
const mongoose = require("mongoose");
const OpenAI = require("openai");

const MONGODB_URI = process.env.MONGO_URI;

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const MenuItemSchema = new mongoose.Schema({
    name: String,
    description: String,
    category: String,
    type: String,
    ingredients: [String],
    tags: [String],
    price: Number,
    embedding: [Number]
}, { collection: "menuitems" });

const MenuItem = mongoose.model("MenuItem", MenuItemSchema);

async function updateAllEmbeddings() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log("✅ Đã kết nối MongoDB");

    const items = await MenuItem.find({});
    console.log(`📊 Tìm thấy ${items.length} món ăn`);

    let updated = 0;
    let failed = 0;

    for (const item of items) {
      try {
        const ingredients = item.ingredients?.join(", ") || "";
        const tags = item.tags?.join(", ") || "";
        const textToEmbed = `${item.name}. ${item.description}. Loại: ${item.category}. ${item.type || ""}. ${ingredients ? `Thành phần: ${ingredients}.` : ""} ${tags ? `Tags: ${tags}.` : ""}`.trim();
        
        const response = await openai.embeddings.create({
          model: "text-embedding-3-small",
          input: textToEmbed
        });

        await MenuItem.updateOne(
          { _id: item._id },
          { $set: { embedding: response.data[0].embedding } }
        );

        updated++;
        console.log(`✅ [${updated}/${items.length}] ${item.name}`);
      } catch (error) {
        failed++;
        console.error(`❌ Lỗi ${item.name}:`, error.message);
      }
    }

    console.log(`\n✅ Hoàn thành! Updated: ${updated}, Failed: ${failed}`);
    process.exit(0);
  } catch (error) {
    console.error("❌ Lỗi:", error);
    process.exit(1);
  }
}

updateAllEmbeddings();
