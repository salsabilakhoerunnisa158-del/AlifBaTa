
import React, { useState, useEffect, useRef } from 'react';
import { AppView, AppViewType, Surah, QuizQuestion, Verse } from './types';
import { JUZ_30_SURAHS, STATIC_QUIZ_DATA } from './constants';
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
  Hash
} from 'lucide-react';

// --- Decorative Components ---
const BackgroundDecor: React.FC = () => (
  <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
    <div className="absolute top-[10%] left-[10%] star-blink text-yellow-300 opacity-40"><Star fill="currentColor" size={24} /></div>
    <div className="absolute top-[25%] right-[15%] star-blink text-blue-300 opacity-40" style={{ animationDelay: '0.5s' }}><Star fill="currentColor" size={32} /></div>
    <div className="absolute bottom-[20%] left-[15%] star-blink text-pink-300 opacity-40" style={{ animationDelay: '1.2s' }}><Star fill="currentColor" size={40} /></div>
    <div className="absolute bottom-[40%] right-[10%] star-blink text-purple-300 opacity-40" style={{ animationDelay: '0.8s' }}><Star fill="currentColor" size={20} /></div>
    
    <div className="absolute top-[5%] right-[5%] floating text-emerald-100 opacity-50" style={{ animationDuration: '4s' }}><Cloud size={100} fill="currentColor" /></div>
    <div className="absolute bottom-[10%] left-[2%] floating text-sky-100 opacity-50" style={{ animationDuration: '6s' }}><Cloud size={140} fill="currentColor" /></div>
  </div>
);

// --- Helper to get Category Icon ---
const CategoryIcon: React.FC<{ category: string; size?: number }> = ({ category, size = 120 }) => {
  const props = { size, className: "text-white drop-shadow-lg" };
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
    className={`bg-white rounded-[2.5rem] shadow-xl p-6 border-b-[12px] border-gray-100/50 active:translate-y-2 active:border-b-[4px] transition-all cursor-pointer relative overflow-hidden group ${className}`}
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
      className={`px-8 py-4 rounded-[2rem] font-kids text-xl border-b-[8px] btn-chunky transition-all active:translate-y-1 active:border-b-[2px] ${styles[variant]} ${className} ${disabled ? 'opacity-50 grayscale cursor-not-allowed' : ''}`}
    >
      {children}
    </button>
  );
};

