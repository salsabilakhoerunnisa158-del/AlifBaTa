
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { QuizQuestion } from "../types";

const RETRY_DELAY = 1000;
const MAX_RETRIES = 1;

async function withRetry<T>(fn: () => Promise<T>, retries = MAX_RETRIES, delay = RETRY_DELAY): Promise<T> {
  try {
    return await fn();
  } catch (error: any) {
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
        contents: `Generate exactly 5 multiple-choice quiz questions for children about Arabic vocabulary in the category: "${category}".
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
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      // Gunakan prompt yang sangat spesifik dan aman untuk anak-anak
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: {
          parts: [{ text: `A cute colorful cartoon illustration of ${prompt}, high quality, clean white background, simple shapes, 3D style for kids, no text, no words.` }],
        },
        config: {
          imageConfig: { aspectRatio: "1:1" }
        }
      });
      
      const part = response.candidates?.[0]?.content?.parts.find(p => p.inlineData);
      return part?.inlineData?.data;
    } catch (e) {
      console.error("Image gen failed, trying fallback:", prompt, e);
      try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const retryResponse = await ai.models.generateContent({
          model: 'gemini-2.5-flash-image',
          contents: {
            parts: [{ text: `Simple drawing of ${prompt} for children.` }],
          }
        });
        const retryPart = retryResponse.candidates?.[0]?.content?.parts.find(p => p.inlineData);
        return retryPart?.inlineData?.data;
      } catch (innerE) {
        return undefined;
      }
    }
  },

  async generateSpeech(text: string): Promise<string | undefined> {
    return withRetry(async () => {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text: `Ucapkan dengan ceria: ${text}` }] }],
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
        contents: `Apa pelajaran dari Surah ${surahName} untuk anak kecil? Gunakan bahasa yang sangat sederhana (maks 50 kata).`,
      });
      return response.text || "Pelajaran indah dari Allah.";
    });
  }
};
