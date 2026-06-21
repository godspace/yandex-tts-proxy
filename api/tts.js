export default async function handler(req, res) {
    // 1. Настраиваем CORS, чтобы ваш сайт на GitVerse мог обращаться к этому серверу
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*'); // Разрешаем доступ отовсюду
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

    // 2. Обработка предварительного CORS-запроса (OPTIONS) от браузера
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    // Получаем текст из запроса нашего HTML-файла
    const text = req.body?.text || req.query?.text;

    if (!text) {
        return res.status(400).json({ error: 'Текст не передан' });
    }

    // 3. Берем секретный ключ Яндекса из защищенных переменных окружения Vercel
    const apiKey = process.env.YANDEX_API_KEY; 

    // 4. Формируем запрос к Яндексу
    const params = new URLSearchParams();
    params.append('text', text);
    params.append('voice', 'marina');
    params.append('lang', 'ru-RU');
    params.append('emotion', 'neutral');

    try {
        const yandexRes = await fetch('https://tts.api.cloud.yandex.net/speech/v1/tts:synthesize', {
            method: 'POST',
            headers: {
                'Authorization': `Api-Key ${apiKey}`
            },
            body: params
        });

        if (!yandexRes.ok) {
            return res.status(yandexRes.status).json({ error: 'Ошибка сервера Яндекса' });
        }

        // 5. Передаем полученное аудио обратно в браузер
        const arrayBuffer = await yandexRes.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        res.setHeader('Content-Type', 'audio/ogg');
        res.status(200).send(buffer);
    } catch (error) {
        res.status(500).json({ error: 'Внутренняя ошибка прокси-сервера' });
    }
}