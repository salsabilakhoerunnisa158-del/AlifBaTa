
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { QuizQuestion } from "../types";

// Fungsi untuk decode base64 string ke Uint8Array secara manual
function decodeBase64(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

// Fungsi untuk decode data PCM 16-bit ke AudioBuffer (24kHz Mono)
async function decodePCMToAudioBuffer(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number = 24000
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length;
  const buffer = ctx.createBuffer(1, frameCount, sampleRate);
  const channelData = buffer.getChannelData(0);

  for (let i = 0; i < frameCount; i++) {
    // Normalisasi int16 (-32768 s/d 32767) ke float (-1.0 s/d 1.0)
    channelData[i] = dataInt16[i] / 32768.0;
  }
  return buffer;
}

export const geminiService = {
  async generateQuizQuestions(category: string): Promise<QuizQuestion[]> {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Buat 5 soal kuis pilihan ganda untuk anak-anak tentang kosakata bahasa Arab kategori: "${category}". 
Format respons harus JSON array.
Contoh: { "question": "Apa bahasa Arabnya Gajah?", "arabicWord": "فِيْلٌ", "options": ["Fiilun", "Asadun", "Qittun", "Jamalun"], "correctAnswer": "Fiilun", "imagePrompt": "cute elephant cartoon" }`,
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
          parts: [{ text: `A very simple, cute, flat 2D vector cartoon illustration of ${prompt} for kids, bright friendly colors, white background, high quality.` }],
        },
        config: {
          imageConfig: { aspectRatio: "1:1" }
        }
      });
      
      const part = response.candidates?.[0]?.content?.parts.find(p => p.inlineData);
      return part?.inlineData?.data;
    } catch (e) {
      console.error("Gagal membuat gambar:", e);
      return undefined;
    }
  },

  async playSpeech(text: string, audioCtx: AudioContext) {
    try {
      if (audioCtx.state === 'suspended') await audioCtx.resume();
      
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text: text }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: 'Kore' }, 
            },
          },
        },
      });
      
      const base64Data = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (base64Data) {
        const pcmData = decodeBase64(base64Data);
        const audioBuffer = await decodePCMToAudioBuffer(pcmData, audioCtx);
        const source = audioCtx.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(audioCtx.destination);
        source.start();
      }
    } catch (e) {
      console.error("Gagal memutar audio:", e);
    }
  },

  async getSurahTafsirForKids(surahName: string): Promise<string> {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Tuliskan pesan moral/pelajaran singkat dari Surah ${surahName} untuk anak-anak dalam 2 kalimat saja. Gunakan bahasa yang ceria.`,
    });
    return response.text || "Semoga kita selalu disayang Allah.";
  }
};
