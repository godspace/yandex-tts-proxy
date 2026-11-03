export default async function handler(req, res) {
  // 1. CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // 2. Читаем параметры из body (POST) или query (GET)
  const body = req.body || {};
  const text = body.text || req.query?.text;
  
  // Параметры для гибкости (с дефолтами для обратной совместимости)
  const voice = body.voice || req.query?.voice || 'marina';
  const emotion = body.emotion || req.query?.emotion || 'neutral';
  const speed = body.speed || req.query?.speed || '1.0';
  const lang = body.lang || req.query?.lang || 'ru-RU';

  if (!text) return res.status(400).json({ error: 'Текст не передан' });

  const apiKey = process.env.YANDEX_API_KEY;
  const params = new URLSearchParams();
  
  params.append('text', text);
  params.append('voice', voice);
  params.append('lang', lang);
  params.append('emotion', emotion);
  params.append('speed', speed);
  params.append('format', 'ogg'); // OGG легче проигрывается браузером

  try {
    const yandexRes = await fetch('https://tts.api.cloud.yandex.net/speech/v1/tts:synthesize', {
      method: 'POST',
      headers: { 'Authorization': `Api-Key ${apiKey}` },
      body: params
    });

    if (!yandexRes.ok) {
      const errText = await yandexRes.text();
      return res.status(yandexRes.status).json({ error: 'Ошибка Яндекса', details: errText });
    }

    const arrayBuffer = await yandexRes.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    res.setHeader('Content-Type', 'audio/ogg');
    res.status(200).send(buffer);
  } catch (error) {
    res.status(500).json({ error: 'Внутренняя ошибка прокси', details: error.message });
  }
}
