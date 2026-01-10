
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
  Image as ImageIcon,
  Cloud,
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
    <div className="absolute top-[5%] left-[5%] star-blink text-yellow-300 opacity-20"><Star fill="currentColor" size={20} /></div>
    <div className="absolute top-[20%] right-[10%] star-blink text-blue-300 opacity-20"><Star fill="currentColor" size={24} /></div>
    <div className="absolute bottom-[15%] left-[10%] star-blink text-pink-300 opacity-20"><Star fill="currentColor" size={30} /></div>
    <div className="absolute top-[10%] right-[5%] floating text-emerald-100 opacity-30"><Cloud size={60} fill="currentColor" /></div>
  </div>
);

const CategoryIcon: React.FC<{ category: string; size?: number }> = ({ category, size = 80 }) => {
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

const Card: React.FC<{ children: React.ReactNode; className?: string; onClick?: () => void }> = ({ children, className = "", onClick }) => (
  <div onClick={onClick} className={`bg-white rounded-[2rem] shadow-xl p-6 border-b-[8px] border-gray-100/50 active:translate-y-1 active:border-b-[2px] transition-all cursor-pointer relative overflow-hidden ${className}`}>
    {children}
  </div>
);

const Button: React.FC<{ children: React.ReactNode; variant?: 'primary' | 'secondary' | 'danger' | 'info'; onClick?: () => void; className?: string; disabled?: boolean }> = ({ children, variant = 'primary', onClick, className = "", disabled }) => {
  const styles = {
    primary: "bg-emerald-400 hover:bg-emerald-500 border-emerald-600 text-white shadow-emerald-200",
    secondary: "bg-amber-400 hover:bg-amber-500 border-amber-600 text-amber-950 shadow-amber-200",
    danger: "bg-rose-400 hover:bg-rose-500 border-rose-600 text-white shadow-rose-200",
    info: "bg-sky-400 hover:bg-sky-500 border-sky-600 text-white shadow-sky-200"
  };
  return (
    <button disabled={disabled} onClick={onClick} className={`px-8 py-4 rounded-full font-kids text-lg border-b-[6px] transition-all active:translate-y-2 active:border-b-0 shadow-lg ${styles[variant]} ${className} ${disabled ? 'opacity-50 grayscale cursor-not-allowed' : ''}`}>
      {children}
    </button>
  );
};

const App: React.FC = () => {
  const [view, setView] = useState<AppViewType>(AppView.LANDING);
  const [hasStarted, setHasStarted] = useState(false);
  
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
  const [tafsir, setTafsir] = useState("");
  const [verses, setVerses] = useState<Verse[]>([]);
  const [answering, setAnswering] = useState(false);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [errorNotice, setErrorNotice] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [playingAyat, setPlayingAyat] = useState<number | null>(null);
  const [loadingAyat, setLoadingAyat] = useState<number | null>(null);

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
    } catch (e) {}

    bgMusicRef.current = new Audio("https://cdn.pixabay.com/audio/2022/10/30/audio_517935f111.mp3");
    bgMusicRef.current.loop = true;
    bgMusicRef.current.volume = 0.08;

    clickAudioRef.current = new Audio("https://assets.mixkit.co/active_storage/sfx/2571/2571-preview.mp3");
    
    // Suara Benar & Salah
    correctSfxRef.current = new Audio("https://cdn.pixabay.com/audio/2022/03/15/audio_78330a6e38.mp3");
    correctSfxRef.current.crossOrigin = "anonymous";
    
    wrongSfxRef.current = new Audio("https://cdn.pixabay.com/audio/2022/03/10/audio_c356133068.mp3");
    wrongSfxRef.current.crossOrigin = "anonymous";

    return () => {
      [bgMusicRef, ayatAudioRef, clickAudioRef, correctSfxRef, wrongSfxRef].forEach(ref => {
        if (ref.current) { ref.current.pause(); ref.current = null; }
      });
    };
  }, []);

  const playClick = () => { if (clickAudioRef.current) { clickAudioRef.current.currentTime = 0; clickAudioRef.current.play().catch(() => {}); } };

  const handleStartApp = () => {
    playClick();
    setHasStarted(true);
    if (bgMusicRef.current && !isMuted) bgMusicRef.current.play().catch(() => {});
  };

  const playArabicAudio = async (base64Audio: string) => {
    if (!base64Audio) return;
    try {
      if (bgMusicRef.current && !isMuted) bgMusicRef.current.volume = 0.02;

      if (!audioContextRef.current) audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      const ctx = audioContextRef.current;
      if (ctx.state === 'suspended') await ctx.resume();
      const audioBuffer = await decodeAudioData(decodeBase64(base64Audio), ctx, 24000, 1);
      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(ctx.destination);
      source.onended = () => {
        if (bgMusicRef.current && !isMuted) bgMusicRef.current.volume = 0.08;
      };
      source.start();
    } catch (err) {
      if (bgMusicRef.current && !isMuted) bgMusicRef.current.volume = 0.08;
    }
  };

  const openPrayerDetail = async (prayer: DailyPrayer) => {
    playClick();
    setSelectedPrayer(prayer);
    setPrayerImage(null);
    setPrayerAudio(null);
    setErrorNotice(null);
    setItemLoading(true);
    try {
      const [imgData, audioData] = await Promise.all([
        geminiService.generateImage(prayer.imagePrompt),
        geminiService.generateSpeech(prayer.arabic)
      ]);
      if (imgData) setPrayerImage(`data:image/png;base64,${imgData}`);
      if (audioData) { setPrayerAudio(audioData); playArabicAudio(audioData); }
    } catch (err) { setErrorNotice("Gagal memuat doa."); } finally { setItemLoading(false); }
  };

  const startQuiz = async (category: string) => {
    playClick();
    setLoading(true);
    setErrorNotice(null);
    setCurrentCategory(category);
    try {
      let questions: QuizQuestion[] = [];
      try {
        questions = await geminiService.generateQuizQuestions(category);
      } catch (err) {
        questions = STATIC_QUIZ_DATA[category] || [];
      }
      setCurrentQuiz(questions);
      setQuizIndex(0);
      setScore(0);
      setView(AppView.QUIZ_GAME);
      await loadQuizMedia(0, questions);
    } catch (err) { setErrorNotice("Gagal memuat kuis."); } finally { setLoading(false); }
  };

  const loadQuizMedia = async (index: number, questions: QuizQuestion[]) => {
    const q = questions[index];
    if (!q) return;
    setItemLoading(true);
    try {
      // Gunakan penanganan yang lebih hati-hati untuk memastikan state terupdate meskipun salah satu gagal
      const imgPromise = geminiService.generateImage(q.imagePrompt);
      const audioPromise = geminiService.generateSpeech(q.arabicWord);
      
      const [imgVal, audioVal] = await Promise.all([
        imgPromise.catch(e => { console.warn("Img fail", e); return undefined; }),
        audioPromise.catch(e => { console.warn("Audio fail", e); return undefined; })
      ]);
      
      const updatedQuiz = [...questions];
      updatedQuiz[index] = { 
        ...q, 
        generatedImage: imgVal ? `data:image/png;base64,${imgVal}` : undefined, 
        audioData: audioVal 
      };
      
      setCurrentQuiz(updatedQuiz);
      if (audioVal) playArabicAudio(audioVal);
    } catch (err) {
      console.warn("Media loading issue", err);
    } finally { setItemLoading(false); }
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
    } else {
      if (wrongSfxRef.current) { 
        wrongSfxRef.current.currentTime = 0; 
        wrongSfxRef.current.play().catch(() => {}); 
      }
    }

    setTimeout(() => {
      if (quizIndex < currentQuiz.length - 1) {
        const nextIndex = quizIndex + 1;
        setQuizIndex(nextIndex);
        setSelectedOption(null);
        setAnswering(false);
        loadQuizMedia(nextIndex, currentQuiz);
      } else { setView(AppView.ACHIEVEMENTS); }
    }, 1500);
  };

  const openSurahDetail = async (surah: Surah) => {
    playClick();
    setSelectedSurah(surah);
    setTafsir("");
    setVerses([]);
    setLoading(true);
    try {
      const [tafsirText, versesRes] = await Promise.all([
        geminiService.getSurahTafsirForKids(surah.transliteration).catch(() => "Pelajaran indah dari surat ini."),
        fetch(`https://equran.id/api/v2/surat/${surah.number}`).then(res => res.json())
      ]);
      setTafsir(tafsirText);
      setVerses(versesRes.data.ayat);
    } catch (err) { setErrorNotice("Gagal memuat surat."); } finally { setLoading(false); }
  };

  const playAyatAudio = (index: number) => {
    playClick();
    if (playingAyat === index) {
      if (ayatAudioRef.current) { ayatAudioRef.current.pause(); ayatAudioRef.current = null; }
      setPlayingAyat(null);
      if (bgMusicRef.current && !isMuted) bgMusicRef.current.volume = 0.08;
      return;
    }
    if (ayatAudioRef.current) ayatAudioRef.current.pause();
    const verse = verses[index];
    const audioSrc = verse?.audio["05"] || verse?.audio["01"];
    if (!audioSrc) return;
    if (bgMusicRef.current && !isMuted) bgMusicRef.current.volume = 0.01;
    setLoadingAyat(index);
    const audio = new Audio(audioSrc);
    ayatAudioRef.current = audio;
    audio.oncanplaythrough = () => { setLoadingAyat(null); setPlayingAyat(index); audio.play().catch(() => setPlayingAyat(null)); };
    audio.onended = () => { setPlayingAyat(null); if (bgMusicRef.current && !isMuted) bgMusicRef.current.volume = 0.08; };
    audio.onerror = () => { setLoadingAyat(null); setPlayingAyat(null); if (bgMusicRef.current && !isMuted) bgMusicRef.current.volume = 0.08; };
  };

  const toggleHifz = (surahNumber: number) => {
    playClick();
    const newProgress = hifzProgress.includes(surahNumber) ? hifzProgress.filter(n => n !== surahNumber) : [...hifzProgress, surahNumber];
    setHifzProgress(newProgress);
    localStorage.setItem('alifbata_hifz', JSON.stringify(newProgress));
  };

  if (!hasStarted) {
    return (
      <div className="fixed inset-0 bg-gradient-to-br from-emerald-400 to-sky-500 flex flex-col items-center justify-center p-8 text-white z-[100] overflow-hidden text-center">
        <BackgroundDecor />
        <div className="bg-white/20 backdrop-blur-xl p-4 rounded-[3.5rem] shadow-2xl mb-8 animate-in zoom-in duration-500 relative flex items-center justify-center overflow-hidden w-64 h-64 border-4 border-white/30">
           <img src="icon.png" alt="Mascot" className="w-full h-full object-cover floating" onError={(e) => { (e.target as any).src = "https://cdn-icons-png.flaticon.com/512/3241/3241517.png"; }} />
        </div>
        <h1 className="text-6xl font-kids mb-6 drop-shadow-xl">AlifBaTa Kids</h1>
        <p className="text-xl mb-12 max-w-xs font-sans font-medium opacity-90">
          Belajar Bahasa Arab & Juz 30 Seru untuk Anak Sholeh!
        </p>
        <button onClick={handleStartApp} className="bg-amber-400 text-amber-950 px-12 py-6 rounded-full font-kids text-3xl shadow-[0_10px_0_rgb(180,120,0)] flex items-center justify-center gap-4 active:translate-y-4 active:shadow-none transition-all hover:scale-105">
          <PlayCircle size={40} /> Ayo Mulai!
        </button>
      </div>
    );
  }

  return (
    <div className={`min-h-screen pb-20 max-w-lg mx-auto px-4 pt-8 relative z-10 font-sans transition-colors duration-500 ${answering ? (selectedOption === currentQuiz[quizIndex]?.correctAnswer ? 'bg-emerald-50' : 'bg-rose-50') : ''}`}>
      <BackgroundDecor />
      
      {/* Navbar */}
      <div className="flex items-center justify-between mb-8 sticky top-4 z-50 bg-white/90 backdrop-blur-xl p-4 rounded-[2.5rem] border-2 border-white shadow-2xl">
        <div className="flex items-center gap-4">
          <div className="bg-gradient-to-tr from-emerald-400 to-emerald-600 p-1.5 rounded-2xl shadow-lg cursor-pointer hover:rotate-12 transition-all flex items-center justify-center" onClick={() => { playClick(); setView(AppView.LANDING); setSelectedSurah(null); setSelectedPrayer(null); if(ayatAudioRef.current) { ayatAudioRef.current.pause(); ayatAudioRef.current = null; } if(bgMusicRef.current && !isMuted) bgMusicRef.current.volume = 0.08; }}>
            <img src="icon.png" alt="Small Mascot" className="w-10 h-10 rounded-xl" onError={(e) => { (e.target as any).src = "https://cdn-icons-png.flaticon.com/512/3241/3241517.png"; }} />
          </div>
          <h1 className="text-2xl font-kids gradient-text tracking-tight">AlifBaTa</h1>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => { playClick(); if (!isMuted) { bgMusicRef.current?.pause(); setIsMuted(true); } else { bgMusicRef.current?.play(); setIsMuted(false); } }} className={`p-3.5 rounded-2xl shadow-md active:scale-90 transition-all ${isMuted ? 'bg-gray-100 text-gray-400' : 'bg-amber-400 text-amber-950'}`}>
            {isMuted ? <VolumeX size={24} /> : <Music size={24} />}
          </button>
          {view !== AppView.LANDING && (
            <button onClick={() => { playClick(); if (selectedSurah) { setSelectedSurah(null); if(ayatAudioRef.current) { ayatAudioRef.current.pause(); ayatAudioRef.current = null; } if(bgMusicRef.current && !isMuted) bgMusicRef.current.volume = 0.08; } else if (selectedPrayer) setSelectedPrayer(null); else setView(AppView.LANDING); }} className="p-3.5 bg-white rounded-2xl shadow-md text-emerald-600 border-2 border-emerald-50 active:scale-90 transition-all">
              <ArrowLeft size={24} />
            </button>
          )}
        </div>
      </div>

      {errorNotice && (
        <div className="bg-rose-50/95 backdrop-blur-md border-2 border-rose-100 p-6 rounded-[2rem] mb-8 animate-in slide-in-from-top-4 shadow-xl relative z-20">
          <div className="flex items-start gap-4 mb-2">
            <AlertTriangle className="text-rose-500 shrink-0 mt-1" size={28} />
            <p className="text-rose-900 font-bold leading-tight text-base flex-1">{errorNotice}</p>
            <button onClick={() => { playClick(); setErrorNotice(null); }}><X size={24} className="text-rose-300" /></button>
          </div>
        </div>
      )}

      {/* Main Views */}
      {view === AppView.LANDING && (
        <div className="space-y-8 animate-in fade-in duration-700">
          <div className="bg-gradient-to-r from-emerald-400 to-emerald-500 rounded-[3rem] p-8 text-white shadow-2xl relative overflow-hidden border-b-[12px] border-emerald-700/20 flex items-center gap-6 group">
            <div className="shrink-0 w-24 h-24 bg-white/20 p-1 rounded-[2rem] border-2 border-white/30 backdrop-blur-md overflow-hidden shadow-inner">
               <img src="icon.png" alt="Banner Mascot" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" onError={(e) => { (e.target as any).src = "https://cdn-icons-png.flaticon.com/512/3241/3241517.png"; }} />
            </div>
            <div>
              <h2 className="text-3xl font-kids mb-1 drop-shadow-md">Ahlan wa Sahlan! 👋</h2>
              <p className="text-emerald-50 text-lg font-medium opacity-90">Kumpulkan bintang & belajar seru!</p>
            </div>
            <Sparkles className="absolute -right-4 -bottom-4 text-white/10 w-32 h-32" />
          </div>

          <div className="grid grid-cols-2 gap-6">
            <Card onClick={() => { playClick(); setView(AppView.QUIZ_MENU); }} className="border-amber-200 bg-amber-50/50 flex flex-col items-center group">
              <div className="bg-amber-400 p-6 rounded-[2rem] mb-4 text-white shadow-xl group-hover:rotate-6 transition-transform"><Gamepad2 size={48} /></div>
              <h3 className="font-kids text-2xl text-amber-800">Kuis Seru</h3>
            </Card>
            <Card onClick={() => { playClick(); setView(AppView.JUZ_30); }} className="border-sky-200 bg-sky-50/50 flex flex-col items-center group">
              <div className="bg-sky-400 p-6 rounded-[2rem] mb-4 text-white shadow-xl group-hover:-rotate-6 transition-transform"><BookOpen size={48} /></div>
              <h3 className="font-kids text-2xl text-sky-800">Juz 30</h3>
            </Card>
            <Card onClick={() => { playClick(); setView(AppView.DAILY_PRAYERS); }} className="col-span-2 border-rose-200 bg-rose-50/50 py-12 flex flex-col items-center group">
              <div className="bg-rose-400 p-7 rounded-[2.5rem] mb-4 text-white shadow-2xl group-hover:scale-110 transition-transform"><Sparkles size={56} /></div>
              <h3 className="font-kids text-3xl text-rose-800">Doa Harian</h3>
              <p className="text-rose-400 text-sm font-bold mt-2 tracking-widest uppercase">Pagi s/d Malam</p>
            </Card>
          </div>

          <div className="bg-white/70 backdrop-blur-xl p-8 rounded-[3rem] border-2 border-white shadow-2xl flex justify-around items-center">
            <div className="text-center group">
              <Heart className="text-emerald-500 mx-auto mb-2 group-hover:scale-125 transition-transform" fill="currentColor" size={32}/>
              <span className="block text-2xl font-kids text-emerald-800">{hifzProgress.length} Hafal</span>
            </div>
            <div className="h-12 w-px bg-emerald-100"></div>
            <div className="text-center group">
              <Star className="text-amber-500 mx-auto mb-2 group-hover:rotate-45 transition-transform" fill="currentColor" size={32}/>
              <span className="block text-2xl font-kids text-amber-700">{score} Bintang</span>
            </div>
          </div>
        </div>
      )}

      {/* Quiz Game */}
      {view === AppView.QUIZ_GAME && currentQuiz[quizIndex] && (
        <div className="space-y-6 animate-in zoom-in-95 duration-500 pb-10">
          <div className="flex items-center justify-between px-2 mb-2">
            <div className="bg-white/90 px-6 py-2.5 rounded-full text-emerald-800 font-kids text-lg shadow-xl border-2 border-emerald-50">Soal {quizIndex + 1} / 10</div>
            <div className="bg-amber-400 px-6 py-2.5 rounded-full text-amber-950 font-kids text-lg shadow-xl border-b-4 border-amber-600 flex items-center gap-2">{score} <Star size={20} fill="currentColor"/></div>
          </div>
          
          <div className={`bg-white rounded-[3rem] p-8 shadow-2xl text-center border-b-[12px] border-gray-50 flex flex-col items-center transition-transform duration-300 ${answering && selectedOption !== currentQuiz[quizIndex].correctAnswer ? 'animate-shake' : ''}`}>
            <div className={`w-64 h-64 rounded-[3rem] mb-8 relative flex items-center justify-center shadow-2xl bg-gradient-to-br ${getCategoryColors(currentCategory)} border-4 border-white shrink-0 overflow-hidden`}>
              {itemLoading ? (
                <div className="flex flex-col items-center gap-3">
                  <Loader2 className="animate-spin text-white" size={48}/>
                  <p className="text-white font-kids text-lg animate-pulse">Sedang menggambar... ✨</p>
                </div>
              ) : currentQuiz[quizIndex].generatedImage ? (
                <img src={currentQuiz[quizIndex].generatedImage} className="w-full h-full object-cover animate-in fade-in duration-500" alt="Quiz"/>
              ) : (
                <div className="flex flex-col items-center gap-2">
                   <CategoryIcon category={currentCategory} size={100} />
                   <p className="text-white/60 text-xs font-kids">Gambar menyusul...</p>
                </div>
              )}
            </div>
            
            <div className="flex flex-col items-center gap-6 mb-8">
              <div className="flex items-center gap-6 bg-emerald-50/50 p-4 rounded-[2rem] border-2 border-white shadow-inner">
                <span className="font-arabic text-6xl text-emerald-700 leading-none">{currentQuiz[quizIndex].arabicWord}</span>
                <button onClick={() => currentQuiz[quizIndex].audioData && playArabicAudio(currentQuiz[quizIndex].audioData!)} className="w-14 h-14 rounded-2xl bg-emerald-400 text-white shadow-lg active:translate-y-2 transition-all flex items-center justify-center">
                  <Volume2 size={32}/>
                </button>
              </div>
              <h3 className="text-2xl font-kids text-gray-800 leading-tight px-4">{currentQuiz[quizIndex].question}</h3>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 pt-4">
            {currentQuiz[quizIndex].options.map((option, i) => {
              const isSelected = selectedOption === option;
              const isCorrect = option === currentQuiz[quizIndex].correctAnswer;
              let btnStyle = "bg-white border-gray-100 text-gray-700";
              if (answering) {
                if (isCorrect) btnStyle = "bg-emerald-400 border-emerald-600 text-white scale-[1.05] shadow-emerald-200 z-10";
                else if (isSelected) btnStyle = "bg-rose-400 border-rose-600 text-white";
                else btnStyle = "opacity-40 scale-95";
              }
              return (
                <button key={i} disabled={itemLoading || answering} onClick={() => handleAnswer(option)} className={`p-6 rounded-[2rem] border-2 border-b-[8px] text-xl font-kids shadow-xl transition-all text-left flex items-center gap-6 ${btnStyle}`}>
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-kids shadow-inner ${answering && isCorrect ? 'bg-white/20' : 'bg-gray-100 text-gray-400'}`}>
                    {String.fromCharCode(65 + i)}
                  </div>
                  <span className="flex-1">{option}</span>
                  {answering && isCorrect && isSelected && <CheckCircle2 size={24} className="text-white animate-bounce" />}
                  {answering && !isCorrect && isSelected && <X size={24} className="text-white" />}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Menu Views */}
      {(view === AppView.QUIZ_MENU || view === AppView.JUZ_30 || view === AppView.DAILY_PRAYERS) && !selectedSurah && !selectedPrayer && (
        <div className="space-y-6 animate-in slide-in-from-right duration-500 pb-10">
          <div className={`rounded-[2.5rem] p-8 text-white shadow-2xl relative overflow-hidden ${view === AppView.QUIZ_MENU ? 'bg-amber-400' : view === AppView.JUZ_30 ? 'bg-sky-400' : 'bg-rose-400'}`}>
             <div className="relative z-10">
               <h2 className="text-3xl font-kids mb-1">
                 {view === AppView.QUIZ_MENU ? 'Pilih Tema Kuis 🎮' : view === AppView.JUZ_30 ? 'Hafalan Juz 30 ⭐' : 'Doa Anak Sholeh 🤲'}
               </h2>
               <p className="opacity-90 font-medium">Ayo belajar bersama!</p>
             </div>
             <img src="icon.png" alt="Overlay Mascot" className="absolute -right-6 -bottom-6 w-32 h-32 opacity-20 pointer-events-none" onError={(e) => { (e.target as any).src = "https://cdn-icons-png.flaticon.com/512/3241/3241517.png"; }} />
          </div>
          <div className="grid grid-cols-1 gap-4">
            {view === AppView.QUIZ_MENU ? (
              ['Hewan Lucu', 'Buah Segar', 'Benda di Rumah', 'Anggota Keluarga', 'Warna-warni', 'Angka Arab'].map((cat) => (
                <button key={cat} onClick={() => startQuiz(cat)} className="bg-white rounded-[2rem] p-6 shadow-lg border-b-[8px] border-gray-50 flex items-center justify-between group active:translate-y-2 transition-all">
                  <div className="flex items-center gap-5">
                    <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600 shadow-inner group-hover:scale-110 transition-transform">
                      {loading && currentCategory === cat ? <Loader2 className="animate-spin" size={24}/> : <BrainCircuit size={28} />}
                    </div>
                    <span className="text-xl font-kids text-gray-700">{cat}</span>
                  </div>
                  <ChevronRight size={24} className="text-gray-300" />
                </button>
              ))
            ) : (view === AppView.JUZ_30 ? JUZ_30_SURAHS : DAILY_PRAYERS).map((item: any) => (
              <button key={item.number || item.id} onClick={() => view === AppView.JUZ_30 ? openSurahDetail(item) : openPrayerDetail(item)} className="bg-white rounded-[2rem] p-6 shadow-lg border-b-[8px] border-gray-50 flex items-center justify-between group active:translate-y-2 transition-all">
                <div className="flex items-center gap-5">
                   <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-kids shadow-inner ${hifzProgress.includes(item.number) ? 'bg-emerald-400 text-white' : 'bg-gray-100 text-gray-400'}`}>
                     {view === AppView.JUZ_30 ? (hifzProgress.includes(item.number) ? <Heart fill="currentColor" size={20}/> : item.number) : <Sparkles size={24} className="text-rose-300"/>}
                   </div>
                   <span className="text-xl font-kids text-gray-700">{item.transliteration || item.title}</span>
                </div>
                {view === AppView.JUZ_30 && <span className="font-arabic text-3xl text-emerald-600">{item.name}</span>}
              </button>
            ))}
          </div>
        </div>
      )}

      {view === AppView.ACHIEVEMENTS && (
        <div className="text-center space-y-12 pt-16 animate-in zoom-in-90 duration-700">
          <div className="relative inline-block">
             <Trophy size={160} className="mx-auto text-amber-400 floating" />
             <img src="icon.png" alt="Happy Mascot" className="absolute -bottom-4 -right-4 w-24 h-24 rounded-full border-4 border-white shadow-xl" onError={(e) => { (e.target as any).src = "https://cdn-icons-png.flaticon.com/512/3241/3241517.png"; }} />
          </div>
          <div className="space-y-4">
            <h2 className="text-5xl font-kids text-gray-800">Maa Syaa Allah! 🎊</h2>
            <p className="text-3xl text-emerald-500 font-kids drop-shadow-sm">Kamu dapat {score} Bintang!</p>
          </div>
          <div className="flex flex-col gap-6 max-w-xs mx-auto">
            <Button onClick={() => setView(AppView.QUIZ_MENU)} className="py-6 text-2xl" variant="primary">Main Lagi! 🎮</Button>
            <Button onClick={() => setView(AppView.LANDING)} className="py-6 text-2xl" variant="secondary">Beranda 🏠</Button>
          </div>
        </div>
      )}

      {selectedPrayer && (
        <div className="space-y-8 animate-in slide-in-from-bottom duration-700 pb-20">
          <div className="bg-white rounded-[3rem] p-8 shadow-2xl border-b-[12px] border-rose-50 flex flex-col items-center">
            <h2 className="text-3xl font-kids text-rose-800 mb-8">{selectedPrayer.title}</h2>
            <div className="w-64 h-64 rounded-[3.5rem] mb-8 relative flex items-center justify-center shadow-2xl bg-gradient-to-br from-rose-100 to-rose-200 border-4 border-white shrink-0 overflow-hidden">
              {itemLoading ? <Loader2 className="animate-spin text-rose-400" size={48}/> : prayerImage ? <img src={prayerImage} className="w-full h-full object-cover" alt="Prayer"/> : <Sparkles size={100} className="text-rose-200" />}
            </div>
            <div className="w-full text-center space-y-8">
              <div className="font-arabic text-4xl text-emerald-700 leading-loose" dir="rtl">{selectedPrayer.arabic}</div>
              <button onClick={() => prayerAudio && playArabicAudio(prayerAudio)} className="w-16 h-16 rounded-2xl bg-rose-400 text-white shadow-xl flex items-center justify-center mx-auto active:translate-y-2"><Volume2 size={36}/></button>
              <div className="p-6 bg-emerald-50/50 rounded-[2rem] border-2 border-white text-emerald-900 leading-relaxed italic text-lg shadow-inner">{selectedPrayer.translation}</div>
            </div>
          </div>
          <Button onClick={() => setSelectedPrayer(null)} className="w-full py-6 text-2xl" variant="primary">Kembali 📋</Button>
        </div>
      )}

      {selectedSurah && (
        <div className="space-y-6 animate-in slide-in-from-bottom duration-700 pb-32 pt-10">
          <div className="bg-white rounded-[3rem] p-10 shadow-2xl text-center border-b-[12px] border-emerald-50 relative overflow-hidden">
            <img src="icon.png" alt="Detail Mascot" className="absolute -left-10 -top-10 w-32 h-32 opacity-10 rotate-12" onError={(e) => { (e.target as any).src = "https://cdn-icons-png.flaticon.com/512/3241/3241517.png"; }} />
            <div className="font-arabic text-7xl text-emerald-600 mb-4">{selectedSurah.name}</div>
            <h2 className="text-3xl font-kids text-gray-800">{selectedSurah.transliteration}</h2>
            <p className="text-gray-400 italic">"{selectedSurah.translation}"</p>
          </div>
          <div className="bg-amber-50/70 p-8 rounded-[2.5rem] border-2 border-white shadow-xl">
             <h3 className="font-kids text-amber-800 mb-3 flex items-center gap-3"><Sparkles size={24}/> Kisah Singkat</h3>
             {loading ? <div className="flex justify-center p-4"><Loader2 className="animate-spin text-amber-400"/></div> : <p className="text-amber-900 leading-relaxed font-medium text-lg">{tafsir}</p>}
          </div>
          <div className="space-y-8">
             {verses.map((v, i) => (
               <div key={i} className={`bg-white rounded-[2.5rem] p-8 shadow-xl border-b-[8px] transition-all ${playingAyat === i ? 'border-amber-400 ring-4 ring-amber-100' : 'border-gray-100'}`}>
                 <div className="flex justify-between items-center mb-6">
                   <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center font-kids text-emerald-600 shadow-inner text-xl">{v.nomorAyat}</div>
                   <button onClick={() => playAyatAudio(i)} className={`w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg active:translate-y-2 transition-all ${playingAyat === i ? 'bg-amber-400 text-white animate-pulse' : 'bg-emerald-400 text-white'}`}>
                     {loadingAyat === i ? <Loader2 className="animate-spin" size={28}/> : (playingAyat === i ? <VolumeX size={32}/> : <Volume2 size={32}/>)}
                   </button>
                 </div>
                 <div className="text-right font-arabic text-5xl leading-loose text-gray-800 mb-8 select-all" dir="rtl">{v.teksArab}</div>
                 <p className="text-emerald-900 text-xl font-medium leading-relaxed italic border-t border-emerald-50 pt-8">{v.teksIndonesia}</p>
               </div>
             ))}
          </div>
          <div className="fixed bottom-8 left-0 right-0 px-8 z-40 max-w-lg mx-auto">
            <Button onClick={() => toggleHifz(selectedSurah!.number)} className="w-full py-6 text-2xl shadow-2xl" variant={hifzProgress.includes(selectedSurah!.number) ? 'primary' : 'secondary'}>
              {hifzProgress.includes(selectedSurah!.number) ? 'Sudah Hafal! ✅' : 'Tandai Hafal 💖'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
