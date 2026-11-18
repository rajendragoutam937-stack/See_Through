import 'dotenv/config';
import express, { type Request, type Response } from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import JSZip from 'jszip';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

let cachedKey = '';
let cachedClient: GoogleGenAI | null = null;

function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY?.trim() ?? '';
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    return null;
  }
  if (cachedClient && cachedKey === apiKey) {
    return cachedClient;
  }
  cachedKey = apiKey;
  cachedClient = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
  return cachedClient;
}

function sanitizeLanguageName(value: unknown): string {
  if (typeof value === 'string' && value.trim()) {
    return value.trim().slice(0, 48);
  }
  return 'English';
}

const VISION_SYSTEM_INSTRUCTION = `You are a blind person's warm, trusted best friend walking arm-in-arm beside them.
Look at the path directly ahead and give calm, caring, practical guidance as if speaking into their ear.
Think like a blind person:
- Tell them what actually matters for their next two steps (walls, closed doors, steps/stairs, tripping bags, chairs, poles, approaching people/vehicles, overhead hazards, or which side is open).
- Be specific and directional ("Closed door two steps ahead", "Chair on your left, plenty of room on your right", "Steps going down right ahead, slow down").
- When the walkway is safe and open, reassure them calmly ("Clear path ahead, keep walking straight").
- Write "spokenGuidance" strictly in the requested Spoken Language (can be ANY world language) as ONE natural, friendly spoken sentence (5 to 14 words).
- Never invent exact meters or speeds. If the camera is dark, covered, or blurry, set uncertain: true and kindly tell them in the requested language.
- Return at most 4 important objects.`;

const VISION_RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    pathwayStatus: {
      type: Type.STRING,
      description: 'clear, blocked, turns_left, turns_right, narrow, or uncertain',
    },
    urgencyHint: {
      type: Type.STRING,
      description: 'danger, caution, clear, or info',
    },
    spokenGuidance: {
      type: Type.STRING,
      description: 'Short natural 5-14 word spoken sentence strictly in the requested Spoken Language.',
    },
    uncertain: {
      type: Type.BOOLEAN,
      description: 'true if completely dark, covered, or unreadable',
    },
    objects: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          category: { type: Type.STRING },
          label: { type: Type.STRING },
          position: { type: Type.STRING },
          distance: { type: Type.STRING },
          approaching: { type: Type.BOOLEAN },
          confidence: { type: Type.NUMBER },
        },
        required: ['category', 'label', 'position', 'distance', 'approaching', 'confidence'],
      },
    },
  },
  required: ['pathwayStatus', 'urgencyHint', 'spokenGuidance', 'uncertain', 'objects'],
};

const ASK_RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    transcript: {
      type: Type.STRING,
      description: 'Exact transcript of what the user said in the audio (or the text question).',
    },
    reply: {
      type: Type.STRING,
      description: 'Concise, warm, helpful spoken reply strictly in the active or newly requested language (1 to 3 short sentences).',
    },
    detectedLanguageTag: {
      type: Type.STRING,
      description: 'Standard BCP-47 language tag for the reply (e.g. en-US, es-ES, fr-FR, hi-IN, ja-JP, ar-SA, de-DE, pt-BR).',
    },
    switchLanguageName: {
      type: Type.STRING,
      description: 'If the user asked to speak/talk in a specific language (any language in the world), put its English name here (e.g. "Spanish", "French", "Japanese", "Arabic", "English"). Otherwise empty string "".',
    },
    switchLanguageTag: {
      type: Type.STRING,
      description: 'BCP-47 tag corresponding to switchLanguageName (e.g. "es-ES", "fr-FR", "ja-JP", "ar-SA", "en-US"). Otherwise empty string "".',
    },
  },
  required: [
    'transcript',
    'reply',
    'detectedLanguageTag',
    'switchLanguageName',
    'switchLanguageTag',
  ],
};

const CODE_DOWNLOAD_SECRET = '#BRUHHD2DCODEFILES';
const EXCLUDED_DIRS = new Set(['node_modules', 'dist', '.git', '.aistudio']);
const EXCLUDED_FILES = new Set(['.env', '.env.local']);

