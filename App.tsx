
import React, { useState, useEffect, useRef } from 'react';
import { AppView, AppViewType, Surah, QuizQuestion, Verse, DailyPrayer } from './types';
import { JUZ_30_SURAHS, STATIC_QUIZ_DATA, DAILY_PRAYERS } from './constants';
import { geminiService } from './services/geminiService';
import { 
  BookOpen, 
  Gamepad2, 
  Trophy, 
  ArrowLeft, 
  CheckCircle2, 
  BrainCircuit,
  Volume2,
  VolumeX,
  ChevronRight,
  Sparkles,
  Loader2,
  X,
  AlertTriangle,
  Music,
  Heart,
  PlayCircle,
  Star,
  Key,
  Image as ImageIcon,
  Cloud,
  Moon,
  Sun,
  Dog,
  Apple,
  Home,
  Users,
  Palette,
  Hash,
  ExternalLink
} from 'lucide-react';

// --- Decorative Components ---
const BackgroundDecor: React.FC = () => (
  <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
    <div className="absolute top-[5%] left-[5%] star-blink text-yellow-300 opacity-30"><Star fill="currentColor" size={20} /></div>
    <div className="absolute top-[20%] right-[10%] star-blink text-blue-300 opacity-30" style={{ animationDelay: '0.5s' }}><Star fill="currentColor" size={24} /></div>
    <div className="absolute bottom-[15%] left-[10%] star-blink text-pink-300 opacity-30" style={{ animationDelay: '1.2s' }}><Star fill="currentColor" size={30} /></div>
    <div className="absolute top-[10%] right-[5%] floating text-emerald-100 opacity-40" style={{ animationDuration: '4s' }}><Cloud size={60} fill="currentColor" /></div>
    <div className="absolute bottom-[10%] left-[2%] floating text-sky-100 opacity-40" style={{ animationDuration: '6s' }}><Cloud size={90} fill="currentColor" /></div>
  </div>
);

// --- Helper to get Category Icon ---
const CategoryIcon: React.FC<{ category: string; size?: number }> = ({ category, size = 80 }) => {
  const props = { size, className: "text-white drop-shadow-md" };
  switch (category) {
    case 'Hewan Lucu': return <Dog {...props} />;
    case 'Buah Segar': return <Apple {...props} />;
    case 'Benda di Rumah': return <Home {...props} />;
    case 'Anggota Keluarga': return <Users {...props} />;
    case 'Warna-warni': return <Palette {...props} />;
    case 'Angka Arab': return <Hash {...props} />;
    default: return <ImageIcon {...props} />;
  }
};

const getCategoryColors = (category: string) => {
  switch (category) {
    case 'Hewan Lucu': return "from-rose-400 to-rose-500 shadow-rose-200";
    case 'Buah Segar': return "from-amber-400 to-amber-500 shadow-amber-200";
    case 'Benda di Rumah': return "from-emerald-400 to-emerald-500 shadow-emerald-200";
    case 'Anggota Keluarga': return "from-sky-400 to-sky-500 shadow-sky-200";
    case 'Warna-warni': return "from-purple-400 to-purple-500 shadow-purple-200";
    case 'Angka Arab': return "from-orange-400 to-orange-500 shadow-orange-200";
    default: return "from-emerald-400 to-emerald-500 shadow-emerald-200";
  }
};

// --- Helper for Audio Decoding ---
function decodeBase64(base64: string) {
  try {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  } catch (e) {
    console.error("Failed to decode base64", e);
    return new Uint8Array();
  }
}

