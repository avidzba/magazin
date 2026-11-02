import { StoreProduct } from '../types';

export interface RecognizedWaybillItemRaw {
  name: string;
  quantity: number;
  purchasePrice: number;
}

export interface RecognizedWaybillResponse {
  date: string;
  supplier: string;
  waybillNumber?: string;
  items: RecognizedWaybillItemRaw[];
}

export interface DraftReceiptItem {
  productId: string;
  name: string;
  qty: number;
  price: number; // Закупочная цена (purchasePrice)
  sellPrice?: number; // Розничная цена продажи (для новых товаров = purchasePrice + 25%)
  barcode?: string;
  isNew?: boolean; // Пометка: товар не найден в базе и будет создан при сохранении приемки
  recognizedName?: string; // Исходное название из накладной (для подсказки)
}

/**
 * Normalizes product name for fuzzy matching:
 * lowercase, 'ё' -> 'е', remove quotes/punctuation, normalize units, collapse spaces
 */
function normalizeName(str: string): string {
  return str
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/["'«»„“”(),.;:/\\+\-_]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Computes Sørensen–Dice bigram similarity between two normalized strings (0..1)
 */
function diceSimilarity(a: string, b: string): number {
  const s1 = a.replace(/\s+/g, '');
  const s2 = b.replace(/\s+/g, '');
  if (s1 === s2) return 1;
  if (s1.length < 2 || s2.length < 2) return 0;

  const bigrams1 = new Map<string, number>();
  for (let i = 0; i < s1.length - 1; i++) {
    const bg = s1.slice(i, i + 2);
    bigrams1.set(bg, (bigrams1.get(bg) || 0) + 1);
  }

  let intersection = 0;
  for (let i = 0; i < s2.length - 1; i++) {
    const bg = s2.slice(i, i + 2);
    const count = bigrams1.get(bg) || 0;
    if (count > 0) {
      bigrams1.set(bg, count - 1);
      intersection++;
    }
  }

  return (2 * intersection) / (s1.length - 1 + (s2.length - 1));
}

/**
 * Fuzzy search: matches a recognized item name against existing store products.
 * Uses lowercase normalization, substring search, token overlap, and bigram similarity.
 */
export function findBestMatchingProduct(
  recognizedName: string,
  products: StoreProduct[]
): StoreProduct | null {
  const normRec = normalizeName(recognizedName);
  if (!normRec) return null;

  const activeProducts = products.filter((p) => !p.isArchived);
  const pool = activeProducts.length > 0 ? activeProducts : products;

  // 1. Exact normalized match
  for (const prod of pool) {
    if (normalizeName(prod.name) === normRec) {
      return prod;
    }
  }

  // 2. Direct substring match (either way, if shorter string has >= 4 chars)
  let bestSubstringMatch: StoreProduct | null = null;
  let bestSubstringScore = 0;

  for (const prod of pool) {
    const normProd = normalizeName(prod.name);
    if (!normProd) continue;

    const shorterLen = Math.min(normProd.length, normRec.length);
    if (shorterLen >= 4 && (normProd.includes(normRec) || normRec.includes(normProd))) {
      const score = shorterLen / Math.max(normProd.length, normRec.length);
      if (score > bestSubstringScore) {
        bestSubstringScore = score;
        bestSubstringMatch = prod;
      }
    }
  }

  if (bestSubstringMatch && bestSubstringScore >= 0.45) {
    return bestSubstringMatch;
  }

  // 3. Token overlap + Dice bigram similarity
  const recTokens = normRec.split(' ').filter((t) => t.length >= 2);
  let bestFuzzyMatch: StoreProduct | null = null;
  let bestFuzzyScore = 0;

  for (const prod of pool) {
    const normProd = normalizeName(prod.name);
    if (!normProd) continue;

    const prodTokens = normProd.split(' ').filter((t) => t.length >= 2);
    let matchedTokens = 0;

    for (const rt of recTokens) {
      if (prodTokens.some((pt) => pt.includes(rt) || rt.includes(pt))) {
        matchedTokens++;
      }
    }

    const tokenRecall = recTokens.length > 0 ? matchedTokens / recTokens.length : 0;
    const tokenPrecision = prodTokens.length > 0 ? matchedTokens / prodTokens.length : 0;
    const tokenF1 =
      tokenRecall + tokenPrecision > 0
        ? (2 * tokenRecall * tokenPrecision) / (tokenRecall + tokenPrecision)
        : 0;

    const bigramScore = diceSimilarity(normRec, normProd);
    const combinedScore = tokenF1 * 0.6 + bigramScore * 0.4;

    if (combinedScore > bestFuzzyScore) {
      bestFuzzyScore = combinedScore;
      bestFuzzyMatch = prod;
    }
  }

  if (bestFuzzyMatch && bestFuzzyScore >= 0.58) {
    return bestFuzzyMatch;
  }

  return bestSubstringMatch;
}

/**
 * Converts an image File to a compressed/resized base64 string for fast Vision API upload
 */
export async function fileToOptimizedBase64(
  file: File
): Promise<{ base64: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Ошибка чтения файла изображения'));
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const img = new Image();
      img.onerror = () => {
        // Fallback to raw dataUrl if image element cannot decode (e.g. HEIC)
        const base64 = dataUrl.split(',')[1] || dataUrl;
        resolve({ base64, mimeType: file.type || 'image/jpeg' });
      };
      img.onload = () => {
        try {
          const MAX_DIM = 2000;
          let { width, height } = img;
          if (width > MAX_DIM || height > MAX_DIM) {
            const ratio = Math.min(MAX_DIM / width, MAX_DIM / height);
            width = Math.round(width * ratio);
            height = Math.round(height * ratio);
          }
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            const base64 = dataUrl.split(',')[1] || dataUrl;
            resolve({ base64, mimeType: file.type || 'image/jpeg' });
            return;
          }
          ctx.drawImage(img, 0, 0, width, height);
          const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.88);
          const base64 = compressedDataUrl.split(',')[1] || compressedDataUrl;
          resolve({ base64, mimeType: 'image/jpeg' });
        } catch {
          const base64 = dataUrl.split(',')[1] || dataUrl;
          resolve({ base64, mimeType: file.type || 'image/jpeg' });
        }
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Sends the waybill photo to the server-side Gemini Vision API endpoint
 * and processes the response with fuzzy matching and +25% markup for new products.
 * Strictly returns draft state in memory without touching Firestore!
 */
export async function recognizeWaybillImage(
  file: File,
  existingProducts: StoreProduct[]
): Promise<{
  date: string;
  supplier: string;
  waybillNumber: string;
  items: DraftReceiptItem[];
  matchedCount: number;
  newCount: number;
}> {
  const { base64, mimeType } = await fileToOptimizedBase64(file);

  const response = await fetch('/api/recognize-waybill', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ imageBase64: base64, mimeType }),
  });

  if (!response.ok) {
    let errMsg = `Ошибка сервера (${response.status})`;
    try {
      const errData = await response.json();
      if (errData?.error) errMsg = errData.error;
    } catch {
      // ignore json parse error
    }
    throw new Error(errMsg);
  }

  const data: RecognizedWaybillResponse = await response.json();

  // Normalize date to YYYY-MM-DD if valid
  let normalizedDate = '';
  if (data.date && typeof data.date === 'string') {
    const trimmed = data.date.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      normalizedDate = trimmed;
    } else {
      // Try DD.MM.YYYY or DD/MM/YYYY
      const match = trimmed.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})$/);
      if (match) {
        const day = match[1].padStart(2, '0');
        const month = match[2].padStart(2, '0');
        const year = match[3].length === 2 ? `20${match[3]}` : match[3];
        normalizedDate = `${year}-${month}-${day}`;
      }
    }
  }

  const draftItems: DraftReceiptItem[] = [];
  let matchedCount = 0;
  let newCount = 0;

  const rawItems = Array.isArray(data.items) ? data.items : [];

  rawItems.forEach((raw, idx) => {
    const cleanName = (raw.name || '').trim();
    if (!cleanName) return;

    const qty = Math.max(1, Math.round((Number(raw.quantity) || 1) * 100) / 100);
    const purchasePrice = Math.max(0, Math.round((Number(raw.purchasePrice) || 0) * 100) / 100);

    const matchedProduct = findBestMatchingProduct(cleanName, existingProducts);

    if (matchedProduct) {
      matchedCount++;
      draftItems.push({
        productId: matchedProduct.id,
        name: matchedProduct.name,
        recognizedName: cleanName !== matchedProduct.name ? cleanName : undefined,
        barcode: matchedProduct.barcode,
        qty,
        price: purchasePrice > 0 ? purchasePrice : matchedProduct.purchasePrice || 0,
        sellPrice: matchedProduct.price,
        isNew: false,
      });
    } else {
      newCount++;
      // Auto markup +25% for new product
      const calculatedSellPrice = Math.round(purchasePrice * 1.25);
      draftItems.push({
        productId: `new_${Date.now()}_${idx}`,
        name: cleanName,
        qty,
        price: purchasePrice,
        sellPrice: calculatedSellPrice,
        isNew: true,
      });
    }
  });

  return {
    date: normalizedDate,
    supplier: (data.supplier || '').trim(),
    waybillNumber: (data.waybillNumber || '').trim(),
    items: draftItems,
    matchedCount,
    newCount,
  };
}
