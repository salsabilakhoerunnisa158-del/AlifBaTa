
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { QuizQuestion } from "../types";

const RETRY_DELAY = 1500;
const MAX_RETRIES = 2;

async function withRetry<T>(fn: () => Promise<T>, retries = MAX_RETRIES, delay = RETRY_DELAY): Promise<T> {
  try {
    return await fn();
  } catch (error: any) {
    const isQuotaError = error?.message?.includes('429') || error?.status === 429 || error?.code === 429;
    if (retries > 0 && isQuotaError) {
      await new Promise(resolve => setTimeout(resolve, delay));
      return withRetry(fn, retries - 1, delay * 2);
    }
    throw error;
  }
}

export const geminiService = {
  // Always use a new instance with the current API key
  getAI() {
    return new GoogleGenAI({ apiKey: process.env.API_KEY });
  },

  async generateQuizQuestions(category: string): Promise<QuizQuestion[]> {
    return withRetry(async () => {
      const ai = this.getAI();
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Generate exactly 10 multiple-choice quiz questions for children about Arabic vocabulary in the category: "${category}".
Return the response in a strictly valid JSON array of objects format.
Each object must have:
- "question": (string) "Apa bahasa Arabnya [Indonesian Word]?" or similar simple question in Indonesian.
- "arabicWord": (string) The word in Arabic script with harakat.
- "options": (array of 4 strings) 1 correct and 3 wrong options in Arabic transliteration (Latin).
- "correctAnswer": (string) The correct transliteration from options.
- "imagePrompt": (string) A simple English visual description like "a cute cartoon [word]".`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                question: { type: Type.STRING },
                arabicWord: { type: Type.STRING },
                options: { type: Type.ARRAY, items: { type: Type.STRING } },
                correctAnswer: { type: Type.STRING },
                imagePrompt: { type: Type.STRING }
              },
              required: ["question", "options", "correctAnswer", "arabicWord", "imagePrompt"]
            }
          }
        }
      });
      
      const text = response.text;
      if (!text) return [];
      const parsed = JSON.parse(text);
      return Array.isArray(parsed) ? parsed : [];
    }).catch(err => {
      console.error("AI quiz generation failed:", err);
      return []; // Return empty to trigger fallback in App.tsx
    });
  },

  async generateImage(prompt: string): Promise<string | undefined> {
    return withRetry(async () => {
      const ai = this.getAI();
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: {
          parts: [{ text: `Cute vibrant colorful 3D clay style cartoon illustration for children, centered, solid pastel background: ${prompt}` }],
        },
        config: {
          imageConfig: { aspectRatio: "1:1" }
        }
      });
      
      const part = response.candidates?.[0]?.content?.parts.find(p => p.inlineData);
      return part?.inlineData?.data;
    }).catch(err => {
      console.error("Image generation failed:", err);
      return undefined;
    });
  },

  async generateSpeech(text: string): Promise<string | undefined> {
    return withRetry(async () => {
      const ai = this.getAI();
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text: `Ucapkan dengan sangat jelas dan perlahan untuk anak-anak: ${text}` }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: 'Kore' }, 
            },
          },
        },
      });
      
      return response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    }).catch(err => {
      console.error("Speech generation failed:", err);
      return undefined;
    });
  },

  async getSurahTafsirForKids(surahName: string): Promise<string> {
    return withRetry(async () => {
      const ai = this.getAI();
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Ceritakan kisah atau makna Surah ${surahName} (Juz 30) untuk anak-anak. Gunakan bahasa yang sangat sederhana, penuh kasih, dan ceria. Maksimal 150 kata.`,
      });
      return response.text || "Cerita indah tentang surah ini akan segera hadir!";
    }).catch(err => {
      console.error("Tafsir fetch error:", err);
      return "Ustadz AI sedang beristirahat sebentar. Yuk baca Al-Qur'an dulu!";
    });
  }
};
