import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { OpenAIAdapter } from './adapters/openai.js';
import { GeminiAdapter } from './adapters/gemini.js';
import { OllamaAdapter } from './adapters/ollama.js';
import { chunkText } from './lib/contentChunker.js';
import { getSystemPrompt } from './lib/promptBuilder.js';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const pdf = require('pdf-parse');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Swappable LLM Provider selection
let llm;
const provider = (process.env.LLM_PROVIDER || 'openai').toLowerCase();

switch (provider) {
  case 'gemini':
    console.log('[Backend] Initializing Gemini LLM Provider.');
    llm = new GeminiAdapter();
    break;
  case 'ollama':
    console.log('[Backend] Initializing Ollama (Local) LLM Provider.');
    llm = new OllamaAdapter();
    break;
  case 'openai':
  default:
    console.log('[Backend] Initializing OpenAI LLM Provider.');
    llm = new OpenAIAdapter();
    break;
}

app.get('/api/health', (req, res) => {
  const activeModel = provider === 'ollama' ? (process.env.OLLAMA_MODEL || 'llama3') : (provider === 'gemini' ? 'gemini-1.5-flash' : 'gpt-4o-mini');
  res.json({ status: 'ok', provider, model: activeModel, time: new Date().toISOString() });
});

app.get('/api/status', async (req, res) => {
  try {
    if (provider === 'ollama') {
      const ollamaHost = process.env.OLLAMA_HOST || 'http://localhost:11434';
      const pingRes = await fetch(`${ollamaHost}/api/tags`).catch(() => null);
      if (!pingRes || !pingRes.ok) {
        return res.json({ status: 'offline', provider: 'ollama', models: [] });
      }
      const data = await pingRes.json();
      const modelsList = data.models ? data.models.map(m => m.name) : [];
      return res.json({ 
        status: 'online', 
        provider: 'ollama', 
        models: modelsList, 
        activeModel: process.env.OLLAMA_MODEL || 'llama3.1:8b' 
      });
    } else {
      // Cloud LLM Fallback (gemini/openai)
      const cloudModel = provider === 'gemini' ? 'gemini-1.5-flash' : 'gpt-4o-mini';
      return res.json({ 
        status: 'online', 
        provider, 
        models: [cloudModel], 
        activeModel: cloudModel 
      });
    }
  } catch (e) {
    res.json({ status: 'offline', provider, models: [], error: e.message });
  }
});

app.post('/api/parse-pdf', async (req, res) => {
  try {
    const { fileData } = req.body;
    if (!fileData) {
      return res.status(400).json({ error: 'No fileData provided' });
    }
    const buffer = Buffer.from(fileData, 'base64');
    const data = await pdf(buffer);
    res.json({ text: data.text });
  } catch (err) {
    console.error('[PDF Parse Error]', err);
    res.status(500).json({ error: err.message });
  }
});

// Grounded Query Route
app.post('/api/query', async (req, res) => {
  const { pageContent, history, userQuery, intent, targetLanguage } = req.body;

  const hasContext = !!(pageContent && typeof pageContent.textContent === 'string' && pageContent.textContent.trim().length > 0);
  const systemPrompt = getSystemPrompt(intent, targetLanguage, hasContext);

  // Build a rich, structured context block for the LLM
  let pageText = '';
  if (hasContext) {
    const meta = [];
    if (pageContent.title) meta.push(`Title: ${pageContent.title}`);
    if (pageContent.byline) meta.push(`Author: ${pageContent.byline}`);
    if (pageContent.url) meta.push(`URL: ${pageContent.url}`);
    if (pageContent.excerpt) meta.push(`Summary: ${pageContent.excerpt}`);
    if (pageContent.extractionMethod) meta.push(`Extraction Method: ${pageContent.extractionMethod}`);
    if (pageContent.wordCount) meta.push(`Word Count: ${pageContent.wordCount}`);

    pageText = meta.length > 0
      ? `--- PAGE METADATA ---\n${meta.join('\n')}\n\n--- PAGE CONTENT ---\n${pageContent.textContent}`
      : pageContent.textContent;
  }

  try {
    const result = await llm.complete({
      systemPrompt,
      pageContent: pageText,
      history: history || [],
      userQuery: userQuery
    });

    res.json({
      text: result.text,
      isInterpretation: result.isInterpretation,
      groundedInPage: hasContext
    });
  } catch (err) {
    console.error('[Backend Query Route Error]:', err);
    res.status(500).json({
      error: {
        code: 'LLM_ERROR',
        message: err.message
      }
    });
  }
});

// Dedicated Map-Reduce Summarize Route
app.post('/api/summarize', async (req, res) => {
  const { pageContent, targetLanguage } = req.body;

  if (!pageContent || typeof pageContent.textContent !== 'string') {
    return res.status(420).json({ error: 'Missing or invalid pageContent' });
  }

  try {
    // Build metadata prefix so each chunk summary has context about its source
    const meta = [];
    if (pageContent.title) meta.push(`Title: ${pageContent.title}`);
    if (pageContent.byline) meta.push(`Author: ${pageContent.byline}`);
    if (pageContent.url) meta.push(`URL: ${pageContent.url}`);
    if (pageContent.excerpt) meta.push(`Excerpt: ${pageContent.excerpt}`);
    const metaHeader = meta.length > 0 ? `--- PAGE METADATA ---\n${meta.join('\n')}\n\n--- PAGE CONTENT ---\n` : '';

    const text = metaHeader + pageContent.textContent;
    // Chunking threshold: 3000 words
    const chunks = chunkText(text, 1500, 100);

    if (chunks.length === 1) {
      // Small page: single call summarization
      const result = await llm.complete({
        systemPrompt: getSystemPrompt('SUMMARIZE', targetLanguage),
        pageContent: text,
        history: [],
        userQuery: 'Summarize the webpage context.'
      });
      return res.json({
        text: result.text,
        isInterpretation: result.isInterpretation,
        groundedInPage: true
      });
    }

    // Large page: Map phase (summarize each chunk)
    console.log(`[Backend Map-Reduce] Processing ${chunks.length} chunks...`);
    const chunkSummaries = await Promise.all(
      chunks.map(async (chunk, idx) => {
        const res = await llm.complete({
          systemPrompt: 'You are an AI Browser Companion. Provide a detailed, comprehensive summary of this portion of the webpage context. Retain all key arguments, core concepts, metrics, names, and important figures.',
          pageContent: chunk,
          history: [],
          userQuery: 'Analyze and summarize this section in detail, ensuring all key context is preserved.'
        });
        return `[Section ${idx + 1} Summary]: ${res.text}`;
      })
    );

    // Reduce phase (summarize the combined summaries)
    const combinedSummaryText = chunkSummaries.join('\n\n');
    console.log('[Backend Map-Reduce] Reducing summaries...');
    const reduceResult = await llm.complete({
      systemPrompt: getSystemPrompt('SUMMARIZE', targetLanguage),
      pageContent: combinedSummaryText,
      history: [],
      userQuery: 'Synthesize these section summaries into a final coherent summary.'
    });

    res.json({
      text: reduceResult.text,
      isInterpretation: reduceResult.isInterpretation,
      groundedInPage: true
    });
  } catch (err) {
    console.error('[Backend Summarize Route Error]:', err);
    res.status(500).json({
      error: {
        code: 'LLM_ERROR',
        message: err.message
      }
    });
  }
});

app.listen(PORT, () => {
  console.log(`Backend server running on port ${PORT} using provider [${provider}]`);
});
