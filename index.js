require('dotenv').config();
const express = require('express');
const line = require('@line/bot-sdk');
const { GoogleGenerativeAI } = require('@google/generative-ai');

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-pro" });

// LINE config
const lineConfig = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET
};

const app = express();

// LINE middleware
app.use('/webhook', line.middleware(lineConfig));

// Create LINE client using the newer approach
const lineClient = new line.messagingApi.MessagingApiClient({
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN
});

// Store chat history with timestamps
const chatHistory = {};
setInterval(() => {
  const oneMonthAgo = Date.now() - 60 * 60 * 1000 * 24 * 30;
  Object.keys(chatHistory).forEach(userId => {
    if (chatHistory[userId].lastAccess < oneMonthAgo) {
      delete chatHistory[userId];
    }
  });
}, 60 * 60 * 1000 * 24);
// Create business context
async function createContext() {
  const context = `คุณเป็นผู้เชี่ยวชาญด้านการเก็บรักษาดอกไม้ในเรซิ่น ที่ให้คำปรึกษาด้วยความเป็นมิตร

บริการของเรา:
- เก็บรักษาดอกไม้ในเรซิ่นใส
- ทำเป็นรูปทรงต่างๆ เช่น หัวใจ สี่เหลี่ยม วงกลม ตัวอักษร
- รับทำของที่ระลึกจากดอกไม้สำคัญ เช่น ดอกไม้จากงานแต่งงาน
- สอนเทคนิคการเก็บรักษาดอกไม้

ข้อมูลสำคัญ:
- ใช้เวลาผลิต 2 เดือน
- ไม่มีบริการนัดรับ
- มีบริการจัดส่งทั่วประเทศ
- รับปรึกษาฟรี

ราคา:
- รูปทรง หัวใจ เริ่มต้น 2,500 บาท
- รูปทรง สี่เหลี่ยม เริ่มต้น 2,300 บาท
- วงกลม เริ่มต้น 3,000 บาท
- ตัวอะกษร เริ่มต้น 2,000 บาท

ให้ตอบคำถามด้วยภาษาที่เป็นกันเอง สุภาพ และใส่ใจในรายละเอียด`;

  return context;
}

// Initialize chat with context
async function initializeChat() {
  const chat = model.startChat({
    history: [{
      role: "user",
      parts: await createContext()
    }]
  });
  chat.lastAccess = Date.now();
  return chat;
}

// Clean up inactive chats every hour
setInterval(() => {
  const oneHourAgo = Date.now() - (60 * 60 * 1000);
  Object.keys(chatHistory).forEach(userId => {
    if (chatHistory[userId].lastAccess < oneHourAgo) {
      delete chatHistory[userId];
    }
  });
}, 60 * 60 * 1000);

// Handle webhook events
app.post('/webhook', async (req, res) => {
  try {
    const events = req.body.events;
    
    await Promise.all(events.map(async (event) => {
      if (event.type === 'message' && event.message.type === 'text') {
        const userId = event.source.userId;
        const userQuestion = event.message.text;

        // Get or create chat session
        if (!chatHistory[userId]) {
          chatHistory[userId] = await initializeChat();
        }

        // Get the business context
        const businessContext = await createContext();

        // Properly structure the content for confidence assessment
        const assessmentResult = await model.generateContent({
          parts: [{
            text: `Given this specific business context:
            ${businessContext}
            
            Evaluate if you can accurately answer this question: "${userQuestion}"
            Return only a number between 0-100 representing your confidence level based strictly on the information provided in the context above.`
          }]
        });
        
        const confidenceScore = parseInt(assessmentResult.response.text().trim());

        // If confidence is less than 80%, don't respond
        if (confidenceScore < 80) {
          return;
        }

        // Process message and get response
        const result = await chatHistory[userId].sendMessage(userQuestion);
        const response = await result.response;
        
        // Mark as read only for high-confidence responses
        chatHistory[userId].lastAccess = Date.now();
        
        return lineClient.replyMessage({
          replyToken: event.replyToken,
          messages: [{
            type: 'text',
            text: response.text()
          }]
        });
      }
    }));
    
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});



// Basic health check endpoint
app.get('/', (req, res) => {
  res.send('Bot is running!');
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
