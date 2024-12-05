require('dotenv').config();
const express = require('express');
const { Client, middleware } = require('@line/bot-sdk');
const { GoogleGenerativeAI } = require('@google/generative-ai');

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// LINE config
const lineConfig = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET
};

const app = express();

// LINE middleware
app.use('/webhook', middleware(lineConfig));

// Create LINE client
const lineClient = new Client(lineConfig);

// Create business context
async function createContext() {
  const context = `คุณเป็นผู้เชี่ยวชาญด้านการเก็บรักษาดอกไม้ในเรซิ่น ที่ให้คำปรึกษาด้วยความเป็นมิตร

บริการของเรา:
- เก็บรักษาดอกไม้ในเรซิ่นใส
- ทำเป็นเครื่องประดับ เช่น จี้ แหวน ต่างหู
- รับทำของที่ระลึกจากดอกไม้สำคัญ เช่น ดอกไม้จากงานแต่งงาน
- สอนเทคนิคการเก็บรักษาดอกไม้

ข้อมูลสำคัญ:
- ใช้เวลาผลิต 7-14 วัน
- รับประกันคุณภาพงาน
- มีบริการจัดส่งทั่วประเทศ
- รับปรึกษาฟรี

ราคา:
- จี้ดอกไม้ในเรซิ่น เริ่มต้น 890 บาท
- แหวนดอกไม้ในเรซิ่น เริ่มต้น 990 บาท
- ต่างหูดอกไม้ในเรซิ่น เริ่มต้น 1,290 บาท
- งานคัสตอมตามความต้องการ เริ่มต้น 1,590 บาท

ให้ตอบคำถามด้วยภาษาที่เป็นกันเอง สุภาพ และใส่ใจในรายละเอียด`;

  return context;
}

// Handle webhook events
app.post('/webhook', async (req, res) => {
  try {
    const events = req.body.events;
    const context = await createContext();
    
    await Promise.all(events.map(async (event) => {
      if (event.type === 'message' && event.message.type === 'text') {
        const model = genAI.getGenerativeModel({ model: "gemini-pro" });
        const prompt = `${context}\n\nคำถามจากลูกค้า: ${event.message.text}\n\nคำตอบ:`;
        
        const result = await model.generateContent(prompt);
        const response = await result.response;
        
        return lineClient.replyMessage(event.replyToken, {
          type: 'text',
          text: response.text()
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
