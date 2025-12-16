const { searchMenuByVector, filterMenuByNutrition, chatCompletion, updateMenuItemEmbedding, updateAllEmbeddings } = require("../services/openai.service");
const { getOrCreateSession, addMessage, clearSession } = require("../utils/sessionManager");

const TOOLS = [
  {
    type: "function",
    function: {
      name: "search_menu",
      description: "Tìm kiếm món ăn bằng vector search (semantic). SỬ DỤNG khi: tìm theo loại món, khẩu vị, mô tả chung.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Chuỗi tìm kiếm mô tả món ăn (VD: 'món Việt Nam', 'đồ ăn nhanh', 'món chay')"
          }
        },
        required: ["query"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "filter_menu",
      description: "Lọc món ăn theo tiêu chí CỤ THỂ về calo/protein/giá. SỬ DỤNG KHI: user hỏi về số calo, giá tiền cụ thể, protein.",
      parameters: {
        type: "object",
        properties: {
          maxCalories: {
            type: "number",
            description: "Giới hạn calo tối đa (VD: 500 cho 'dưới 500 calo', 300 cho 'ít calo')"
          },
          minProtein: {
            type: "number",
            description: "Protein tối thiểu tính bằng gram (VD: 20 cho 'nhiều protein')"
          },
          maxPrice: {
            type: "number",
            description: "Giá tối đa tính bằng VNĐ (đồng). Món ăn thường từ 20,000 - 200,000đ."
          },
          category: {
            type: "string",
            description: "Loại món (VD: 'Món Việt Nam', 'Đồ Uống')"
          }
        },
        required: []
      }
    }
  },
  {
    type: "function",
    function: {
      name: "show_products",
      description: "Hiển thị món đã chọn. GỌI sau khi lọc xong.",
      parameters: {
        type: "object",
        properties: {
          product_ids: {
            type: "array",
            items: { type: "string" },
            description: "Mảng ID của các món muốn hiển thị"
          }
        },
        required: ["product_ids"]
      }
    }
  }
];

exports.sendMessage = async (req, res) => {
  try {
    const { message, sessionId } = req.body;

    if (!message || typeof message !== "string") {
      return res.status(400).json({ error: "message phải là string" });
    }

    const sid = sessionId || `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const currentMessages = addMessage(sid, "user", message);
    let iteration = 0;
    const maxIterations = 5;
    let allSearchResults = [];
    let selectedProducts = [];

    while (iteration < maxIterations) {
      const completion = await chatCompletion(currentMessages, TOOLS);
      const responseMessage = completion.choices[0].message;
      currentMessages.push(responseMessage);

      if (responseMessage.tool_calls && responseMessage.tool_calls.length > 0) {
        for (const toolCall of responseMessage.tool_calls) {
          if (toolCall.function.name === "search_menu") {
            const args = JSON.parse(toolCall.function.arguments);
            const searchResults = await searchMenuByVector(args.query);
            allSearchResults = searchResults;

            const simplified = searchResults.map(p => ({
              id: p.id,
              name: p.name,
              price: p.price,
              category: p.category,
              ingredients: p.ingredients,
              nutrition: p.nutrition
            }));

            currentMessages.push({
              role: "tool",
              tool_call_id: toolCall.id,
              content: JSON.stringify(simplified)
            });
          } else if (toolCall.function.name === "filter_menu") {
            const args = JSON.parse(toolCall.function.arguments);
            const filterResults = await filterMenuByNutrition(args);
            allSearchResults = filterResults;

            const simplified = filterResults.map(p => ({
              id: p.id,
              name: p.name,
              price: p.price,
              nutrition: p.nutrition
            }));

            currentMessages.push({
              role: "tool",
              tool_call_id: toolCall.id,
              content: JSON.stringify(simplified)
            });
          } else if (toolCall.function.name === "show_products") {
            const args = JSON.parse(toolCall.function.arguments);
            const productIds = args.product_ids || [];
            
            selectedProducts = allSearchResults.filter(p => productIds.includes(p.id));

            currentMessages.push({
              role: "tool",
              tool_call_id: toolCall.id,
              content: JSON.stringify({ success: true, count: selectedProducts.length })
            });
          }
        }
        iteration++;
        continue;
      }

      const productsForFE = selectedProducts.map(p => ({
        id: p.id,
        name: p.name,
        thumbnail: p.thumbnail,
        price: p.currentPrice,
        hasDiscount: p.hasDiscount
      }));

      return res.json({
        reply: responseMessage.content,
        products: productsForFE,
        sessionId: sid
      });
    }

    return res.status(500).json({ 
      error: "Đã vượt quá số lần gọi tool tối đa" 
    });

  } catch (error) {
    console.error("Lỗi /api/chatbot/send:", error);
    res.status(500).json({ 
      error: error.message || "Lỗi server khi xử lý chat" 
    });
  }
};

exports.clearSession = async (req, res) => {
  try {
    const { sessionId } = req.body;

    if (!sessionId) {
      return res.status(400).json({ error: "Thiếu sessionId" });
    }

    clearSession(sessionId);
    res.json({ success: true, message: "Đã xóa session" });

  } catch (error) {
    console.error("Lỗi /api/chatbot/clear:", error);
    res.status(500).json({ error: error.message });
  }
};

exports.chat = async (req, res) => {
  try {
    const { messages } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: "messages phải là một mảng" });
    }

    let currentMessages = [...messages];
    let iteration = 0;
    const maxIterations = 5;

    while (iteration < maxIterations) {
      const completion = await chatCompletion(currentMessages, TOOLS);
      const responseMessage = completion.choices[0].message;
      currentMessages.push(responseMessage);

      if (responseMessage.tool_calls && responseMessage.tool_calls.length > 0) {
        for (const toolCall of responseMessage.tool_calls) {
          if (toolCall.function.name === "search_menu") {
            const args = JSON.parse(toolCall.function.arguments);
            const searchResults = await searchMenuByVector(args.query);

            currentMessages.push({
              role: "tool",
              tool_call_id: toolCall.id,
              content: JSON.stringify(searchResults, null, 2)
            });
          }
        }
        iteration++;
        continue;
      }

      return res.json({
        message: responseMessage.content,
        usage: completion.usage
      });
    }

    return res.status(500).json({ 
      error: "Đã vượt quá số lần gọi tool tối đa" 
    });

  } catch (error) {
    console.error("Lỗi /api/chat:", error);
    res.status(500).json({ 
      error: error.message || "Lỗi server khi xử lý chat" 
    });
  }
};

exports.updateEmbedding = async (req, res) => {
  try {
    const { menuItemId } = req.body;

    if (!menuItemId) {
      return res.status(400).json({ error: "Thiếu menuItemId" });
    }

    const menuItem = await updateMenuItemEmbedding(menuItemId);

    res.json({ 
      success: true,
      message: "Đã cập nhật embedding thành công",
      menuItemId: menuItem._id
    });

  } catch (error) {
    console.error("Lỗi /api/update-embedding:", error);
    res.status(500).json({ 
      error: error.message || "Lỗi server khi cập nhật embedding" 
    });
  }
};

exports.updateAllEmbeddings = async (req, res) => {
  try {
    const result = await updateAllEmbeddings();

    res.json({
      success: true,
      message: `Đã cập nhật ${result.updated} món ăn, thất bại ${result.failed} món`,
      ...result
    });

  } catch (error) {
    console.error("Lỗi /api/update-all-embeddings:", error);
    res.status(500).json({ 
      error: error.message || "Lỗi server khi cập nhật embeddings" 
    });
  }
};
