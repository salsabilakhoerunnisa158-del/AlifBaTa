
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
    
    // Deteksi masalah API Key / Project
    const isEntityNotFound = errorMsgLower.includes('requested entity was not found');
    const isPermissionError = 
      errorMsgLower.includes('permission') || 
      errorMsgLower.includes('denied') || 
      errorMsgLower.includes('403') || 
      errorMsgLower.includes('404') ||
      errorMsgLower.includes('api_key_invalid');
    
    if (isEntityNotFound) {
      throw new Error("ENTITY_NOT_FOUND");
    }

    if (isPermissionError) {
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
Include: question, arabicWord, options, correctAnswer, imagePrompt.`,
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
      return JSON.parse(text || "[]");
    });
  },

  async generateImage(prompt: string): Promise<string | undefined> {
    // Mencoba model Pro terlebih dahulu, jika gagal (misal: bukan paid key), biarkan UI menggunakan fallback icon
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-3-pro-image-preview',
        contents: {
          parts: [{ text: `Cute 3D cartoon style for kids: ${prompt}. White background.` }],
        },
        config: {
          imageConfig: { aspectRatio: "1:1", imageSize: "1K" }
        }
      });
      
      const part = response.candidates?.[0]?.content?.parts.find(p => p.inlineData);
      return part?.inlineData?.data;
    } catch (e) {
      console.warn("Image generation failed, using fallback icon.");
      return undefined; 
    }
  },

  async generateSpeech(text: string): Promise<string | undefined> {
    return withRetry(async () => {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text: `Ucapkan dengan jelas dan ceria: ${text}` }] }],
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
        contents: `Apa pelajaran dari Surah ${surahName} untuk anak kecil? Gunakan bahasa yang sangat sederhana (maks 60 kata).`,
      });
      return response.text || "Cerita indah akan segera hadir!";
    });
  }
};
