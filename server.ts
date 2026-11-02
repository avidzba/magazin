import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI, Type } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Allow up to 25MB base64 images for waybill/invoice photos
  app.use(express.json({ limit: '25mb' }));

  // API Endpoint: Recognize Waybill / Invoice from Photo via Gemini Vision
  app.post('/api/recognize-waybill', async (req, res) => {
    try {
      const { imageBase64, mimeType } = req.body;

      if (!imageBase64 || typeof imageBase64 !== 'string') {
        res.status(400).json({ error: 'Не передано изображение накладной (imageBase64).' });
        return;
      }

      // Strip data URL prefix if present
      const cleanBase64 = imageBase64.replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/, '');
      const resolvedMimeType = mimeType || 'image/jpeg';

      const prompt = `Ты — профессиональный ИИ-бухгалтер и оператор складского учета.
Проанализируй фотографию товарной накладной (УПД, ТОРГ-12, счет-фактура, товарный чек или рукописная накладная поставщика) и извлеки структурированные данные:
1. "date": Дата документа в формате YYYY-MM-DD (например, "2026-10-25"). Если год указан двумя цифрами, преобразуй в полный формат 20XX. Если дату невозможно определить, верни пустую строку "".
2. "supplier": Название поставщика / продавца / компании / ИП (например, "ООО Альфа-Трейд" или "ИП Иванов И.И."). Если не найдено, верни "".
3. "waybillNumber": Номер накладной или документа, если он виден на фото (например, "№ 452"). Если нет, верни "".
4. "items": Массив всех товарных позиций из таблицы накладной. Для каждой позиции извлеки:
   - "name": Полное наименование товара (точно как в накладной, без порядкового номера строки).
   - "quantity": Количество единиц товара (число). Если не указано или нечитаемо, поставь 1.
   - "purchasePrice": Закупочная цена за 1 единицу товара (число). Внимание: бери именно цену за 1 шт./кг/упак., а не общую сумму строки! Если указана только общая сумма строки и количество, раздели сумму на количество.`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: {
          parts: [
            {
              inlineData: {
                mimeType: resolvedMimeType,
                data: cleanBase64,
              },
            },
            {
              text: prompt,
            },
          ],
        },
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              date: {
                type: Type.STRING,
                description: 'Дата накладной в формате YYYY-MM-DD или пустая строка',
              },
              supplier: {
                type: Type.STRING,
                description: 'Название поставщика / организации',
              },
              waybillNumber: {
                type: Type.STRING,
                description: 'Номер накладной (если есть)',
              },
              items: {
                type: Type.ARRAY,
                description: 'Список распознанных товаров из накладной',
                items: {
                  type: Type.OBJECT,
                  properties: {
                    name: {
                      type: Type.STRING,
                      description: 'Наименование товара',
                    },
                    quantity: {
                      type: Type.NUMBER,
                      description: 'Количество товара',
                    },
                    purchasePrice: {
                      type: Type.NUMBER,
                      description: 'Цена закупки за 1 единицу товара',
                    },
                  },
                  required: ['name', 'quantity', 'purchasePrice'],
                },
              },
            },
            required: ['date', 'supplier', 'items'],
          },
        },
      });

      const rawText = response.text;
      if (!rawText) {
        res.status(500).json({ error: 'ИИ вернул пустой ответ при распознавании изображения.' });
        return;
      }

      const parsed = JSON.parse(rawText.trim());
      res.json(parsed);
    } catch (error: any) {
      console.error('Error recognizing waybill:', error);
      res.status(500).json({
        error: error?.message || 'Ошибка при распознавании накладной через Gemini Vision API.',
      });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
