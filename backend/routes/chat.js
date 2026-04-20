// ─── /api/chat — Anthropic proxy (keeps API key hidden from frontend) ──────────
const express = require('express');
const router  = express.Router();

router.post('/', async (req, res) => {
  const { system, messages } = req.body;

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'messages array is required' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || apiKey === 'your_anthropic_api_key_here') {
    console.error('[/api/chat] ANTHROPIC_API_KEY not set in .env');
    return res.status(500).json({
      content: [{ type: 'text', text: 'AI is not configured yet. Please add ANTHROPIC_API_KEY to backend/.env' }]
    });
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type':      'application/json',
        'x-api-key':         apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model:      'claude-3-haiku-20240307',
        max_tokens: 400,
        system:     system || 'You are EventSphere AI, a helpful assistant for a college events platform in India.',
        messages:   messages.slice(-10)
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('[/api/chat] Anthropic error:', data);
      return res.status(502).json({
        content: [{ type: 'text', text: 'AI service error. Please try again in a moment.' }]
      });
    }

    res.json(data);
  } catch (err) {
    console.error('[/api/chat] proxy error:', err.message);
    res.status(500).json({
      content: [{ type: 'text', text: 'Connection error. Please try again.' }]
    });
  }
});

module.exports = router;
