import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { GoogleGenAI } from '@google/genai';
import { connectDB } from './db.js';
import { Interaction } from './models/Interaction.js';

const app = express();
app.use(cors());
app.use(express.json());

// 1) Initialize Gemini client (Node SDK)
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});
// Official docs show using GoogleGenAI with GEMINI_API_KEY env var. :contentReference[oaicite:5]{index=5}

// 2) Connect to MongoDB
await connectDB();

// 3) Simple health check
app.get('/', (req, res) => {
  res.send('Gemini API + Mongo backend is running');
});

// 4) Main route: call Gemini and save to DB
app.post('/api/gemini', async (req, res) => {
  try {
    const { prompt, userId, meta } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: 'prompt is required' });
    }

    // Call Gemini API
    const result = await ai.models.generateContent({
      model: 'gemini-2.0-flash',     // choose the model you need
      contents: prompt,
    });

    // In the new SDK, response.text contains the generated text. :contentReference[oaicite:6]{index=6}
    const text = result.text ?? '';

    if (!text) {
      return res.status(500).json({ error: 'No text returned from Gemini' });
    }

    // Save to MongoDB
    const doc = await Interaction.create({
      prompt,
      response: text,
      model: 'gemini-2.0-flash',
      userId,
      meta,
    });

    // Send back the response and db id
    res.json({
      reply: text,
      id: doc._id,
      createdAt: doc.createdAt,
    });
  } catch (err) {
    console.error('Error in /api/gemini:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
