const OpenAI = require("openai");
const MenuItem = require("../models/MenuItem");

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

async function setupVectorIndex() {
  const mongoose = require("mongoose");
  const db = mongoose.connection.db;
  const collection = db.collection("menuitems");

  const indexes = await collection.listSearchIndexes().toArray();
  const vectorIndexExists = indexes.some(idx => idx.name === "vector_index");

  if (vectorIndexExists) {
    console.log("✅ Vector index 'vector_index' đã tồn tại");
    return;
  }

  console.log("🔄 Đang tạo vector index...");
  await collection.createSearchIndex({
    name: "vector_index",
    type: "vectorSearch",
    definition: {
      fields: [
        {
          type: "vector",
          path: "embedding",
          numDimensions: 1536,
          similarity: "cosine"
        },
        {
          type: "filter",
          path: "isAvailable"
        }
      ]
    }
  });

  console.log("✅ Vector index 'vector_index' đã được tạo thành công");
}

async function createEmbedding(text) {
  const response = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: text
  });
  return response.data[0].embedding;
}

async function filterMenuByNutrition(filters) {
  const query = { isAvailable: true };
  const conditions = [];

  if (filters.maxCalories) {
    conditions.push({
      "nutritionalInformation": {
        $elemMatch: {
          name: "Calories",
          value: { $lte: filters.maxCalories }
        }
      }
    });
  }

  if (filters.minProtein) {
    conditions.push({
      "nutritionalInformation": {
        $elemMatch: {
          name: "Protein",
          value: { $gte: filters.minProtein }
        }
      }
    });
  }

  if (filters.maxPrice) {
    query.price = { $lte: filters.maxPrice };
  }

  if (filters.category) {
    query.category = { $regex: filters.category, $options: "i" };
  }

  if (conditions.length > 0) {
    query.$and = conditions;
  }

  const results = await MenuItem.find(query)
    .select("-embedding")
    .limit(15);

  const now = new Date();
  return results.map(item => {
    const hasDiscount = item.discountPrice != null && item.discountPrice >= 0;
    const inDiscountWindow = 
      (!item.discountStartAt || item.discountStartAt <= now) &&
      (!item.discountEndAt || item.discountEndAt >= now);
    
    const isDiscountActive = hasDiscount && inDiscountWindow;
    const finalPrice = isDiscountActive ? item.discountPrice : item.price;

    const nutrition = {};
    if (item.nutritionalInformation && item.nutritionalInformation.length > 0) {
      item.nutritionalInformation.forEach(n => {
        nutrition[n.name] = { value: n.value, unit: n.unit };
      });
    }

    return {
      id: item._id.toString(),
      name: item.name,
      description: item.description,
      category: item.category,
      price: item.price,
      discountPrice: isDiscountActive ? item.discountPrice : null,
      currentPrice: finalPrice,
      thumbnail: item.thumbnail,
      isAvailable: item.isAvailable,
      hasDiscount: isDiscountActive,
      ingredients: item.ingredients || [],
      nutrition: nutrition
    };
  });
}

async function searchMenuByVector(query) {
  const queryEmbedding = await createEmbedding(query);

  const results = await MenuItem.aggregate([
    {
      $vectorSearch: {
        index: "vector_index",
        path: "embedding",
        queryVector: queryEmbedding,
        numCandidates: 100,
        limit: 10,
        filter: { isAvailable: true }
      }
    },
    {
      $project: {
        _id: 1,
        name: 1,
        description: 1,
        category: 1,
        price: 1,
        discountPrice: 1,
        discountStartAt: 1,
        discountEndAt: 1,
        isAvailable: 1,
        thumbnail: 1,
        ingredients: 1,
        nutritionalInformation: 1,
        score: { $meta: "vectorSearchScore" }
      }
    }
  ]);

  const now = new Date();
  return results.map(item => {
    const hasDiscount = item.discountPrice != null && item.discountPrice >= 0;
    const inDiscountWindow = 
      (!item.discountStartAt || item.discountStartAt <= now) &&
      (!item.discountEndAt || item.discountEndAt >= now);
    
    const isDiscountActive = hasDiscount && inDiscountWindow;
    const finalPrice = isDiscountActive ? item.discountPrice : item.price;

    const nutrition = {};
    if (item.nutritionalInformation && item.nutritionalInformation.length > 0) {
      item.nutritionalInformation.forEach(n => {
        nutrition[n.name] = { value: n.value, unit: n.unit };
      });
    }

    return {
      id: item._id.toString(),
      name: item.name,
      description: item.description,
      category: item.category,
      price: item.price,
      discountPrice: isDiscountActive ? item.discountPrice : null,
      currentPrice: finalPrice,
      thumbnail: item.thumbnail,
      isAvailable: item.isAvailable,
      hasDiscount: isDiscountActive,
      ingredients: item.ingredients || [],
      nutrition: nutrition
    };
  });
}

async function chatCompletion(messages, tools) {
  return await openai.chat.completions.create({
    model: "gpt-4o",
    messages: messages,
    tools: tools,
    tool_choice: "auto"
  });
}

async function updateMenuItemEmbedding(menuItemId) {
  const menuItem = await MenuItem.findById(menuItemId);
  if (!menuItem) {
    throw new Error("Không tìm thấy món ăn");
  }

  const ingredients = menuItem.ingredients?.join(", ") || "";
  const tags = menuItem.tags?.join(", ") || "";
  const textToEmbed = `${menuItem.name}. ${menuItem.description}. Loại: ${menuItem.category}. ${menuItem.type || ""}. ${ingredients ? `Thành phần: ${ingredients}.` : ""} ${tags ? `Tags: ${tags}.` : ""}`.trim();
  
  const embedding = await createEmbedding(textToEmbed);

  menuItem.embedding = embedding;
  await menuItem.save();

  return menuItem;
}

async function updateAllEmbeddings() {
  const menuItems = await MenuItem.find({});
  let updated = 0;
  let failed = 0;

  for (const item of menuItems) {
    try {
      const ingredients = item.ingredients?.join(", ") || "";
      const tags = item.tags?.join(", ") || "";
      const textToEmbed = `${item.name}. ${item.description}. Loại: ${item.category}. ${item.type || ""}. ${ingredients ? `Thành phần: ${ingredients}.` : ""} ${tags ? `Tags: ${tags}.` : ""}`.trim();
      
      const embedding = await createEmbedding(textToEmbed);
      
      item.embedding = embedding;
      await item.save();
      updated++;
    } catch (error) {
      console.error(`Lỗi cập nhật embedding cho ${item.name}:`, error.message);
      failed++;
    }
  }

  return { updated, failed, total: menuItems.length };
}

module.exports = {
  setupVectorIndex,
  createEmbedding,
  searchMenuByVector,
  filterMenuByNutrition,
  chatCompletion,
  updateMenuItemEmbedding,
  updateAllEmbeddings
};
