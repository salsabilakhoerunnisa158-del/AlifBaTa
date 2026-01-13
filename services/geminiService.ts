
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { QuizQuestion } from "../types";

// Helper: Decode base64 ke Uint8Array (Metode manual sesuai regulasi)
function decodeBase64(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

// Helper: Decode Raw PCM 16-bit ke AudioBuffer (Sesuai panduan teknis Gemini)
async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number = 24000,
  numChannels: number = 1
): Promise<AudioBuffer> {
  // Pastikan data buffer selaras dengan Int16 (2 bytes per sample)
  const dataInt16 = new Int16Array(data.buffer, data.byteOffset, data.byteLength / 2);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      // Normalisasi PCM 16-bit ke Float32
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

export const geminiService = {
  async generateQuizQuestions(category: string): Promise<QuizQuestion[]> {
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Generate 5 multiple choice questions for kids about Arabic vocabulary for "${category}". 
        Return strictly JSON array: [{ question, arabicWord, options, correctAnswer, imagePrompt }]`,
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
    } catch (e: any) {
      if (e.message?.includes('quota')) throw new Error('QUOTA_EXCEEDED');
      throw e;
    }
  },

  async generateImage(prompt: string): Promise<string | undefined> {
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: {
          parts: [{ text: `A simple, super cute 3D cartoon style illustration of ${prompt}, isolated on white background, bright happy colors, high resolution.` }],
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
        const audioBuffer = await decodeAudioData(decodeBase64(base64), ctx);
        const source = ctx.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(ctx.destination);
        source.start();
      }
    } catch (e) {
      console.error("Audio playback error:", e);
    }
  },

  async getSurahTafsir(surah: string): Promise<string> {
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Apa pelajaran utama dari Surah ${surah} untuk anak-anak kecil? Jawab dalam 25 kata maksimal.`,
      });
      return response.text || "Pesan kasih sayang Allah.";
    } catch {
      return "Surat yang penuh berkah dari Allah.";
    }
  }
};