async function decodeAudioData(data: Uint8Array, ctx: AudioContext, sampleRate: number, numChannels: number): Promise<AudioBuffer> {
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

// --- Sub-components ---
const Card: React.FC<{ children: React.ReactNode; className?: string; onClick?: () => void }> = ({ children, className = "", onClick }) => (
  <div 
    onClick={onClick}
    className={`bg-white rounded-[1.5rem] shadow-lg p-5 border-b-[8px] border-gray-100/50 active:translate-y-1 active:border-b-[2px] transition-all cursor-pointer relative overflow-hidden group ${className}`}
  >
    {children}
  </div>
);

const Button: React.FC<{ children: React.ReactNode; variant?: 'primary' | 'secondary' | 'danger' | 'info'; onClick?: () => void; className?: string; disabled?: boolean }> = ({ children, variant = 'primary', onClick, className = "", disabled }) => {
  const styles = {
    primary: "bg-emerald-400 hover:bg-emerald-500 border-emerald-600 text-white",
    secondary: "bg-amber-400 hover:bg-amber-500 border-amber-600 text-amber-900",
    danger: "bg-rose-400 hover:bg-rose-500 border-rose-600 text-white",
    info: "bg-sky-400 hover:bg-sky-500 border-sky-600 text-white"
  };

  return (
    <button 
      disabled={disabled}
      onClick={onClick}
      className={`px-6 py-3 rounded-[1.5rem] font-kids text-lg border-b-[6px] btn-chunky transition-all active:translate-y-1 active:border-b-[2px] ${styles[variant]} ${className} ${disabled ? 'opacity-50 grayscale cursor-not-allowed' : ''}`}
    >
      {children}
    </button>
  );
};

const App: React.FC = () => {
  const [view, setView] = useState<AppViewType>(AppView.LANDING);
  const [hasStarted, setHasStarted] = useState(false);
  const [showKeyPicker, setShowKeyPicker] = useState(false);
  const [selectedSurah, setSelectedSurah] = useState<Surah | null>(null);
  const [selectedPrayer, setSelectedPrayer] = useState<DailyPrayer | null>(null);
  const [prayerImage, setPrayerImage] = useState<string | null>(null);
  const [prayerAudio, setPrayerAudio] = useState<string | null>(null);
  
  const [hifzProgress, setHifzProgress] = useState<number[]>([]);
  const [currentQuiz, setCurrentQuiz] = useState<QuizQuestion[]>([]);
  const [currentCategory, setCurrentCategory] = useState<string>("");
  const [quizIndex, setQuizIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [loading, setLoading] = useState(false);
  const [itemLoading, setItemLoading] = useState(false);
  const [tafsir, setTafsir] = useState<string>("");
  const [verses, setVerses] = useState<Verse[]>([]);
  const [answering, setAnswering] = useState(false);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [errorNotice, setErrorNotice] = useState<string | null>(null);
  const [isPermissionError, setIsPermissionError] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [playingAyat, setPlayingAyat] = useState<number | null>(null);
  const [loadingAyat, setLoadingAyat] = useState<number | null>(null);
  
  const [correctAudio, setCorrectAudio] = useState<string | null>(null);
  const [wrongAudio, setWrongAudio] = useState<string | null>(null);
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const bgMusicRef = useRef<HTMLAudioElement | null>(null);
  const ayatAudioRef = useRef<HTMLAudioElement | null>(null);
  const clickAudioRef = useRef<HTMLAudioElement | null>(null);
  const correctSfxRef = useRef<HTMLAudioElement | null>(null);
  const wrongSfxRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('alifbata_hifz');
      if (saved) setHifzProgress(JSON.parse(saved));
    } catch (e) {
      console.error("LocalStorage error", e);
    }

    bgMusicRef.current = new Audio("https://cdn.pixabay.com/audio/2022/10/30/audio_517935f111.mp3"); 
    bgMusicRef.current.loop = true;
    bgMusicRef.current.volume = 0.08; 

    clickAudioRef.current = new Audio("https://assets.mixkit.co/active_storage/sfx/2571/2571-preview.mp3");
    clickAudioRef.current.volume = 0.2;

    correctSfxRef.current = new Audio("https://assets.mixkit.co/active_storage/sfx/1435/1435-preview.mp3");
    correctSfxRef.current.volume = 0.3;
    
    wrongSfxRef.current = new Audio("https://assets.mixkit.co/active_storage/sfx/2955/2955-preview.mp3");
    wrongSfxRef.current.volume = 0.2;

    return () => {
      [bgMusicRef, ayatAudioRef, clickAudioRef, correctSfxRef, wrongSfxRef].forEach(ref => {
        if (ref.current) {
          ref.current.pause();
          ref.current = null;
        }
      });
    };
  }, []);

  const playClick = () => {
    if (clickAudioRef.current) {
      clickAudioRef.current.currentTime = 0;
      clickAudioRef.current.play().catch(() => {});
    }
  };

  const handleStartApp = async () => {
    playClick();
    // Cek apakah key sudah terpilih
    const hasKey = await (window as any).aistudio?.hasSelectedApiKey();
    if (!hasKey) {
      setShowKeyPicker(true);
      return;
    }
    setHasStarted(true);
    if (bgMusicRef.current && !isMuted) {
      bgMusicRef.current.play().catch(e => console.log("Music play blocked", e));
    }
  };

  const handleSetKey = async () => {
    playClick();
    try {
      if (typeof (window as any).aistudio?.openSelectKey === 'function') {
        await (window as any).aistudio.openSelectKey();
        // Berdasarkan aturan, asumsikan sukses dan lanjut
        setShowKeyPicker(false);
        setHasStarted(true);
        setErrorNotice(null);
        setIsPermissionError(false);
        if (bgMusicRef.current && !isMuted) bgMusicRef.current.play().catch(() => {});
      }
    } catch (e) {
      console.error("Open key dialog failed", e);
    }
  };

  const toggleMusic = () => {
    playClick();
    if (!bgMusicRef.current) return;
    if (isMuted) {
      bgMusicRef.current.play().catch(() => {});
      setIsMuted(false);
    } else {
      bgMusicRef.current.pause();
      setIsMuted(true);
    }
  };

  const ensureMusicPlaying = () => {
    if (bgMusicRef.current && !isMuted && bgMusicRef.current.paused) {
      bgMusicRef.current.play().catch(() => {});
    }
  };

  const playArabicAudio = async (base64Audio: string) => {
    ensureMusicPlaying();
    if (!base64Audio) return;
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      }
      const ctx = audioContextRef.current;
      if (ctx.state === 'suspended') await ctx.resume();
      const audioBytes = decodeBase64(base64Audio);
      if (audioBytes.length === 0) return;
      const audioBuffer = await decodeAudioData(audioBytes, ctx, 24000, 1);
      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(ctx.destination);
      source.start();
    } catch (err) {
      console.error("Audio playback error:", err);
    }
  };

  const handleError = (err: any) => {
    const msg = err.message || "";
    if (msg === "PERMISSION_DENIED" || msg === "ENTITY_NOT_FOUND") {
      setIsPermissionError(true);
      setErrorNotice(msg === "ENTITY_NOT_FOUND" 
        ? "Kunci API tidak ditemukan atau tidak valid. Silakan pilih API Key dari project berbayar Anda." 
        : "Izin ditolak. Anda memerlukan API Key dari project berbayar untuk fitur ini."
      );
    } else {
      setErrorNotice("Ups! Sinyal sedang lemah. Coba lagi ya!");
    }
  };

  const openPrayerDetail = async (prayer: DailyPrayer) => {
    playClick();
    ensureMusicPlaying();
    setSelectedPrayer(prayer);
    setPrayerImage(null);
    setPrayerAudio(null);
    setErrorNotice(null);
    setIsPermissionError(false);
    setItemLoading(true);
    
    try {
      const [imgData, audioData] = await Promise.all([
        geminiService.generateImage(prayer.imagePrompt),
        geminiService.generateSpeech(prayer.arabic)
      ]);
      
      if (imgData) setPrayerImage(`data:image/png;base64,${imgData}`);
      if (audioData) {
        setPrayerAudio(audioData);
        playArabicAudio(audioData);
      }
    } catch (err: any) {
      console.error("Failed to load prayer media", err);
      handleError(err);
    } finally {
      setItemLoading(false);
    }
  };

  const startQuiz = async (category: string) => {
    playClick();
    ensureMusicPlaying();
    setLoading(true);
    setErrorNotice(null);
    setIsPermissionError(false);
    setCurrentCategory(category);
    
    try {
      let questions: QuizQuestion[] = [];
      try {
        questions = await geminiService.generateQuizQuestions(category);
      } catch (err: any) {
        handleError(err);
        questions = STATIC_QUIZ_DATA[category] || [];
      }
      
      setCurrentQuiz(questions);
      setQuizIndex(0);
      setScore(0);
      setSelectedOption(null);
      setAnswering(false);
      setView(AppView.QUIZ_GAME);

      geminiService.generateSpeech("Hebat! Benar!").then(s => s && setCorrectAudio(s)).catch(() => {});
      geminiService.generateSpeech("Kurang tepat. Coba lagi!").then(s => s && setWrongAudio(s)).catch(() => {});

      await loadQuizMedia(0, questions);
    } catch (err: any) {
      setErrorNotice("Gagal memulai kuis.");
    } finally {
      setLoading(false);
    }
  };

  const loadQuizMedia = async (index: number, questions: QuizQuestion[]) => {
    const q = questions[index];
    if (!q) return;
    setItemLoading(true);
    try {
      const results = await Promise.allSettled([
        geminiService.generateImage(q.imagePrompt),
        geminiService.generateSpeech(q.arabicWord)
      ]);
      const updatedQuiz = [...questions];
      const imgRes = results[0];
      const audioRes = results[1];
      const imgData = imgRes.status === 'fulfilled' ? imgRes.value : undefined;
      const audioData = audioRes.status === 'fulfilled' ? audioRes.value : undefined;
      updatedQuiz[index] = { 
        ...q, 
        generatedImage: imgData ? `data:image/png;base64,${imgData}` : undefined,
        audioData: audioData
      };
      setCurrentQuiz(updatedQuiz);
      if (audioData) playArabicAudio(audioData);
    } catch (err: any) {
      console.warn("Media load error handled");
    } finally {
      setItemLoading(false);
    }
  };

  const handleAnswer = async (answer: string) => {
    if (answering) return;
    setAnswering(true);
    setSelectedOption(answer);
    const isCorrect = answer === currentQuiz[quizIndex].correctAnswer;
    if (isCorrect) {
      setScore(s => s + 10);
      if (correctSfxRef.current) {
        correctSfxRef.current.currentTime = 0;
        correctSfxRef.current.play().catch(() => {});
      }
      if (correctAudio) setTimeout(() => playArabicAudio(correctAudio), 300);
    } else {
      if (wrongSfxRef.current) {
        wrongSfxRef.current.currentTime = 0;
        wrongSfxRef.current.play().catch(() => {});
      }
      if (wrongAudio) setTimeout(() => playArabicAudio(wrongAudio), 300);
    }
    setTimeout(() => {
      if (quizIndex < currentQuiz.length - 1) {
        const nextIndex = quizIndex + 1;
        setQuizIndex(nextIndex);
        setSelectedOption(null);
        setAnswering(false);
        loadQuizMedia(nextIndex, currentQuiz);
      } else {
        setView(AppView.ACHIEVEMENTS);
      }
    }, 2000);
  };

  const playAyatAudio = (index: number) => {
    playClick();
    ensureMusicPlaying();
    
    if (playingAyat === index) {
      if (ayatAudioRef.current) {
        ayatAudioRef.current.pause();
        ayatAudioRef.current = null;
        setPlayingAyat(null);
      }
      return;
    }

    setLoadingAyat(index);
    const audioUrl = verses[index].audio["05"] || verses[index].audio["01"];
    
    if (ayatAudioRef.current) {
      ayatAudioRef.current.pause();
      ayatAudioRef.current = null;
    }

    const audio = new Audio(audioUrl);
    audio.preload = "auto";
    ayatAudioRef.current = audio;

    audio.onplay = () => { 
      setLoadingAyat(null); 
      setPlayingAyat(index); 
    };
    
    audio.onended = () => { 
      setPlayingAyat(null); 
      ayatAudioRef.current = null;
    };
    
    audio.onerror = () => { 
      setLoadingAyat(null); 
      setErrorNotice("Gagal memutar murottal. Coba lagi.");
    };

    audio.play().catch((e) => {
      console.error("Playback failed", e);
      setLoadingAyat(null);
    });
  };

  const openSurahDetail = async (surah: Surah) => {
    playClick();
    ensureMusicPlaying();
    if (ayatAudioRef.current) {
      ayatAudioRef.current.pause();
      ayatAudioRef.current = null;
    }
    setPlayingAyat(null);
    setSelectedSurah(surah);
    setTafsir("");
    setVerses([]);
    setLoading(true);
    try {
      const [tafsirText, versesRes] = await Promise.all([
        geminiService.getSurahTafsirForKids(surah.transliteration).catch(() => "Ustadz sedang istirahat."),
        fetch(`https://equran.id/api/v2/surat/${surah.number}`).then(res => res.json())
      ]);
      setTafsir(tafsirText);
      setVerses(versesRes.data.ayat);
    } catch (err: any) {
      setErrorNotice("Gagal memuat surat.");
    } finally {
      setLoading(false);
    }
  };

  const toggleHifz = (surahNumber: number) => {
    playClick();
    const newProgress = hifzProgress.includes(surahNumber)
      ? hifzProgress.filter(n => n !== surahNumber)
      : [...hifzProgress, surahNumber];
    setHifzProgress(newProgress);
    localStorage.setItem('alifbata_hifz', JSON.stringify(newProgress));
  };

  // UI Pemilihan Kunci API (Mandatory)
  if (showKeyPicker || (!hasStarted && !showKeyPicker)) {
    return (
      <div className="fixed inset-0 bg-gradient-to-br from-emerald-400 to-sky-500 flex flex-col items-center justify-center p-6 text-white z-[100] overflow-hidden">
        <BackgroundDecor />
        <div className="bg-white/20 backdrop-blur-lg p-8 rounded-[3rem] shadow-xl mb-8 animate-in zoom-in duration-500 relative">
           <Sparkles size={80} className="text-white animate-pulse" />
        </div>
        <h1 className="text-4xl font-kids mb-2 text-center drop-shadow-lg">AlifBaTa Kids</h1>
        <div className="max-w-xs bg-white/10 backdrop-blur-sm border border-white/20 p-6 rounded-[2rem] text-center mb-8">
          <p className="text-sm mb-4 leading-relaxed font-sans">
            Untuk mengaktifkan fitur gambar & suara ceria, aplikasi membutuhkan akses API Key Anda.
          </p>
          <a 
            href="https://ai.google.dev/gemini-api/docs/billing" 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-xs text-yellow-200 underline flex items-center justify-center gap-1 mb-6 hover:text-white transition-colors"
          >
            Info Penagihan & API Key <ExternalLink size={12}/>
          </a>
          <button 
            onClick={showKeyPicker ? handleSetKey : handleStartApp}
            className="w-full bg-amber-400 text-amber-950 px-8 py-4 rounded-full font-kids text-xl shadow-[0_6px_0_rgb(180,120,0)] flex items-center justify-center gap-3 hover:translate-y-1 active:translate-y-4 active:shadow-none transition-all"
          >
            <Key size={24} /> {showKeyPicker ? "Pilih API Key 🔑" : "Ayo Mulai! 🚀"}
          </button>
        </div>
        {!showKeyPicker && (
          <p className="text-[10px] text-emerald-100 opacity-60">Gratis & Tanpa Iklan</p>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-10 max-w-lg mx-auto px-4 pt-6 relative z-10" onClick={ensureMusicPlaying}>
      <BackgroundDecor />
      
      {/* Navbar */}
      <div className="flex items-center justify-between mb-6 sticky top-2 z-50 bg-white/80 backdrop-blur-lg p-3 rounded-[2rem] border-2 border-white/50 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="bg-gradient-to-tr from-emerald-400 to-emerald-600 p-2 rounded-xl shadow-md cursor-pointer" onClick={() => { playClick(); setView(AppView.LANDING); setSelectedSurah(null); setSelectedPrayer(null); }}>
            <Sparkles className="text-white w-5 h-5" />
          </div>
          <h1 className="text-xl font-kids gradient-text">AlifBaTa</h1>
        </div>
        
        <div className="flex items-center gap-2">
          <button 
            onClick={toggleMusic}
            className={`p-3 rounded-xl shadow-sm transition-all active:scale-95 ${isMuted ? 'bg-gray-100 text-gray-400' : 'bg-amber-400 text-amber-900 border-2 border-amber-500/10'}`}
          >
            {isMuted ? <VolumeX className="w-5 h-5" /> : <Music className="w-5 h-5" />}
          </button>
          
          {view !== AppView.LANDING && (
            <button 
              onClick={() => {
                playClick();
                if (selectedSurah) setSelectedSurah(null);
                else if (selectedPrayer) setSelectedPrayer(null);
                else setView(AppView.LANDING);
              }}
              className="p-3 bg-white rounded-xl shadow-sm text-emerald-600 border-2 border-emerald-100"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {errorNotice && (
        <div className="bg-rose-50/90 backdrop-blur-sm border-2 border-rose-100 p-4 rounded-[1.5rem] mb-6 flex flex-col gap-3 animate-in slide-in-from-top-2 shadow-md relative z-20">
          <div className="flex items-center gap-3">
            <AlertTriangle className="text-rose-500 shrink-0" size={24} />
            <p className="text-rose-800 font-bold leading-tight font-sans text-sm flex-1">{errorNotice}</p>
            <button onClick={() => { playClick(); setErrorNotice(null); }}>
              <X size={20} className="text-rose-300" />
            </button>
          </div>
          {isPermissionError && (
            <div className="px-2 pb-2">
              <Button variant="danger" className="w-full text-sm py-2" onClick={handleSetKey}>
                Atur API Key (Pilih Lagi) 🔑
              </Button>
              <p className="text-[10px] text-rose-400 mt-2 text-center">Pastikan API Key berasal dari project dengan Billing yang aktif.</p>
            </div>
          )}
        </div>
      )}

      {/* Main Views */}
      {view === AppView.LANDING && (
        <div className="space-y-6 animate-in fade-in duration-500">
          <div className="bg-gradient-to-r from-emerald-400 to-emerald-500 rounded-[2rem] p-8 text-white shadow-xl relative overflow-hidden border-b-[8px] border-emerald-700/20">
            <h2 className="text-3xl font-kids mb-2 drop-shadow-sm">Assalamu'alaikum! 👋</h2>
            <p className="text-emerald-50 text-lg font-medium font-sans">
              Ayo kumpulkan bintang dan belajar hal seru!
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Card onClick={() => { playClick(); setView(AppView.QUIZ_MENU); }} className="border-amber-300 bg-amber-50 py-8 flex flex-col items-center">
              <div className="bg-amber-400 p-4 rounded-2xl mb-4 text-white shadow-lg">
                <Gamepad2 size={40} />
              </div>
              <h3 className="font-kids text-xl text-amber-800">Kuis</h3>
            </Card>

            <Card onClick={() => { playClick(); setView(AppView.JUZ_30); }} className="border-sky-300 bg-sky-50 py-8 flex flex-col items-center">
              <div className="bg-sky-400 p-4 rounded-2xl mb-4 text-white shadow-lg">
                <BookOpen size={40} />
              </div>
              <h3 className="font-kids text-xl text-sky-800">Juz 30</h3>
            </Card>
            
            <Card onClick={() => { playClick(); setView(AppView.DAILY_PRAYERS); }} className="col-span-2 border-rose-300 bg-rose-50 py-10 flex flex-col items-center">
              <div className="bg-rose-400 p-5 rounded-3xl mb-4 text-white shadow-lg rotate-3">
                <Sparkles size={48} className="text-white" />
              </div>
              <h3 className="font-kids text-2xl text-rose-800">Doa Harian</h3>
              <p className="text-rose-400 text-sm font-bold mt-2 uppercase">Bangun Tidur s/d Tidur Lagi</p>
            </Card>
          </div>

          <div className="bg-white/50 backdrop-blur-sm p-6 rounded-[2rem] border-2 border-white/50 shadow-lg">
            <h4 className="text-emerald-900 font-kids text-lg text-center mb-4">Pencapaian:</h4>
            <div className="flex justify-around items-center">
              <div className="text-center">
                <Heart className="text-emerald-500 mx-auto mb-1" fill="currentColor" size={24}/>
                <span className="block text-xl font-kids text-emerald-700">{hifzProgress.length} Hafal</span>
              </div>
              <div className="text-center">
                <Star className="text-amber-500 mx-auto mb-1" fill="currentColor" size={24}/>
                <span className="block text-xl font-kids text-amber-600">{score} Poin</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Doa Harian - List */}
      {view === AppView.DAILY_PRAYERS && !selectedPrayer && (
        <div className="space-y-4 animate-in slide-in-from-right duration-300">
          <h2 className="text-2xl font-kids text-rose-900 text-center mb-6">Doa Harian Anak Sholeh 🤲</h2>
          <div className="grid grid-cols-1 gap-3">
            {DAILY_PRAYERS.map((prayer) => (
              <button 
                key={prayer.id} 
                onClick={() => openPrayerDetail(prayer)}
                className="flex items-center justify-between p-5 rounded-[1.5rem] bg-white border-2 border-rose-100 border-b-[6px] active:translate-y-1 active:border-b-[2px] transition-all shadow-md group"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-rose-50 rounded-xl flex items-center justify-center text-rose-500 shadow-inner group-hover:scale-110 transition-transform">
                    <Sparkles size={24} />
                  </div>
                  <span className="text-lg font-kids text-gray-700">{prayer.title}</span>
                </div>
                <ChevronRight size={24} className="text-gray-300" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Doa Detail */}
      {selectedPrayer && (
        <div className="space-y-6 animate-in slide-in-from-bottom duration-500 pb-10">
          <div className="bg-white rounded-[2rem] p-6 shadow-lg border-b-[10px] border-rose-50 flex flex-col items-center">
            <h2 className="text-2xl font-kids text-rose-800 mb-6">{selectedPrayer.title}</h2>
            
            <div className="w-56 h-56 rounded-[2.5rem] mb-6 relative flex items-center justify-center shadow-md bg-gradient-to-br from-rose-100 to-rose-200 border-4 border-white shrink-0 overflow-hidden">
              {itemLoading ? (
                <div className="flex flex-col items-center gap-3">
                  <Loader2 className="animate-spin text-rose-400" size={40}/>
                  <p className="text-rose-400 font-kids text-sm animate-pulse">Menghias Gambar... ✨</p>
                </div>
              ) : prayerImage ? (
                <img src={prayerImage} alt="Visual" className="w-full h-full object-cover" />
              ) : (
                <div className="flex flex-col items-center">
                  <Sparkles size={80} className="text-rose-300 mb-2" />
                  <p className="text-[10px] text-rose-300 px-4 text-center">Gambar tidak tersedia</p>
                </div>
              )}
            </div>

            <div className="flex flex-col items-center w-full">
              <div className="font-arabic text-3xl text-center leading-loose text-emerald-700 mb-6 px-2 select-all" dir="rtl">
                {selectedPrayer.arabic}
              </div>
              
              <div className="flex items-center gap-4 mb-6">
                <button 
                  onClick={() => prayerAudio && playArabicAudio(prayerAudio)}
                  disabled={itemLoading || !prayerAudio}
                  className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-md active:translate-y-1 transition-all ${!prayerAudio ? 'bg-gray-100 text-gray-300' : 'bg-rose-400 text-white hover:bg-rose-500 shadow-rose-200 shadow-lg'}`}
                >
                  {itemLoading ? <Loader2 className="animate-spin" /> : <Volume2 size={28}/>}
                </button>
                <p className="text-rose-600 font-kids text-sm">{prayerAudio ? "Dengarkan Audio" : "Audio Belum Siap"}</p>
              </div>

              <div className="w-full space-y-4 text-center">
                <div className="p-4 bg-rose-50/50 rounded-2xl border-2 border-white">
                  <p className="text-rose-800 font-sans font-bold italic text-sm mb-1">{selectedPrayer.latin}</p>
                </div>
                <div className="p-4 bg-emerald-50/50 rounded-2xl border-2 border-white">
                  <h4 className="text-emerald-800 font-kids text-xs uppercase tracking-widest mb-2 opacity-50">Terjemahan</h4>
                  <p className="text-emerald-900 text-sm font-sans leading-relaxed">{selectedPrayer.translation}</p>
                </div>
              </div>
            </div>
          </div>
          
          <Button className="w-full text-xl py-6 rounded-full shadow-xl" onClick={() => setSelectedPrayer(null)} variant="primary">
            Kembali ke Daftar 📋
          </Button>
        </div>
      )}

      {/* Quiz Menu */}
      {view === AppView.QUIZ_MENU && (
        <div className="space-y-4 animate-in slide-in-from-right duration-300">
          <h2 className="text-2xl font-kids text-emerald-900 text-center mb-6">Pilih Tema Kuis 🗺️</h2>
          <div className="grid grid-cols-1 gap-3">
            {['Hewan Lucu', 'Buah Segar', 'Benda di Rumah', 'Anggota Keluarga', 'Warna-warni', 'Angka Arab'].map((cat, idx) => {
              const colors = ['bg-rose-50 border-rose-100', 'bg-amber-50 border-amber-100', 'bg-emerald-50 border-emerald-100', 'bg-sky-50 border-sky-100', 'bg-purple-50 border-purple-100', 'bg-orange-50 border-orange-100'];
              return (
                <button 
                  key={cat} 
                  disabled={loading}
                  onClick={() => startQuiz(cat)}
                  className={`flex items-center justify-between p-5 rounded-[1.5rem] border-b-[6px] active:translate-y-1 active:border-b-[2px] transition-all shadow-md ${colors[idx % colors.length]}`}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center shadow-sm">
                      {loading && currentCategory === cat ? <Loader2 className="animate-spin text-emerald-400" size={20}/> : <BrainCircuit size={24} className="text-emerald-600" />}
                    </div>
                    <span className="text-lg font-kids text-gray-700">{cat}</span>
                  </div>
                  <ChevronRight size={24} className="text-gray-300" />
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Quiz Game */}
      {view === AppView.QUIZ_GAME && currentQuiz[quizIndex] && (
        <div className="space-y-4 animate-in zoom-in-95 duration-300">
          <div className="flex items-center justify-between px-2">
            <div className="bg-white/90 px-5 py-2 rounded-full text-emerald-800 font-kids text-sm shadow-sm">
              Soal {quizIndex + 1} / {currentQuiz.length}
            </div>
            <div className="bg-amber-400 px-5 py-2 rounded-full text-amber-950 font-kids text-sm shadow-md border-b-4 border-amber-600">
              {score} ✨
            </div>
          </div>
          
          <div className="bg-white rounded-[2rem] p-5 shadow-lg text-center border-b-[10px] border-gray-100 relative overflow-hidden flex flex-col items-center">
            {itemLoading ? (
              <div className="flex flex-col items-center justify-center py-16 gap-4">
                <Music className="text-emerald-400 w-16 h-16 animate-bounce" />
                <p className="text-emerald-900 font-kids text-lg">Mencari Gambar... ✨</p>
              </div>
            ) : (
              <>
                <div className={`w-48 h-48 rounded-[2rem] mb-4 relative flex items-center justify-center shadow-md bg-gradient-to-br ${getCategoryColors(currentCategory)} border-4 border-white shrink-0`}>
                  {currentQuiz[quizIndex].generatedImage ? (
                    <img src={currentQuiz[quizIndex].generatedImage} alt="V" className="w-full h-full object-cover rounded-[1.6rem]" />
                  ) : (
                    <CategoryIcon category={currentCategory} size={60} />
                  )}
                </div>
                
                <div className="flex items-center justify-center gap-4 mb-3 h-16">
                  <div className="font-arabic text-5xl text-emerald-600 leading-none">{currentQuiz[quizIndex].arabicWord}</div>
                  <button 
                    onClick={() => currentQuiz[quizIndex].audioData && playArabicAudio(currentQuiz[quizIndex].audioData!)}
                    className="w-10 h-10 rounded-xl bg-emerald-400 text-white shadow-[0_4px_0_rgb(5,150,105)] active:translate-y-1 transition-all flex items-center justify-center"
                  >
                    <Volume2 size={20}/>
                  </button>
                </div>
                
                <h3 className="text-xl font-kids text-gray-800 leading-tight mb-2">
                  {currentQuiz[quizIndex].question}
                </h3>
              </>
            )}
          </div>

          <div className="grid grid-cols-1 gap-2.5 pt-2">
            {currentQuiz[quizIndex].options.map((option, i) => {
              const isSelected = selectedOption === option;
              const isCorrect = option === currentQuiz[quizIndex].correctAnswer;
              let btnStyle = "bg-white border-gray-100 text-gray-700";
              if (answering) {
                if (isCorrect) btnStyle = "bg-emerald-400 border-emerald-600 text-white scale-[1.02]";
                else if (isSelected) btnStyle = "bg-rose-400 border-rose-600 text-white";
                else btnStyle = "opacity-40 scale-95";
              }
              return (
                <button
                  key={i}
                  disabled={itemLoading || answering}
                  onClick={() => handleAnswer(option)}
                  className={`p-4 rounded-[1.5rem] border-2 border-b-[6px] text-lg font-kids shadow-sm transition-all text-left flex items-center gap-4 ${btnStyle}`}
                >
                  <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center text-sm font-kids text-gray-400">
                    {String.fromCharCode(65 + i)}
                  </div>
                  <span className="truncate">{option}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Juz 30 */}
      {view === AppView.JUZ_30 && !selectedSurah && (
        <div className="space-y-4 animate-in slide-in-from-bottom duration-500">
          <div className="bg-sky-400 rounded-[1.5rem] p-6 text-white shadow-lg border-b-[8px] border-sky-700/20">
             <h2 className="text-2xl font-kids mb-1">Hafalan Juz 30 ⭐</h2>
             <p className="text-sky-50 text-sm opacity-90 font-sans">Semangat menghafal!</p>
          </div>
          <div className="grid grid-cols-1 gap-3">
            {JUZ_30_SURAHS.map((surah) => (
              <div 
                key={surah.number} 
                onClick={() => openSurahDetail(surah)} 
                className="bg-white rounded-[1.5rem] p-5 shadow-sm border-b-[6px] border-gray-100 flex items-center gap-4 group active:translate-y-1 transition-all"
              >
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-sm font-kids border-2 ${hifzProgress.includes(surah.number) ? 'bg-emerald-400 border-emerald-500 text-white' : 'bg-gray-50 text-gray-300 border-gray-100'}`}>
                  {hifzProgress.includes(surah.number) ? <Heart fill="currentColor" size={16}/> : surah.number}
                </div>
                <div className="flex-1">
                  <h4 className="text-lg font-kids text-gray-700">{surah.transliteration}</h4>
                </div>
                <div className="font-arabic text-2xl text-emerald-600">{surah.name}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {selectedSurah && (
        <div className="space-y-4 animate-in slide-in-from-bottom-4 duration-500 pb-20">
          <div className="bg-white rounded-[2rem] p-6 shadow-md text-center border-b-[10px] border-emerald-50 flex flex-col items-center">
            <div className="font-arabic text-5xl text-emerald-600 mb-2">{selectedSurah.name}</div>
            <h2 className="text-2xl font-kids text-gray-800">{selectedSurah.transliteration}</h2>
            <p className="text-sm text-gray-400 italic">"{selectedSurah.translation}"</p>
          </div>

          <div className="bg-emerald-50/70 p-5 rounded-[1.5rem] border-2 border-white shadow-sm">
            <h3 className="text-base font-kids text-emerald-800 mb-2 flex items-center gap-2">
              <Sparkles size={16} className="text-amber-400"/> Kisah Singkat
            </h3>
            {loading ? <Loader2 className="animate-spin text-emerald-400 mx-auto" /> : <p className="text-emerald-900 text-sm font-sans leading-relaxed">{tafsir}</p>}
          </div>

          <div className="space-y-4 pt-4">
             {verses.map((v, i) => (
               <div key={i} className={`bg-white rounded-[1.5rem] p-5 shadow-md border-b-[6px] transition-all ${playingAyat === i ? 'border-amber-400 ring-2 ring-amber-100' : 'border-gray-100'}`}>
                 <div className="flex justify-between items-center mb-4">
                   <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center font-kids text-emerald-600 text-xs shadow-inner">{v.nomorAyat}</div>
                   <button 
                    onClick={() => playAyatAudio(i)}
                    className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-md active:translate-y-1 transition-all ${playingAyat === i ? 'bg-amber-400 text-white animate-pulse' : 'bg-emerald-400 text-white hover:bg-emerald-500'}`}
                   >
                     {loadingAyat === i ? <Loader2 className="animate-spin" size={18}/> : playingAyat === i ? <VolumeX size={20}/> : <Volume2 size={20}/>}
                   </button>
                 </div>
                 <div className="text-right font-arabic text-3xl leading-loose text-gray-800 mb-4 select-all" dir="rtl">{v.teksArab}</div>
                 <p className="text-gray-700 text-sm font-sans leading-snug font-medium italic mb-2">{v.teksLatin}</p>
                 <p className="text-gray-600 text-sm font-sans leading-relaxed">{v.teksIndonesia}</p>
               </div>
             ))}
          </div>

          <div className="fixed bottom-6 left-0 right-0 px-4 z-40 max-w-lg mx-auto">
            <Button className="w-full text-lg py-4 rounded-full shadow-2xl" onClick={() => toggleHifz(selectedSurah!.number)} variant={hifzProgress.includes(selectedSurah!.number) ? 'primary' : 'secondary'}>
              {hifzProgress.includes(selectedSurah!.number) ? 'Sudah Hafal! ✅' : 'Tandai Hafal 💖'}
            </Button>
          </div>
        </div>
      )}

      {view === AppView.ACHIEVEMENTS && (
        <div className="text-center space-y-10 pt-20 animate-in zoom-in-90 duration-500">
          <Trophy size={120} className="mx-auto text-amber-400 floating" />
          <div className="space-y-4">
            <h2 className="text-4xl font-kids text-gray-800">Maa Syaa Allah! 🎊</h2>
            <p className="text-2xl text-emerald-500 font-kids">Poinmu: {score}</p>
          </div>
          <div className="flex flex-col gap-4 max-w-xs mx-auto">
            <Button onClick={() => setView(AppView.QUIZ_MENU)} className="py-5">Main Lagi! 🎮</Button>
            <Button variant="secondary" onClick={() => setView(AppView.LANDING)} className="py-5">Menu Utama 🏠</Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
