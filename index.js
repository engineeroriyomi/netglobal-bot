const express = require('express');
const axios = require('axios');
const app = express();
app.use(express.json());

const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
const PORT = process.env.PORT || 3000;

const SYSTEM_PROMPT = `You are NETGlobal AutoDiag — an expert automotive diagnostic assistant with deep knowledge of vehicle fault codes (DTCs), symptoms, and repair procedures. You have special familiarity with Toyota, Honda, Hyundai, and other popular vehicles in the Nigerian and West African market.

When a user gives you a DTC code or describes a symptom, respond in a clear WhatsApp-friendly format like this:

🔧 *FAULT CODE:* P0741
📋 *NAME:* TCC Circuit Performance

⚠️ *SEVERITY:* High

📖 *WHAT THIS MEANS:*
Brief plain English explanation here.

🔍 *POSSIBLE CAUSES:*
• Cause 1
• Cause 2
• Cause 3

👀 *WHAT YOU MAY NOTICE:*
• Symptom 1
• Symptom 2

🛠️ *FIX STEPS:*
1. Step 1
2. Step 2
3. Step 3

💡 *MECHANIC TIP:*
Practical tip for Nigerian mechanics here.

Keep language simple and practical. Always be helpful.`;

// Webhook verification
app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log('Webhook verified!');
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

// Receive messages
app.post('/webhook', async (req, res) => {
  try {
    const body = req.body;
    if (body.object === 'whatsapp_business_account') {
      const entry = body.entry?.[0];
      const changes = entry?.changes?.[0];
      const message = changes?.value?.messages?.[0];
      if (message && message.type === 'text') {
        const from = message.from;
        const text = message.text.body;
        console.log(`Message from ${from}: ${text}`);
        await sendTypingIndicator(from);
        const reply = await getDiagnosis(text);
        await sendWhatsAppMessage(from, reply);
      }
    }
    res.sendStatus(200);
  } catch (error) {
    console.error('Error:', error.message);
    res.sendStatus(500);
  }
});

async function getDiagnosis(userMessage) {
  try {
    const response = await axios.post(
      'https://api.anthropic.com/v1/messages',
      {
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userMessage }]
      },
      {
        headers: {
          'x-api-key': ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json'
        }
      }
    );
    return response.data.content[0].text;
  } catch (error) {
    return '⚠️ Sorry, I could not process your request right now. Please try again in a moment.';
  }
}

async function sendWhatsAppMessage(to, message) {
  await axios.post(
    `https://graph.facebook.com/v18.0/${PHONE_NUMBER_ID}/messages`,
    {
      messaging_product: 'whatsapp',
      to: to,
      type: 'text',
      text: { body: message }
    },
    {
      headers: {
        Authorization: `Bearer ${WHATSAPP_TOKEN}`,
        'Content-Type': 'application/json'
      }
    }
  );
}

async function sendTypingIndicator(to) {
  try {
    await axios.post(
      `https://graph.facebook.com/v18.0/${PHONE_NUMBER_ID}/messages`,
      {
        messaging_product: 'whatsapp',
        to: to,
        type: 'text',
        text: { body: '🔍 Analyzing your diagnostic request...' }
      },
      {
        headers: {
          Authorization: `Bearer ${WHATSAPP_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );
  } catch (e) {}
}

app.get('/', (req, res) => {
  res.send('NETGlobal AutoDiag Bot is running! 🔧');
});

app.listen(PORT, () => {
  console.log(`NETGlobal Bot running on port ${PORT}`);
});
