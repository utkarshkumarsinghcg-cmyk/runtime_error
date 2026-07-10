import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// Query endpoint shell
app.post('/api/query', async (req, res) => {
  res.json({
    text: 'Hello! I am your AI Browser Companion. The backend query endpoint is online.',
    isInterpretation: false,
    groundedInPage: true
  });
});

// Summarize endpoint shell
app.post('/api/summarize', async (req, res) => {
  res.json({
    text: 'This is a placeholder summary. The backend summarize endpoint is online.',
    isInterpretation: false,
    groundedInPage: true
  });
});

app.listen(PORT, () => {
  console.log(`Backend server running on port ${PORT}`);
});
