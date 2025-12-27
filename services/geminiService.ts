
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { QuizQuestion } from "../types";

const RETRY_DELAY = 2000;
const MAX_RETRIES = 3;

async function withRetry<T>(fn: () => Promise<T>, retries = MAX_RETRIES, delay = RETRY_DELAY): Promise<T> {
  try {
    return await fn();
  } catch (error: any) {
    const isQuotaError = error?.message?.includes('429') || error?.status === 429 || error?.code === 429;
    if (retries > 0 && isQuotaError) {
      console.warn(`Quota exceeded. Retrying in ${delay}ms... (${retries} retries left)`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return withRetry(fn, retries - 1, delay * 2);
    }
    throw error;
  }
}

export const geminiService = {
  getAI() {
    return new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
  },

  async generateQuizQuestions(category: string): Promise<QuizQuestion[]> {
    return withRetry(async () => {
      const ai = this.getAI();
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Buat 10 pertanyaan kuis kosakata Bahasa Arab untuk anak-anak tentang kategori: ${category}.
Setiap pertanyaan harus memiliki 4 pilihan jawaban dan 1 jawaban benar. 
Pastikan kosakata yang dipilih umum dan mudah dipahami anak-anak.
Berikan 'imagePrompt' berupa deskripsi singkat bahasa Inggris untuk menggambar kata tersebut (misal: 'a cute cartoon cat').`,
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
      
      return JSON.parse(response.text || '[]');
    }).catch(err => {
      console.error("Final quiz generation error:", err);
      return [];
    });
  },

  async generateImage(prompt: string): Promise<string | undefined> {
    return withRetry(async () => {
      const ai = this.getAI();
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: {
          parts: [{ text: `Cute, vibrant colorful 3D clay style cartoon illustration for kids, isolated on solid background: ${prompt}` }],
        },
        config: {
          imageConfig: { aspectRatio: "1:1" }
        }
      });
      
      const part = response.candidates?.[0]?.content?.parts.find(p => p.inlineData);
      return part?.inlineData?.data;
    }).catch(err => {
      console.error("Image generation failed after retries:", err);
      return undefined;
    });
  },

  async generateSpeech(text: string): Promise<string | undefined> {
    return withRetry(async () => {
      const ai = this.getAI();
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text: `Sebutkan kosakata bahasa arab ini dengan perlahan dan jelas untuk belajar anak: ${text}` }] }],
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
      console.error("Speech generation failed after retries:", err);
      return undefined;
    });
  },

  async getSurahTafsirForKids(surahName: string): Promise<string> {
    return withRetry(async () => {
      const ai = this.getAI();
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Jelaskan makna atau kisah di balik Surah ${surahName} dalam Juz 30 kepada anak berusia 7 tahun dengan bahasa yang sederhana, ceria, dan penuh hikmah. Maksimal 3 paragraf pendek.`,
      });
      return response.text || "Tafsir tidak tersedia.";
    }).catch(err => {
      console.error("Tafsir fetch error:", err);
      return "Maaf, Ustadz AI sedang beristirahat. Yuk baca Al-Qur'an dulu!";
    });
  }
};
