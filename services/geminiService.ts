
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

export const geminiService = {
  async generateQuizQuestions(category: string): Promise<QuizQuestion[]> {
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Buatlah 10 soal pilihan ganda tentang kosakata bahasa Arab untuk anak-anak dengan tema: "${category}". 
        Pertanyaan dalam Bahasa Indonesia. Pilihan jawaban dalam transliterasi Latin. 
        Sertakan kata Arab asli dan prompt gambar digital art yang ceria.
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

  async generateImage(prompt: string): Promise<string | undefined> {
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: {
          parts: [{ text: `Cute 3D Pixar style cartoon of ${prompt}, white background, bright colors, for kids.` }],
        },
        config: { imageConfig: { aspectRatio: "1:1" } }
      });
      const part = response.candidates?.[0]?.content?.parts.find(p => p.inlineData);
      return part?.inlineData?.data;
    } catch (e) {
      return undefined;
    }
  },

  /**
   * Narator Suara (Native)
   * Digunakan untuk feedback agar hemat kuota API
   */
  playNarrator(text: string) {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'id-ID';
    utterance.rate = 1.0;
    utterance.pitch = 1.3; // Suara ceria
    window.speechSynthesis.speak(utterance);
  },

  /**
   * Suara Bahasa Arab (Gemini TTS)
   */
  async playSpeech(text: string, ctx: AudioContext) {
    try {
      if (ctx.state === 'suspended') await ctx.resume();
      
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text: `Ucapkan kata ini dalam bahasa Arab dengan sangat jelas, perlahan, dan ramah seperti guru taman kanak-kanak: ${text}` }] }],
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
      // Fallback ke Web Speech API jika API Gemini sibuk atau error
      if ('speechSynthesis' in window) {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'ar-SA';
        utterance.rate = 0.8;
        window.speechSynthesis.speak(utterance);
      }
    }
  }
};