const App: React.FC = () => {
  const [view, setView] = useState<AppViewType>(AppView.LANDING);
  const [hasStarted, setHasStarted] = useState(false);
  const [selectedSurah, setSelectedSurah] = useState<Surah | null>(null);
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
    bgMusicRef.current.volume = 0.1; 

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

  const handleStartApp = () => {
    setHasStarted(true);
    playClick();
    if (bgMusicRef.current && !isMuted) {
      bgMusicRef.current.play().catch(e => console.log("Music play blocked", e));
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

  const handleSetKey = async () => {
    playClick();
    try {
      if (typeof (window as any).aistudio?.openSelectKey === 'function') {
        await (window as any).aistudio.openSelectKey();
        setErrorNotice(null);
        setIsPermissionError(false);
      } else {
        alert("Fitur pemilihan kunci hanya tersedia di lingkungan AI Studio.");
      }
    } catch (e) {
      console.error("Open key dialog failed", e);
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
        if (err.message === "PERMISSION_DENIED") {
          setIsPermissionError(true);
          setErrorNotice("Izin Kunci API tidak lengkap. Menggunakan soal cadangan.");
        } else {
          setErrorNotice("Gemini sedang sibuk. Pakai soal cadangan dulu ya! ✨");
        }
        questions = STATIC_QUIZ_DATA[category] || [];
      }
      
      if (!questions || questions.length === 0) {
        questions = STATIC_QUIZ_DATA[category] || [];
      }

      setCurrentQuiz(questions);
      setQuizIndex(0);
      setScore(0);
      setSelectedOption(null);
      setAnswering(false);
      setView(AppView.QUIZ_GAME);

      // Pre-generate speech for feedback
      geminiService.generateSpeech("Maa Shaa Allah, Benar!").then(s => s && setCorrectAudio(s)).catch(() => {});
      geminiService.generateSpeech("Sayang sekali, kurang tepat. Ayo coba lagi!").then(s => s && setWrongAudio(s)).catch(() => {});

      await loadQuizMedia(0, questions);
    } catch (err: any) {
      setErrorNotice("Gagal memulai kuis. Periksa internetmu.");
    } finally {
      setLoading(false);
    }
  };

  const loadQuizMedia = async (index: number, questions: QuizQuestion[]) => {
    const q = questions[index];
    if (q.generatedImage && q.audioData) return; 

    setItemLoading(true);
    
    // Safety timeout: Jangan biarkan user menunggu lebih dari 4 detik
    const timer = setTimeout(() => {
      console.warn("Media generation timed out.");
      setItemLoading(false);
    }, 4500);

    try {
      const results = await Promise.allSettled([
        geminiService.generateImage(q.imagePrompt),
        geminiService.generateSpeech(q.arabicWord)
      ]);
      
      clearTimeout(timer);

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
    } catch (err) {
      console.warn("Handled error during media load:", err);
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
      if (correctAudio) setTimeout(() => playArabicAudio(correctAudio), 400);
    } else {
      if (wrongSfxRef.current) {
        wrongSfxRef.current.currentTime = 0;
        wrongSfxRef.current.play().catch(() => {});
      }
      if (wrongAudio) setTimeout(() => playArabicAudio(wrongAudio), 400);
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
    }, 2200);
  };

  const playAyatAudio = (surahNumber: number, ayatNumber: number, index: number) => {
    playClick();
    ensureMusicPlaying();
    if (playingAyat === index) {
      if (ayatAudioRef.current) {
        ayatAudioRef.current.pause();
        setPlayingAyat(null);
      }
      return;
    }
    setLoadingAyat(index);
    const audioUrl = verses[index].audio["01"];
    if (ayatAudioRef.current) ayatAudioRef.current.pause();
    const audio = new Audio(audioUrl);
    ayatAudioRef.current = audio;
    audio.onplay = () => { setLoadingAyat(null); setPlayingAyat(index); };
    audio.onended = () => { setPlayingAyat(null); };
    audio.onerror = () => { setLoadingAyat(null); setErrorNotice("Gagal memutar audio ayat."); };
    audio.play().catch(() => setLoadingAyat(null));
  };

  const openSurahDetail = async (surah: Surah) => {
    playClick();
    ensureMusicPlaying();
    setSelectedSurah(surah);
    setTafsir("");
    setVerses([]);
    setLoading(true);
    try {
      const [tafsirText, versesRes] = await Promise.all([
        geminiService.getSurahTafsirForKids(surah.transliteration).catch(() => "Ustadz sedang istirahat sebentar."),
        fetch(`https://equran.id/api/v2/surat/${surah.number}`).then(res => res.json())
      ]);
      setTafsir(tafsirText);
      setVerses(versesRes.data.ayat);
    } catch (err) {
      setErrorNotice("Gagal memuat ayat. Periksa koneksi.");
    } finally {
      setLoading(false);
    }
  };

  const toggleHifz = (surahNumber: number) => {
    playClick();
    ensureMusicPlaying();
    const newProgress = hifzProgress.includes(surahNumber)
      ? hifzProgress.filter(n => n !== surahNumber)
      : [...hifzProgress, surahNumber];
    setHifzProgress(newProgress);
    localStorage.setItem('alifbata_hifz', JSON.stringify(newProgress));
  };

  if (!hasStarted) {
    return (
      <div className="fixed inset-0 bg-gradient-to-br from-emerald-400 to-sky-500 flex flex-col items-center justify-center p-8 text-white z-[100] overflow-hidden">
        <BackgroundDecor />
        <div className="bg-white/20 backdrop-blur-lg p-12 rounded-[5rem] shadow-2xl mb-12 animate-in zoom-in-75 duration-700 relative">
           <div className="absolute -top-6 -right-6 floating"><Sparkles size={60} className="text-yellow-300" /></div>
           <Sparkles size={120} className="text-white animate-pulse" />
        </div>
        <h1 className="text-7xl font-kids mb-6 text-center tracking-tight drop-shadow-2xl">AlifBaTa Kids</h1>
        <p className="text-emerald-50 text-2xl mb-14 text-center max-w-sm leading-relaxed opacity-95 font-medium font-sans drop-shadow-md">
          Petualangan Seru Belajar Bahasa Arab & Hafalan Juz 30!
        </p>
        <button 
          onClick={handleStartApp}
          className="bg-amber-400 text-amber-950 px-16 py-8 rounded-full font-kids text-4xl shadow-[0_12px_0_rgb(180,120,0)] flex items-center gap-6 hover:translate-y-1 hover:shadow-[0_8px_0_rgb(180,120,0)] active:translate-y-4 active:shadow-none transition-all z-10"
        >
          <PlayCircle size={48} /> Mulai!
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-20 max-w-2xl mx-auto px-4 pt-8 relative z-10" onClick={ensureMusicPlaying}>
      <BackgroundDecor />
      
      {/* Navbar */}
      <div className="flex items-center justify-between mb-10 sticky top-4 z-50 bg-white/80 backdrop-blur-xl p-4 rounded-[3rem] border-2 border-white/50 shadow-2xl shadow-emerald-500/10">
        <div className="flex items-center gap-4">
          <div className="bg-gradient-to-tr from-emerald-400 to-emerald-600 p-3 rounded-2xl shadow-lg shadow-emerald-200 cursor-pointer hover:rotate-12 transition-transform" onClick={() => { playClick(); setView(AppView.LANDING); setSelectedSurah(null); }}>
            <Sparkles className="text-white w-7 h-7" />
          </div>
          <h1 className="text-3xl font-kids tracking-tight gradient-text">AlifBaTa</h1>
        </div>
        
        <div className="flex items-center gap-3">
          {!isMuted && (
            <div className="flex gap-1.5 items-end h-6 mr-4">
              {[0.6, 0.8, 0.5, 0.7].map((d, i) => (
                <div key={i} className="w-1.5 bg-emerald-400 rounded-full animate-bounce" style={{ height: `${Math.random()*100 + 20}%`, animationDuration: `${d}s` }}></div>
              ))}
            </div>
          )}
          <button 
            onClick={toggleMusic}
            className={`p-4 rounded-2xl shadow-md transition-all active:scale-95 ${isMuted ? 'bg-gray-100 text-gray-400' : 'bg-amber-400 text-amber-900 border-2 border-amber-500/20'}`}
          >
            {isMuted ? <VolumeX className="w-7 h-7" /> : <Music className="w-7 h-7" />}
          </button>
          
          {view !== AppView.LANDING && (
            <button 
              onClick={() => {
                playClick();
                if (selectedSurah) setSelectedSurah(null);
                else setView(AppView.LANDING);
              }}
              className="p-4 bg-white rounded-2xl shadow-md text-emerald-600 hover:bg-emerald-50 transition-colors border-2 border-emerald-100"
            >
              <ArrowLeft className="w-7 h-7" />
            </button>
          )}
        </div>
      </div>

      {errorNotice && (
        <div className="bg-rose-50/90 backdrop-blur-md border-4 border-rose-200 p-6 rounded-[2.5rem] mb-8 flex flex-col gap-4 animate-in slide-in-from-top-4 shadow-xl relative z-20">
          <div className="flex items-center gap-4">
            <AlertTriangle className="text-rose-500 shrink-0" size={32} />
            <p className="text-rose-800 font-bold leading-tight font-sans text-lg">{errorNotice}</p>
            <button onClick={() => { playClick(); setErrorNotice(null); }} className="ml-auto text-rose-300 hover:text-rose-600">
              <X size={28} />
            </button>
          </div>
          {isPermissionError && (
            <Button variant="danger" className="w-full text-lg py-4 flex items-center justify-center gap-3" onClick={handleSetKey}>
              <Key size={24}/> Atur Kunci API
            </Button>
          )}
        </div>
      )}

      {/* Landing */}
      {view === AppView.LANDING && (
        <div className="space-y-8 animate-in fade-in duration-700">
          <div className="bg-gradient-to-r from-emerald-400 to-emerald-500 rounded-[3.5rem] p-12 text-white shadow-2xl relative overflow-hidden group border-b-[16px] border-emerald-700/30">
            <div className="absolute top-0 right-0 p-8 opacity-20 transform translate-x-4 -translate-y-4 group-hover:rotate-12 transition-transform">
              <Sun size={150} fill="currentColor" />
            </div>
            <div className="relative z-10">
              <h2 className="text-6xl font-kids mb-4 drop-shadow-md">Assalamu'alaikum! 👋</h2>
              <p className="text-emerald-50 opacity-95 text-2xl leading-relaxed font-medium font-sans drop-shadow-sm">
                Ayo kumpulkan bintang dan belajar bahasa Arab!
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <Card onClick={() => { playClick(); setView(AppView.QUIZ_MENU); }} className="border-amber-400 bg-amber-50 flex flex-col items-center justify-center text-center py-14 group hover:bg-amber-100 transition-colors">
              <div className="bg-amber-400 p-6 rounded-[2.5rem] mb-6 text-white shadow-2xl group-hover:rotate-12 transition-transform duration-300">
                <Gamepad2 size={64} />
              </div>
              <h3 className="font-kids text-4xl text-amber-800">Kuis Seru</h3>
              <p className="text-amber-600/60 font-bold mt-2 text-sm uppercase">Main & Belajar</p>
            </Card>

            <Card onClick={() => { playClick(); setView(AppView.JUZ_30); }} className="border-sky-400 bg-sky-50 flex flex-col items-center justify-center text-center py-14 group hover:bg-sky-100 transition-colors">
              <div className="bg-sky-400 p-6 rounded-[2.5rem] mb-6 text-white shadow-2xl group-hover:-rotate-12 transition-transform duration-300">
                <BookOpen size={64} />
              </div>
              <h3 className="font-kids text-4xl text-sky-800">Juz 30</h3>
              <p className="text-sky-600/60 font-bold mt-2 text-sm uppercase">Hafalan Qur'an</p>
            </Card>
          </div>

          <div className="bg-white/40 backdrop-blur-md p-10 rounded-[4rem] border-4 border-white/50 mt-10 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-emerald-400 via-sky-400 to-amber-400"></div>
            <h4 className="text-emerald-900 font-kids text-3xl text-center mb-8">Pencapaian Hebatmu:</h4>
            <div className="flex justify-around items-center">
              <div className="text-center group">
                <div className="bg-emerald-100 p-4 rounded-full mb-3 group-hover:scale-110 transition-transform"><Heart className="text-emerald-500 mx-auto" fill="currentColor" size={40}/></div>
                <span className="block text-4xl font-kids text-emerald-700">{hifzProgress.length}</span>
                <span className="text-xs font-black text-gray-500 uppercase tracking-widest">Hafalan</span>
              </div>
              <div className="text-center group">
                <div className="bg-amber-100 p-4 rounded-full mb-3 group-hover:scale-110 transition-transform"><Star className="text-amber-500 mx-auto" fill="currentColor" size={40}/></div>
                <span className="block text-4xl font-kids text-amber-600">{score}</span>
                <span className="text-xs font-black text-gray-500 uppercase tracking-widest">Poin</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Quiz Menu */}
      {view === AppView.QUIZ_MENU && (
        <div className="space-y-6 animate-in slide-in-from-right-8 duration-500">
          <h2 className="text-5xl font-kids text-emerald-900 text-center mb-12 drop-shadow-sm">Pilih Petualanganmu! 🗺️</h2>
          <div className="grid grid-cols-1 gap-6">
            {['Hewan Lucu', 'Buah Segar', 'Benda di Rumah', 'Anggota Keluarga', 'Warna-warni', 'Angka Arab'].map((cat, idx) => {
              const colors = [
                'bg-rose-50 border-rose-100 text-rose-600',
                'bg-amber-50 border-amber-100 text-amber-600',
                'bg-emerald-50 border-emerald-100 text-emerald-600',
                'bg-sky-50 border-sky-100 text-sky-600',
                'bg-purple-50 border-purple-100 text-purple-600',
                'bg-orange-50 border-orange-100 text-orange-600',
              ];
              const colorIdx = idx % colors.length;
              
              return (
                <button 
                key={cat} 
                disabled={loading}
                onClick={() => startQuiz(cat)}
                className={`flex items-center justify-between p-8 rounded-[3rem] border-b-[12px] active:translate-y-2 active:border-b-[4px] transition-all hover:scale-[1.02] group shadow-2xl ${colors[colorIdx]}`}
                >
                  <div className="flex items-center gap-8">
                    <div className="w-20 h-20 bg-white rounded-3xl flex items-center justify-center shadow-lg group-hover:rotate-6 transition-transform">
                      {loading ? <Loader2 className="animate-spin text-gray-300"/> : <BrainCircuit size={40} />}
                    </div>
                    <span className="text-3xl font-kids">{cat}</span>
                  </div>
                  <ChevronRight size={32} className="opacity-30 group-hover:opacity-100 transition-opacity" />
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Quiz Game */}
      {view === AppView.QUIZ_GAME && (
        <div className="space-y-8 animate-in zoom-in-95 duration-500">
          {currentQuiz[quizIndex] && (
            <>
              <div className="flex items-center justify-between px-4">
                <div className="bg-white/80 backdrop-blur-md px-8 py-3 rounded-full text-emerald-800 font-kids text-xl shadow-lg border-2 border-emerald-100">
                  Soal {quizIndex + 1} / {currentQuiz.length}
                </div>
                <div className="bg-amber-400 px-8 py-3 rounded-full text-amber-950 font-kids text-xl shadow-xl border-b-8 border-amber-600">
                  {score} ✨
                </div>
              </div>
              
              <div className="bg-white rounded-[4rem] p-8 shadow-2xl text-center border-b-[20px] border-gray-100 overflow-hidden relative min-h-[500px] flex flex-col">
                {itemLoading ? (
                  <div className="flex flex-col items-center justify-center gap-8 py-24 flex-1">
                    <div className="relative">
                      <Music className="text-emerald-400 w-32 h-32 animate-bounce" />
                      <Sparkles className="absolute -top-4 -right-4 text-amber-400 animate-pulse" size={32}/>
                    </div>
                    <p className="text-emerald-900 font-kids text-3xl">Mencari Visual Seru... ✨</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center flex-1 py-4">
                    {/* Image / Fallback Section */}
                    <div className={`w-72 h-72 rounded-[3.5rem] mb-6 relative flex items-center justify-center overflow-hidden shadow-2xl bg-gradient-to-br ${getCategoryColors(currentCategory)} border-8 border-white p-2 shrink-0`}>
                      {currentQuiz[quizIndex].generatedImage ? (
                        <img 
                          src={currentQuiz[quizIndex].generatedImage} 
                          alt="Visual" 
                          className="w-full h-full object-cover rounded-[2.5rem]"
                        />
                      ) : (
                        <div className="flex flex-col items-center gap-4">
                          <CategoryIcon category={currentCategory} />
                          <p className="text-sm font-black text-white/70 uppercase tracking-widest">{currentCategory}</p>
                        </div>
                      )}
                      <div className="absolute bottom-4 right-4 bg-white/80 p-2.5 rounded-2xl backdrop-blur-sm"><Sparkles size={20} className="text-emerald-400" /></div>
                    </div>
                    
                    {/* Arabic Text Section */}
                    <div className="flex items-center justify-center gap-6 mb-4 w-full h-24">
                      <div className="font-arabic text-7xl text-emerald-600 drop-shadow-xl select-none leading-none">
                        {currentQuiz[quizIndex].arabicWord}
                      </div>
                      <button 
                        onClick={() => playArabicAudio(currentQuiz[quizIndex].audioData!)}
                        disabled={!currentQuiz[quizIndex].audioData}
                        className={`w-16 h-16 rounded-3xl flex items-center justify-center text-white shadow-[0_8px_0_rgb(5,150,105)] active:translate-y-1 active:shadow-none transition-all ${!currentQuiz[quizIndex].audioData ? 'bg-gray-200 shadow-none opacity-50' : 'bg-emerald-400 hover:bg-emerald-500'}`}
                      >
                        <Volume2 size={32}/>
                      </button>
                    </div>
                    
                    {/* Question Section */}
                    <h3 className="text-3xl font-kids text-gray-800 px-6 leading-tight flex-1 flex items-center justify-center">
                      {currentQuiz[quizIndex].question}
                    </h3>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 gap-5 pt-4">
                {currentQuiz[quizIndex].options.map((option, i) => {
                  const isSelected = selectedOption === option;
                  const isCorrect = option === currentQuiz[quizIndex].correctAnswer;
                  let buttonClass = "bg-white border-gray-100 text-gray-700";
                  if (answering) {
                    if (isCorrect) buttonClass = "bg-emerald-400 border-emerald-600 text-white scale-[1.03] shadow-emerald-200 z-10";
                    else if (isSelected) buttonClass = "bg-rose-400 border-rose-600 text-white";
                    else buttonClass = "opacity-30 scale-95";
                  }
                  return (
                    <button
                      key={i}
                      disabled={itemLoading || answering}
                      onClick={() => handleAnswer(option)}
                      className={`p-6 rounded-[2.5rem] border-2 border-b-[10px] text-2xl font-kids shadow-xl transition-all text-left flex items-center gap-6 ${buttonClass}`}
                    >
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl font-kids shadow-inner ${answering && isCorrect ? 'bg-white/20' : 'bg-gray-50'}`}>
                        {String.fromCharCode(65 + i)}
                      </div>
                      <span className="truncate">{option}</span>
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}

      {/* View lainnya tetap sama karena sudah stabil */}
      {view === AppView.JUZ_30 && !selectedSurah && (
        <div className="space-y-6 animate-in slide-in-from-right-8 duration-700">
          <div className="bg-sky-400 rounded-[3.5rem] p-12 text-white shadow-2xl mb-12 relative overflow-hidden border-b-[16px] border-sky-700/30">
             <div className="absolute top-0 right-0 p-8 opacity-20 transform translate-x-4 -translate-y-4">
                <Moon size={150} fill="currentColor" />
              </div>
             <h2 className="text-5xl font-kids mb-2 drop-shadow-md">Hafalan Juz 30 ⭐</h2>
             <p className="text-sky-50 font-bold text-xl opacity-90 font-sans">Semangat menghafal Al-Qur'an!</p>
          </div>
          
          <div className="grid grid-cols-1 gap-5">
            {JUZ_30_SURAHS.map((surah) => (
              <div 
                key={surah.number} 
                onClick={() => openSurahDetail(surah)} 
                className="bg-white rounded-[2.5rem] p-8 shadow-xl border-b-[10px] border-gray-100 flex items-center gap-6 group cursor-pointer active:translate-y-2 active:border-b-[2px] transition-all"
              >
                <div className={`w-16 h-16 rounded-[1.5rem] flex items-center justify-center text-2xl font-kids border-4 transition-colors ${hifzProgress.includes(surah.number) ? 'bg-emerald-400 border-emerald-500 text-white' : 'bg-gray-50 text-gray-300 border-gray-100'}`}>
                  {hifzProgress.includes(surah.number) ? <Heart fill="currentColor" size={32}/> : surah.number}
                </div>
                <div className="flex-1">
                  <h4 className="text-3xl font-kids text-gray-800 group-hover:text-sky-500 transition-colors">{surah.transliteration}</h4>
                  <p className="text-sm text-gray-400 font-bold uppercase tracking-widest">{surah.translation}</p>
                </div>
                <div className="font-arabic text-5xl text-emerald-600 drop-shadow-sm">{surah.name}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {view === AppView.ACHIEVEMENTS && (
        <div className="text-center space-y-16 pt-32 animate-in zoom-in-90 duration-700">
          <div className="relative inline-block">
             <div className="absolute inset-0 bg-amber-400 blur-3xl opacity-30 animate-pulse rounded-full"></div>
             <Trophy size={200} className="relative text-amber-400 floating" />
          </div>
          <div className="space-y-8">
            <h2 className="text-8xl font-kids text-gray-800 drop-shadow-lg">Maa Syaa Allah! 🎊</h2>
            <p className="text-5xl text-emerald-500 font-kids drop-shadow-md">Kamu Hebat: {score} Poin!</p>
          </div>
          <div className="flex flex-col gap-8 max-w-sm mx-auto">
            <Button onClick={() => setView(AppView.QUIZ_MENU)} className="text-3xl py-8">Main Lagi! 🎮</Button>
            <Button variant="secondary" onClick={() => setView(AppView.LANDING)} className="text-3xl py-8">Menu Utama 🏠</Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