function addFilesFlatToZip(zip: JSZip, dirPath: string, usedNames = new Set<string>()): void {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    if (EXCLUDED_DIRS.has(entry.name) || EXCLUDED_FILES.has(entry.name)) {
      continue;
    }
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      addFilesFlatToZip(zip, fullPath, usedNames);
    } else if (entry.isFile()) {
      let fileName = entry.name;
      if (usedNames.has(fileName)) {
        fileName = path.relative(__dirname, fullPath).replace(/[\\/]/g, '_');
      }
      usedNames.add(fileName);
      zip.file(fileName, fs.readFileSync(fullPath));
    }
  }
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '6mb' }));

  app.get('/api/health', (_req: Request, res: Response) => {
    const ai = getGeminiClient();
    res.json({
      ok: true,
      aiConfigured: Boolean(ai),
    });
  });

  app.post('/api/vision/analyze', async (req: Request, res: Response) => {
    const ai = getGeminiClient();
    if (!ai) {
      res.status(503).json({
        error: 'AI connection unavailable. Configure GEMINI_API_KEY in Secrets to enable live vision analysis.',
      });
      return;
    }

    const { imageBase64, mimeType, sensitivity, spokenLanguageName } = req.body ?? {};
    if (typeof imageBase64 !== 'string' || !imageBase64.trim()) {
      res.status(400).json({ error: 'Missing camera frame payload.' });
      return;
    }

    const safeMimeType =
      mimeType === 'image/png' || mimeType === 'image/webp' ? mimeType : 'image/jpeg';
    const safeSensitivity =
      sensitivity === 'low' || sensitivity === 'high' ? sensitivity : 'medium';
    const targetLanguage = sanitizeLanguageName(spokenLanguageName);

    const promptText = `Spoken Language: ${targetLanguage}. Sensitivity: ${safeSensitivity}. Tell me immediately in ${targetLanguage} what is in front and if anything blocks the path.`;

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3.1-flash-lite',
        contents: {
          parts: [
            {
              inlineData: {
                mimeType: safeMimeType,
                data: imageBase64,
              },
            },
            { text: promptText },
          ],
        },
        config: {
          systemInstruction: VISION_SYSTEM_INSTRUCTION,
          responseMimeType: 'application/json',
          responseSchema: VISION_RESPONSE_SCHEMA,
          thinkingConfig: {
            thinkingLevel: ThinkingLevel.MINIMAL,
          },
        },
      });

      const rawText = (response.text ?? '{}').trim();
      const parsed = JSON.parse(rawText);
      res.json(parsed);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Vision analysis failed.';
      const status =
        message.includes('429') || message.includes('RESOURCE_EXHAUSTED')
          ? 429
          : message.includes('403') || message.includes('PERMISSION_DENIED')
            ? 403
            : 502;
      res.status(status).json({ error: message });
    }
  });

  app.post('/api/vision/ask', async (req: Request, res: Response) => {
    const ai = getGeminiClient();
    if (!ai) {
      res.status(503).json({
        error: 'AI connection unavailable. Configure GEMINI_API_KEY in Secrets.',
      });
      return;
    }

    const {
      question,
      audioBase64,
      audioMimeType,
      imageBase64,
      mimeType,
      spokenLanguageName,
      demoSceneSummary,
      history,
    } = req.body ?? {};

    const hasText = typeof question === 'string' && question.trim().length > 0;
    const hasAudio = typeof audioBase64 === 'string' && audioBase64.trim().length > 0;

    if (!hasText && !hasAudio) {
      res.status(400).json({ error: 'Provide either spoken audio or a text question.' });
      return;
    }

    const activeLangName = sanitizeLanguageName(spokenLanguageName);
    const safeImageMimeType =
      mimeType === 'image/png' || mimeType === 'image/webp' ? mimeType : 'image/jpeg';
    const safeAudioMimeType =
      typeof audioMimeType === 'string' && audioMimeType.startsWith('audio/')
        ? audioMimeType.split(';')[0]
        : 'audio/webm';

    const historyLines = Array.isArray(history)
      ? history
          .slice(-6)
          .map((m: { role?: string; text?: string }) =>
            `${m.role === 'user' ? 'User' : 'Friend'}: ${m.text ?? ''}`
          )
          .join('\n')
      : '';

    const systemInstruction = `You are VisionGuide, the user's warmest, smartest, fastest seeing best friend helping a blind or visually impaired person.
Current active spoken language: ${activeLangName}.

CRITICAL LANGUAGE RULE:
- The user can name ANY language in the world (e.g. "speak in Spanish", "talk in French", "Japanese", "Arabic", "Hindi", "Portuguese", "Tamil", "German", "talk in English", etc.) OR speak directly in another language.
- If the user asks you to speak/talk in a specific language (or says a language name), IMMEDIATELY switch: set "switchLanguageName" to that language's English name, set "switchLanguageTag" to its standard BCP-47 tag (e.g. "es-ES", "fr-FR", "ja-JP"), and write your entire "reply" ONLY in that new language!
- Otherwise, keep "switchLanguageName" and "switchLanguageTag" as empty strings "", and reply strictly in ${activeLangName} (or match the language the user just spoke in if clearly different).

HELPFULNESS RULES:
1. Talk like a real, caring best friend right beside them—warm, calm, reassuring, never robotic.
2. Think like a blind person: focus on safe footing, where to step, what they can reach out and touch on their left/right/front, and any nearby details they asked about.
3. If audio is attached, listen carefully. If the audio is silent, static, or contains no clear spoken words, set "transcript" to "" and gently ask them in ${activeLangName} to say that again because you couldn't hear any words—NEVER invent or guess words that were not spoken.
4. Keep replies clear and natural to listen to out loud (1 to 3 short sentences max).
5. If a camera image is attached, describe the exact spatial layout (left, center, right, near/far, doors, walls, objects, readable signs/text).
6. If no camera image is attached and demoSceneSummary is absent, kindly let them know the camera isn't on yet while still helping with what they asked.`;

    const contextLines = [
      historyLines ? `Recent chat:\n${historyLines}` : '',
      typeof demoSceneSummary === 'string' && demoSceneSummary
        ? `Current Demo Mode simulated scene: ${demoSceneSummary}`
        : '',
      hasText
        ? `User says: "${question.trim()}"`
        : 'Listen to the attached user voice recording and respond helpfully.',
    ]
      .filter(Boolean)
      .join('\n\n');

    const parts: Array<
      { text: string } | { inlineData: { mimeType: string; data: string } }
    > = [];

    if (typeof imageBase64 === 'string' && imageBase64.trim()) {
      parts.push({
        inlineData: {
          mimeType: safeImageMimeType,
          data: imageBase64,
        },
      });
    }
    if (hasAudio) {
      parts.push({
        inlineData: {
          mimeType: safeAudioMimeType,
          data: audioBase64,
        },
      });
    }
    parts.push({ text: contextLines });

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3.1-flash-lite',
        contents: { parts },
        config: {
          systemInstruction,
          responseMimeType: 'application/json',
          responseSchema: ASK_RESPONSE_SCHEMA,
          thinkingConfig: {
            thinkingLevel: ThinkingLevel.MINIMAL,
          },
        },
      });

      const rawText = (response.text ?? '{}').trim();
      const parsed = JSON.parse(rawText);
      res.json(parsed);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Assistant request failed.';
      res.status(502).json({ error: message });
    }
  });

  app.get('/api/project/download', async (req: Request, res: Response) => {
    const providedCode =
      req.get('x-download-code') || (typeof req.query.code === 'string' ? req.query.code : '');
    if (providedCode !== CODE_DOWNLOAD_SECRET) {
      res.status(403).json({ error: 'Access denied.' });
      return;
    }

    try {
      const zip = new JSZip();
      addFilesFlatToZip(zip, __dirname);
      const buffer = await zip.generateAsync({
        type: 'nodebuffer',
        compression: 'DEFLATE',
        compressionOptions: { level: 6 },
      });

      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', 'attachment; filename="visionguide-ai-code.zip"');
      res.setHeader('Content-Length', buffer.length);
      res.send(buffer);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to package project code.';
      res.status(500).json({ error: message });
    }
  });

  if (!IS_PRODUCTION) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    if (fs.existsSync(distDir)) {
      app.use(express.static(distDir));
      app.get('*', (_req: Request, res: Response) => {
        res.sendFile(path.join(distDir, 'index.html'));
      });
    }
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`VisionGuide AI server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
