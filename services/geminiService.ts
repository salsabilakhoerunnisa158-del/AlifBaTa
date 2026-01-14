
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
async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number = 24000,
  numChannels: number = 1
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer, data.byteOffset, data.byteLength / 2);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

// Pemetaan kata kunci untuk mendapatkan ikon yang paling relevan dari Icons8 Plasticine
const ICON_MAPPING: Record<string, string> = {
  // Hewan
  'qittun': 'cat', 'kalbun': 'dog', 'asadun': 'lion', 'fiilun': 'elephant', 
  'jamalun': 'camel', 'arnabun': 'rabbit', 'thairun': 'bird', 'samakun': 'fish',
  'hishaanun': 'horse', 'baqaratun': 'cow', 'qirdun': 'monkey',
  // Buah
  'tuffahatun': 'apple', 'mauzun': 'banana', 'burtuqalun': 'orange', 'inabun': 'grapes',
  'bitthikhun': 'watermelon', 'tamrun': 'date-fruit', 'ananasun': 'pineapple',
  'rummaanun': 'pomegranate', 'farawilatun': 'strawberry', 'manju': 'mango',
  // Benda
  'baabun': 'door', 'nafidzatun': 'window', 'kursiyyun': 'chair', 'maktabun': 'desk',
  'sariirun': 'bed', 'misbaahun': 'lamp', 'miftahun': 'key', 'mirwahatun': 'fan',
  'saa\'atun': 'clock', 'haatifun': 'phone',
  // Kendaraan
  'sayyaratun': 'car', 'thairatun': 'airplane', 'safinatun': 'ship', 'hafilatun': 'bus',
  'qitharun': 'train', 'darrajatun': 'bicycle',
};

export const geminiService = {
  async generateQuizQuestions(category: string): Promise<QuizQuestion[]> {
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Buatlah 10 soal pilihan ganda tentang kosakata bahasa Arab untuk anak-anak kecil dengan tema: "${category}". 
        Pertanyaan dalam Bahasa Indonesia yang sederhana. 
        Pilihan jawaban dalam transliterasi Latin (lowercase). 
        Sertakan kata Arab asli.
        PENTING: Gunakan correctAnswer sebagai kunci utama untuk gambar.
        Format JSON: [{ "question": string, "arabicWord": string, "options": string[], "correctAnswer": string, "imagePrompt": string }]`,
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
      if (e.status === 429 || e.message?.includes('quota')) throw new Error('QUOTA_EXCEEDED');
      throw e;
    }
  },

  /**
   * Menggunakan Icons8 Plasticine (Gaya 3D Kartun) yang gratis dan sangat menarik untuk anak.
   * Tidak membutuhkan API Key sehingga sangat stabil.
   */
  async generateImage(prompt: string): Promise<string | undefined> {
    const key = prompt.toLowerCase().trim();
    const searchTerm = ICON_MAPPING[key] || key.split(' ')[0];
    
    // Icons8 Plasticine style sangat konsisten dan seperti mainan 3D, sangat disukai anak-anak.
    return `https://img.icons8.com/plasticine/400/${encodeURIComponent(searchTerm)}.png`;
  },

  playNarrator(text: string) {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'id-ID';
    utterance.rate = 1.0;
    utterance.pitch = 1.3;
    window.speechSynthesis.speak(utterance);
  },

  async playSpeech(text: string, ctx: AudioContext) {
    try {
      if (ctx.state === 'suspended') await ctx.resume();
      
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text: `Ucapkan kata ini dalam bahasa Arab dengan sangat jelas: ${text}` }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: { 
            voiceConfig: { 
              prebuiltVoiceConfig: { voiceName: 'Kore' } 
            } 
          },
        },
      });
      
      const base64 = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (base64) {
        const audioBuffer = await decodeAudioData(decodeBase64(base64), ctx);
        const source = ctx.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(ctx.destination);
        source.start(0);
      }
    } catch (e: any) {
      console.warn("TTS Gemini Gagal, menggunakan suara sistem:", e.message);
      if ('speechSynthesis' in window) {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'ar-SA';
        utterance.rate = 0.8;
        window.speechSynthesis.speak(utterance);
      }
    }
  }
};
