const PHRASE_MAP: Record<string, Record<string, string>> = {
  'es-en': {
    hola: 'hello',
    gracias: 'thank you',
    'buenos dias': 'good morning',
    'buenas tardes': 'good afternoon',
  },
  'en-es': {
    hello: 'hola',
    thanks: 'gracias',
    'thank you': 'gracias',
    'good morning': 'buenos dias',
  },
};

const WORD_MAP: Record<string, Record<string, string>> = {
  'es-en': {
    casa: 'house',
    precio: 'price',
    contrato: 'contract',
    venta: 'sale',
    compra: 'purchase',
  },
  'en-es': {
    house: 'casa',
    price: 'precio',
    contract: 'contrato',
    sale: 'venta',
    purchase: 'compra',
  },
};

export function translateLocalText(text: string, sourceLang: string, targetLang: string): string {
  const normalized = text.trim().toLowerCase();
  if (!normalized) return '';
  const pair = `${sourceLang}-${targetLang}`;
  const phrase = PHRASE_MAP[pair]?.[normalized];
  if (phrase) return phrase;

  const words = normalized.split(/\s+/g);
  const mapped = words.map((word) => WORD_MAP[pair]?.[word] || word);
  return mapped.join(' ');
}
