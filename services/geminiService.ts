
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { QuizQuestion } from "../types";

const RETRY_DELAY = 1000;
const MAX_RETRIES = 1;

async function withRetry<T>(fn: () => Promise<T>, retries = MAX_RETRIES, delay = RETRY_DELAY): Promise<T> {
  try {
    return await fn();
  } catch (error: any) {
    const errorMsg = error?.message || "";
    const errorMsgLower = errorMsg.toLowerCase();
    
    // Aturan: Jika entitas tidak ditemukan, berarti project/key tidak valid atau belum disetup dengan benar
    const isEntityNotFound = errorMsgLower.includes('requested entity was not found');
    const isPermissionError = 
      errorMsgLower.includes('permission') || 
      errorMsgLower.includes('denied') || 
      errorMsgLower.includes('403') || 
      errorMsgLower.includes('404');
    
    if (isEntityNotFound) {
      console.error("Gemini API Error: Project/Entity not found. Need to re-select key.");
      throw new Error("ENTITY_NOT_FOUND");
    }

    if (isPermissionError) {
      console.warn("Gemini API Error (Permission/Key):", errorMsg);
      throw new Error("PERMISSION_DENIED");
    }

    if (retries > 0) {
      await new Promise(resolve => setTimeout(resolve, delay));
      return withRetry(fn, retries - 1, delay * 2);
    }
    
    throw error;
  }
}

export const geminiService = {
  async generateQuizQuestions(category: string): Promise<QuizQuestion[]> {
    return withRetry(async () => {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Generate exactly 10 multiple-choice quiz questions for children about Arabic vocabulary in the category: "${category}".
Return the response in a strictly valid JSON array of objects format.
Each object must have:
- "question": (string) "Apa bahasa Arabnya [Indonesian Word]?"
- "arabicWord": (string) The word in Arabic script with harakat.
- "options": (array of 4 strings) in Latin.
- "correctAnswer": (string) The correct Latin transliteration.
- "imagePrompt": (string) A simple visual description.`,
        config: {
          thinkingConfig: { thinkingBudget: 0 },
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
    });
  },

  async generateImage(prompt: string): Promise<string | undefined> {
    return withRetry(async () => {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-3-pro-image-preview',
        contents: {
          parts: [{ text: `High quality children's book illustration, vibrant colors, soft 3D digital art style, clean lines, simple background, joyful atmosphere: ${prompt}` }],
        },
        config: {
          imageConfig: { aspectRatio: "1:1", imageSize: "1K" }
        }
      });
      
      const part = response.candidates?.[0]?.content?.parts.find(p => p.inlineData);
      return part?.inlineData?.data;
    });
  },

  async generateSpeech(text: string): Promise<string | undefined> {
    return withRetry(async () => {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text: `Sebutkan dengan suara anak-anak yang ceria dan perlahan: ${text}` }] }],
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
    });
  },

  async getSurahTafsirForKids(surahName: string): Promise<string> {
    return withRetry(async () => {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Jelaskan kisah singkat dan menarik dari Surah ${surahName} untuk anak-anak TK/SD. Gunakan bahasa yang ceria dan mendidik (maks 80 kata).`,
      });
      return response.text || "Cerita indah tentang surat ini akan segera muncul!";
    });
  }
};
