
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { QuizQuestion } from "../types";

// Helper: Decode base64 ke Uint8Array
function decodeBase64(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

// Helper: Decode Raw PCM 16-bit ke AudioBuffer
async function decodePCM(data: Uint8Array, ctx: AudioContext, sampleRate: number = 24000): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const buffer = ctx.createBuffer(1, dataInt16.length, sampleRate);
  const channelData = buffer.getChannelData(0);
  for (let i = 0; i < dataInt16.length; i++) {
    channelData[i] = dataInt16[i] / 32768.0;
  }
  return buffer;
}

export const geminiService = {
  async generateQuizQuestions(category: string): Promise<QuizQuestion[]> {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Buat 5 soal kuis pilihan ganda bahasa Arab kategori: "${category}". 
Gunakan bahasa Indonesia untuk pertanyaan.
Format: JSON array of objects { question, arabicWord, options, correctAnswer, imagePrompt }.`,
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
    return JSON.parse(response.text || "[]");
  },

  async generateImage(prompt: string): Promise<string | undefined> {
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: {
          parts: [{ text: `A simple, super cute cartoon 3D illustration of ${prompt} for children, white background, bright colors, very clear shapes.` }],
        },
        config: { imageConfig: { aspectRatio: "1:1" } }
      });
      const part = response.candidates?.[0]?.content?.parts.find(p => p.inlineData);
      return part?.inlineData?.data;
    } catch (e) {
      return undefined;
    }
  },

  async playSpeech(text: string, ctx: AudioContext) {
    try {
      if (ctx.state === 'suspended') await ctx.resume();
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } },
        },
      });
      const base64 = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (base64) {
        const audioBuffer = await decodePCM(decodeBase64(base64), ctx);
        const source = ctx.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(ctx.destination);
        source.start();
      }
    } catch (e) {
      console.error("Audio error", e);
    }
  },

  async getSurahTafsir(surah: string): Promise<string> {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Pesan moral singkat Surah ${surah} untuk anak kecil (maks 30 kata).`,
    });
    return response.text || "Surat yang sangat indah.";
  }
};
