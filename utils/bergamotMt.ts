interface BergamotTranslator {
  translate(input: {
    text: string;
    sourceLanguage: string;
    targetLanguage: string;
  }): Promise<{ text?: string } | string>;
}

declare global {
  interface Window {
    BergamotTranslator?: BergamotTranslator;
  }
}

export const translateWithBergamotIfAvailable = async (
  text: string,
  sourceLang: string,
  targetLang: string,
): Promise<string | null> => {
  if (typeof window === 'undefined') return null;
  const translator = window.BergamotTranslator;
  if (!translator || typeof translator.translate !== 'function') {
    return null;
  }

  const trimmed = text.trim();
  if (!trimmed) return '';

  try {
    const result = await translator.translate({
      text: trimmed,
      sourceLanguage: sourceLang,
      targetLanguage: targetLang,
    });
    if (typeof result === 'string') return result;
    if (result && typeof result.text === 'string') return result.text;
    return null;
  } catch {
    return null;
  }
};

