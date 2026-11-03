export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const body = req.body || {};
  const text = (body.text || req.query?.text || '').trim();
  const voice = body.voice || req.query?.voice || 'marina';
  const emotion = body.emotion || req.query?.emotion || 'neutral';
  const speed = body.speed || req.query?.speed || '1.0';
  const lang = body.lang || req.query?.lang || 'ru-RU';

  if (!text) return res.status(400).json({ error: 'Текст не передан' });

  const apiKey = process.env.YANDEX_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'YANDEX_API_KEY не настроен' });

  // Yandex лимит: 2000 символов на запрос
  const MAX_CHUNK = 1900;
  const chunks = text.length <= MAX_CHUNK ? [text] : splitIntoChunks(text, MAX_CHUNK);

  try {
    const audioBuffers = [];
    for (let i = 0; i < chunks.length; i++) {
      const buffer = await synthesizeChunk(apiKey, chunks[i], voice, emotion, speed, lang);
      audioBuffers.push(buffer);
    }

    const finalBuffer = Buffer.concat(audioBuffers);
    res.setHeader('Content-Type', 'audio/ogg; codecs=opus');
    res.setHeader('Cache-Control', 's-maxage=86400');
    res.status(200).send(finalBuffer);
  } catch (error) {
    console.error('[tts] Error:', error);
    res.status(500).json({ error: 'Ошибка синтеза', details: error.message });
  }
}

async function synthesizeChunk(apiKey, text, voice, emotion, speed, lang) {
  const params = new URLSearchParams();
  params.append('text', text);
  params.append('voice', voice);
  params.append('lang', lang);
  params.append('emotion', emotion);
  params.append('speed', speed);
  params.append('format', 'oggopus');  // ← ИСПРАВЛЕНО: ogg → oggopus
  params.append('sampleRateHertz', '48000');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25000);

  try {
    const yandexRes = await fetch('https://tts.api.cloud.yandex.net/speech/v1/tts:synthesize', {
      method: 'POST',
      headers: { 'Authorization': `Api-Key ${apiKey}` },
      body: params,
      signal: controller.signal
    });

    clearTimeout(timeout);

    if (!yandexRes.ok) {
      const errText = await yandexRes.text();
      throw new Error(`Yandex ${yandexRes.status}: ${errText.slice(0, 200)}`);
    }

    const arrayBuffer = await yandexRes.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch (err) {
    clearTimeout(timeout);
    if (err.name === 'AbortError') throw new Error('Таймаут запроса к Yandex');
    throw err;
  }
}

function splitIntoChunks(text, maxLen) {
  const sentences = text.match(/[^.!?…]+[.!?…]+|[^.!?…]+$/g) || [text];
  const chunks = [];
  let current = '';
  for (const sentence of sentences) {
    if ((current + sentence).length > maxLen) {
      if (current) chunks.push(current.trim());
      if (sentence.length > maxLen) {
        const words = sentence.split(/\s+/);
        current = '';
        for (const w of words) {
          if ((current + ' ' + w).length > maxLen) {
            if (current) chunks.push(current.trim());
            current = w;
          } else {
            current += (current ? ' ' : '') + w;
          }
        }
      } else {
        current = sentence;
      }
    } else {
      current += sentence;
    }
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks;
}
