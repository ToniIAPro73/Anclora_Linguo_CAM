export interface LanguageDetectionResult {
  code: string;
  confidence: number;
}

const COMMON_HINTS: Record<string, string[]> = {
  es: [' que ', ' para ', ' con ', 'hola', 'gracias', 'usted', 'buenos'],
  en: [' the ', ' and ', ' you ', 'hello', 'thanks', 'with ', 'for '],
  fr: [' bonjour', ' merci', ' avec ', ' pour ', ' vous ', ' le ', ' la '],
  de: [' und ', ' danke', ' mit ', ' ich ', ' nicht ', ' der ', ' die '],
  it: [' ciao', ' grazie', ' con ', ' per ', ' che ', ' il ', ' la '],
  pt: [' ola', ' obrigado', ' com ', ' para ', ' voce ', ' que ', ' nao '],
  ru: [' и ', ' что ', ' как ', 'спасибо', 'привет'],
};

function hasCjk(text: string): boolean {
  return /[\u4e00-\u9fff]/.test(text);
}

function hasHiraganaKatakana(text: string): boolean {
  return /[\u3040-\u30ff]/.test(text);
}

function hasHangul(text: string): boolean {
  return /[\uac00-\ud7af]/.test(text);
}

function hasCyrillic(text: string): boolean {
  return /[\u0400-\u04FF]/.test(text);
}

export function detectLanguageHeuristic(input: string): LanguageDetectionResult {
  const normalized = ` ${input.toLowerCase().trim()} `;
  if (normalized.trim().length < 4) {
    return { code: 'auto', confidence: 0 };
  }

  if (hasHangul(normalized)) return { code: 'ko', confidence: 0.98 };
  if (hasHiraganaKatakana(normalized)) return { code: 'ja', confidence: 0.98 };
  if (hasCjk(normalized)) return { code: 'zh', confidence: 0.95 };
  if (hasCyrillic(normalized)) return { code: 'ru', confidence: 0.92 };

  let bestCode = 'auto';
  let bestScore = 0;
  Object.entries(COMMON_HINTS).forEach(([code, hints]) => {
    let score = 0;
    for (const hint of hints) {
      if (normalized.includes(hint)) score += 1;
    }
    if (score > bestScore) {
      bestScore = score;
      bestCode = code;
    }
  });

  if (bestCode === 'auto' || bestScore === 0) return { code: 'auto', confidence: 0 };
  const confidence = Math.min(0.9, 0.45 + bestScore * 0.12);
  return { code: bestCode, confidence: Number(confidence.toFixed(2)) };
}
