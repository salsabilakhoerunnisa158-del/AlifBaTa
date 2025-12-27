
export interface ArabicWord {
  arabic: string;
  latin: string;
  meaning: string;
  category: string;
  image: string;
}

export interface Verse {
  nomorAyat: number;
  teksArab: string;
  teksLatin: string;
  teksIndonesia: string;
  audio: {
    "01": string; // Mishary Rashid Al-Afasy
  };
}

export interface QuizQuestion {
  question: string;
  options: string[];
  correctAnswer: string;
  arabicWord: string;
  imagePrompt: string; 
  generatedImage?: string; 
  audioData?: string; 
}

export interface Surah {
  number: number;
  name: string;
  transliteration: string;
  translation: string;
  totalVerses: number;
  revelationType: 'Meccan' | 'Medinan';
}

export const AppView = {
  LANDING: 'LANDING',
  QUIZ_MENU: 'QUIZ_MENU',
  QUIZ_GAME: 'QUIZ_GAME',
  JUZ_30: 'JUZ_30',
  ACHIEVEMENTS: 'ACHIEVEMENTS'
} as const;

export type AppViewType = typeof AppView[keyof typeof AppView];
