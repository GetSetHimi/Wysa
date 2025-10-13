import express from 'express';
import logger from '../Services/logger';

const chatController = express.Router();

const modelName = 'gemini-1.5-flash';

type GeminiPart = { text?: string };
type GeminiContent = { role?: string; parts?: GeminiPart[] };
type GeminiCandidate = { content?: GeminiContent };
type GeminiResponse = { candidates?: GeminiCandidate[]; promptFeedback?: unknown };

chatController.post('/', async (req, res) => {
    try {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey || !apiKey.trim()) {
            logger.error('Gemini API key missing or empty');
            return res.status(500).json({
                success: false,
                message: 'AI service is not configured. Please contact support.',
            });
        }

        const { message } = req.body as { message?: string };
        if (!message || typeof message !== 'string' || !message.trim()) {
            return res.status(400).json({ success: false, message: 'Message is required' });
        }

        if (typeof fetch !== 'function') {
            return res.status(500).json({ success: false, message: 'Fetch API not available in this runtime' });
        }

        const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${encodeURIComponent(apiKey)}`;

        const glRequest = {
            contents: [
                {
                    role: 'user',
                    parts: [{ text: message.trim() }],
                },
            ],
        };

        const resp = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(glRequest),
        });

        if (!resp.ok) {
            const text = await resp.text();
            logger.error('Gemini API error:', resp.status, text);
            return res.status(502).json({ success: false, message: 'Upstream AI service error' });
        }

        const data = (await resp.json()) as GeminiResponse;
        const reply = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
        const trimmedReply = reply.trim();

        if (!trimmedReply) {
            logger.warn('Gemini API responded without usable text');
            return res.status(200).json({ success: true, reply: "" });
        }

        return res.status(200).json({ success: true, reply: trimmedReply });
    } catch (error) {
        logger.error('Gemini chat error:', error);
        return res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
});

export default chatController;