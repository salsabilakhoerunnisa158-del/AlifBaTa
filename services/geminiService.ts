
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { QuizQuestion } from "../types";

// Helper: Decode base64 ke Uint8Array (Manual implementation as requested)
function decode(base64: string): Uint8Array {
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
  const dataInt16 = new Int16Array(data.buffer);
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
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Buatlah 10 soal pilihan ganda tentang kosakata bahasa Arab untuk anak-anak kecil dengan tema: "${category}". 
        Pertanyaan dalam Bahasa Indonesia yang sangat sederhana. 
        Pilihan jawaban dalam transliterasi Latin yang mudah dibaca anak-anak. 
        Sertakan kata Arab asli.
        Berikan "imagePrompt" yang mendeskripsikan objek tersebut dalam gaya kartun 3D yang sangat lucu dan berwarna-warni (Disney/Pixar style).
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
      console.error("Quiz generation error:", e);
      throw e;
    }
  },

  async generateImage(prompt: string): Promise<string | undefined> {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: {
          parts: [{ text: `A high-quality, ultra-cute 3D cartoon object of ${prompt}. Pixar style, soft lighting, pastel background, vibrant colors, kid-friendly.` }],
        },
        config: {
          imageConfig: {
            aspectRatio: "1:1"
          }
        }
      });

      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
          return `data:image/png;base64,${part.inlineData.data}`;
        }
      }
      throw new Error("No image data in response");
    } catch (e) {
      console.warn("Gemini Image generation failed, using fallback Icons8:", e);
      // Fallback ke Icons8 Plasticine jika Gemini gagal (biasanya karena limit atau safety filter)
      const searchTerm = prompt.toLowerCase().split(' ').pop() || 'star';
      return `https://img.icons8.com/plasticine/400/${encodeURIComponent(searchTerm)}.png`;
    }
  },

  async playSpeech(text: string, ctx: AudioContext): Promise<void> {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    try {
      // Pastikan AudioContext di-resume karena kebijakan browser sering mem-pause secara otomatis
      if (ctx.state === 'suspended') {
        await ctx.resume();
      }
      
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text: `Say this Arabic word clearly for a child: ${text}` }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: 'Kore' }
            }
          },
        },
      });

      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (base64Audio) {
        const audioBuffer = await decodeAudioData(decode(base64Audio), ctx, 24000, 1);
        const source = ctx.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(ctx.destination);
        source.start(0);
      } else {
        throw new Error("No audio data in response");
      }
    } catch (e: any) {
      console.warn("TTS Gemini Gagal, menggunakan suara sistem browser:", e);
      // Fallback ke Web Speech API jika Gemini TTS gagal
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'ar-SA';
        utterance.rate = 0.8;
        window.speechSynthesis.speak(utterance);
      }
    }
  },

  playNarrator(text: string) {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'id-ID';
    utterance.rate = 1.1;
    utterance.pitch = 1.2;
    window.speechSynthesis.speak(utterance);
  }
};
