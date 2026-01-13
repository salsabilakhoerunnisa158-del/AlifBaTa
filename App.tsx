
import React, { useState, useEffect, useRef } from 'react';
import { AppView, AppViewType, Surah, QuizQuestion, Verse, DailyPrayer } from './types';
import { JUZ_30_SURAHS, STATIC_QUIZ_DATA, DAILY_PRAYERS } from './constants';
import { geminiService } from './services/geminiService';
import { 
  BookOpen, 
  Gamepad2, 
  ArrowLeft, 
  ChevronRight,
  Sparkles,
  Loader2,
  Music,
  Heart,
  PlayCircle,
  Star,
  Image as ImageIcon,
  Cloud,
  Sun,
  Volume2,
  Trophy,
  RefreshCcw
} from 'lucide-react';

const ArabicLogo: React.FC<{ size?: 'sm' | 'lg' }> = ({ size = 'sm' }) => (
  <div className={`flex items-center justify-center font-arabic font-bold ${size === 'lg' ? 'text-6xl gap-4' : 'text-2xl gap-1'}`}>
    <span className="text-emerald-500 animate-bounce" style={{ animationDelay: '0s' }}>ا</span>
    <span className="text-amber-500 animate-bounce" style={{ animationDelay: '0.2s' }}>ب</span>
    <span className="text-sky-500 animate-bounce" style={{ animationDelay: '0.4s' }}>ت</span>
  </div>
);

const BackgroundDecor: React.FC = () => (
  <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
    <div className="cloud-drift top-[15%]" style={{ animationDuration: '45s' }}><Cloud size={80} color="white" fill="white" /></div>
    <div className="cloud-drift top-[45%] left-[-20%]" style={{ animationDuration: '60s' }}><Cloud size={100} color="white" fill="white" /></div>
    <div className="absolute top-[8%] left-[12%] star-blink text-yellow-300"><Star fill="currentColor" size={20} /></div>
    <div className="absolute bottom-[25%] right-[15%] star-blink text-pink-300" style={{ animationDelay: '1.5s' }}><Star fill="currentColor" size={24} /></div>
  </div>
);

const App: React.FC = () => {
  const [view, setView] = useState<AppViewType>(AppView.LANDING);
  const [hasStarted, setHasStarted] = useState(false);
  const [selectedSurah, setSelectedSurah] = useState<Surah | null>(null);
  const [selectedPrayer, setSelectedPrayer] = useState<DailyPrayer | null>(null);
  const [score, setScore] = useState(0);
  const [hifzProgress, setHifzProgress] = useState<number[]>([]);
  const [isMuted, setIsMuted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [currentQuiz, setCurrentQuiz] = useState<QuizQuestion[]>([]);
  const [currentCategory, setCurrentCategory] = useState<string>("");
  const [quizIndex, setQuizIndex] = useState(0);
  const [answering, setAnswering] = useState(false);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [itemLoading, setItemLoading] = useState(false);
  const [verses, setVerses] = useState<Verse[]>([]);
  const [tafsir, setTafsir] = useState("");

  const audioContextRef = useRef<AudioContext | null>(null);
  const bgMusicRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem('alifbata_hifz');
    if (saved) setHifzProgress(JSON.parse(saved));
    bgMusicRef.current = new Audio("https://cdn.pixabay.com/audio/2022/10/30/audio_517935f111.mp3");
    bgMusicRef.current.loop = true;
    bgMusicRef.current.volume = 0.05;
    return () => bgMusicRef.current?.pause();
  }, []);

  const getAudioContext = () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    return audioContextRef.current;
  };

  const handleStartApp = () => {
    getAudioContext();
    setHasStarted(true);
    if (!isMuted) bgMusicRef.current?.play().catch(() => {});
  };

  const startQuiz = async (category: string) => {
    setLoading(true);
    setCurrentCategory(category);
    try {
      const q = await geminiService.generateQuizQuestions(category);
      setCurrentQuiz(q);
      setQuizIndex(0);
      setScore(0);
      setView(AppView.QUIZ_GAME);
      loadQuizMedia(0, q);
    } catch (err) {
      const fallback = STATIC_QUIZ_DATA[category] || [];
      setCurrentQuiz(fallback);
      setQuizIndex(0);
      setScore(0);
      setView(AppView.QUIZ_GAME);
      loadQuizMedia(0, fallback);
    } finally {
      setLoading(false);
    }
  };

  const loadQuizMedia = async (idx: number, questions: QuizQuestion[]) => {
    const q = questions[idx];
    if (!q) return;
    setItemLoading(true);
    try {
      const img = await geminiService.generateImage(q.imagePrompt);
      const updated = [...questions];
      updated[idx] = { ...q, generatedImage: img ? `data:image/png;base64,${img}` : undefined };
      setCurrentQuiz(updated);
      geminiService.playSpeech(q.arabicWord, getAudioContext());
    } finally {
      setItemLoading(false);
    }
  };

  const handleAnswer = (answer: string) => {
    if (answering) return;
    setAnswering(true);
    setSelectedOption(answer);
    const correct = answer === currentQuiz[quizIndex].correctAnswer;
    if (correct) setScore(s => s + 10);

    setTimeout(() => {
      if (quizIndex < currentQuiz.length - 1) {
        const next = quizIndex + 1;
        setQuizIndex(next);
        setSelectedOption(null);
        setAnswering(false);
        loadQuizMedia(next, currentQuiz);
      } else {
        setView(AppView.ACHIEVEMENTS);
      }
    }, 1200);
  };

  const openSurahDetail = async (surah: Surah) => {
    getAudioContext();
    setSelectedSurah(surah);
    setLoading(true);
    try {
      const [text, res] = await Promise.all([
        geminiService.getSurahTafsir(surah.transliteration),
        fetch(`https://equran.id/api/v2/surat/${surah.number}`).then(r => r.json())
      ]);
      setTafsir(text);
      setVerses(res.data.ayat);
    } finally {
      setLoading(false);
    }
  };

  const renderContent = () => {
    if (view === AppView.QUIZ_GAME) {
      const q = currentQuiz[quizIndex];
      if (!q) return null;
      return (
        <div className="space-y-4 animate-in fade-in duration-300">
          <div className="flex justify-between items-center bg-white/50 p-2 rounded-2xl">
            <span className="font-kids text-sky-600 text-sm">Soal {quizIndex + 1}/{currentQuiz.length}</span>
            <div className="flex items-center gap-1 bg-amber-400 text-white px-3 py-1 rounded-full text-sm">
              <Star size={14} fill="currentColor" />
              <span className="font-kids">{score}</span>
            </div>
          </div>
          <div className="bg-white rounded-[2.5rem] p-5 shadow-xl border-b-[8px] border-amber-50 flex flex-col items-center">
            <div className="w-full aspect-square max-w-[200px] bg-sky-50 rounded-[2rem] overflow-hidden relative mb-4 flex items-center justify-center border-4 border-white shadow-inner">
              {itemLoading ? (
                <div className="flex flex-col items-center"><Loader2 className="animate-spin text-sky-400" size={40} /><p className="font-kids text-xs text-sky-300 mt-2">Memuat...</p></div>
              ) : q.generatedImage ? (
                <img src={q.generatedImage} className="w-full h-full object-cover" />
              ) : (
                <div className="flex flex-col items-center text-sky-200">
                  <ImageIcon size={48} />
                  <button onClick={() => loadQuizMedia(quizIndex, currentQuiz)} className="text-[10px] mt-2 text-sky-500 underline">Muat Ulang</button>
                </div>
              )}
            </div>
            <button onClick={() => geminiService.playSpeech(q.arabicWord, getAudioContext())} className="bg-sky-500 text-white px-6 py-3 rounded-2xl flex items-center gap-2 mb-4 shadow-lg active:scale-95 transition-transform">
              <Volume2 size={24} />
              <span className="font-arabic text-3xl">{q.arabicWord}</span>
            </button>
            <h2 className="text-lg font-kids text-gray-800 text-center leading-tight">{q.question}</h2>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {q.options.map((opt, i) => (
              <button
                key={i}
                disabled={answering}
                onClick={() => handleAnswer(opt)}
                className={`p-4 rounded-2xl font-kids text-sm shadow-md border-b-4 transition-all active:translate-y-1
                  ${answering && opt === q.correctAnswer ? 'bg-emerald-500 text-white border-emerald-700' : 
                    answering && opt === selectedOption && opt !== q.correctAnswer ? 'bg-rose-500 text-white border-rose-700' : 
                    'bg-white text-gray-700 border-gray-100'}
                `}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>
      );
    }

    if (view === AppView.ACHIEVEMENTS) {
      return (
        <div className="text-center py-6 animate-in zoom-in duration-300">
          <div className="bg-white rounded-[3rem] p-8 shadow-2xl border-b-[10px] border-amber-50">
            <Trophy size={80} className="mx-auto text-amber-400 mb-4 animate-bounce" />
            <h2 className="text-3xl font-kids text-emerald-600 mb-1">Hebat!</h2>
            <div className="bg-emerald-50 p-6 rounded-[2rem] my-4">
              <span className="text-gray-400 text-[10px] font-bold uppercase">Skor Kamu</span>
              <div className="flex items-center justify-center gap-2">
                <Star fill="#f59e0b" className="text-amber-400" size={32}/>
                <span className="text-5xl font-kids text-amber-500">{score}</span>
              </div>
            </div>
            <button onClick={() => setView(AppView.LANDING)} className="w-full bg-emerald-500 text-white py-4 rounded-2xl font-kids text-lg shadow-[0_6px_0_#059669] active:translate-y-1 active:shadow-none transition-all">
              BERANDA
            </button>
          </div>
        </div>
      );
    }

    if (view === AppView.LANDING) {
      return (
        <div className="space-y-4 animate-in fade-in duration-300">
          <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-[2rem] p-6 text-white shadow-lg relative overflow-hidden border-b-8 border-emerald-800/10">
            <h2 className="text-2xl font-kids mb-1">Assalamu'alaikum!</h2>
            <p className="text-sm opacity-90">Hari ini mau belajar apa?</p>
            <Sparkles className="absolute -right-2 -top-2 text-white/10 w-24 h-24" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div onClick={() => setView(AppView.QUIZ_MENU)} className="bg-white rounded-[2rem] p-6 shadow-md border-b-8 border-amber-100 flex flex-col items-center cursor-pointer active:translate-y-1 active:border-b-0 transition-all">
              <div className="bg-amber-400 p-4 rounded-2xl mb-3 text-white shadow-md"><Gamepad2 size={32} /></div>
              <h3 className="font-kids text-lg text-amber-800">Kuis Seru</h3>
            </div>
            <div onClick={() => setView(AppView.JUZ_30)} className="bg-white rounded-[2rem] p-6 shadow-md border-b-8 border-sky-100 flex flex-col items-center cursor-pointer active:translate-y-1 active:border-b-0 transition-all">
              <div className="bg-sky-400 p-4 rounded-2xl mb-3 text-white shadow-md"><BookOpen size={32} /></div>
              <h3 className="font-kids text-lg text-sky-800">Juz 30</h3>
            </div>
          </div>
          <div onClick={() => setView(AppView.DAILY_PRAYERS)} className="bg-white rounded-[2rem] p-6 shadow-md border-b-8 border-pink-100 flex items-center justify-between cursor-pointer active:translate-y-1 transition-all">
            <div className="flex items-center gap-4">
              <div className="bg-pink-500 p-4 rounded-2xl text-white shadow-md"><Heart size={28} fill="currentColor" /></div>
              <div><h3 className="font-kids text-xl text-pink-800 leading-tight">Doa Harian</h3><p className="text-[10px] text-pink-400 font-bold uppercase">Hafalan Doa</p></div>
            </div>
            <ChevronRight size={24} className="text-pink-200" />
          </div>
        </div>
      );
    }

    if ((view === AppView.QUIZ_MENU || view === AppView.JUZ_30 || view === AppView.DAILY_PRAYERS) && !selectedSurah && !selectedPrayer) {
      return (
        <div className="space-y-4 animate-in slide-in-from-right duration-300">
          <div className={`rounded-3xl p-6 text-white shadow-lg ${view === AppView.QUIZ_MENU ? 'bg-amber-500' : view === AppView.JUZ_30 ? 'bg-sky-500' : 'bg-pink-500'}`}>
             <h2 className="text-xl font-kids">{view === AppView.QUIZ_MENU ? 'Tema Kuis' : view === AppView.JUZ_30 ? 'Juz 30' : 'Doa Harian'}</h2>
             <p className="text-xs opacity-90">Kumpulkan Bintang! ⭐</p>
          </div>
          <div className="grid gap-3">
             {view === AppView.QUIZ_MENU ? (
               ['Hewan Lucu', 'Buah Segar', 'Benda di Rumah', 'Warna-warni'].map((cat) => (
                 <button key={cat} onClick={() => startQuiz(cat)} className="bg-white rounded-2xl p-4 shadow-md border-b-4 border-gray-100 flex items-center justify-between active:translate-y-1 transition-all">
                    <span className="text-md font-kids text-gray-700">{cat}</span>
                    {loading && currentCategory === cat ? <Loader2 className="animate-spin text-amber-500" size={20}/> : <ChevronRight size={20} className="text-gray-300" />}
                 </button>
               ))
             ) : (view === AppView.JUZ_30 ? JUZ_30_SURAHS : DAILY_PRAYERS).map((item: any) => (
              <button key={item.number || item.id} onClick={() => view === AppView.JUZ_30 ? openSurahDetail(item) : setSelectedPrayer(item)} className="bg-white rounded-2xl p-4 shadow-md border-b-4 border-gray-100 flex items-center justify-between active:translate-y-1 transition-all">
                 <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-kids text-xs text-white ${hifzProgress.includes(item.number) ? 'bg-emerald-500' : 'bg-gray-200 text-gray-400'}`}>
                      {view === AppView.JUZ_30 ? (hifzProgress.includes(item.number) ? <Heart fill="currentColor" size={14}/> : item.number) : <Sparkles size={16}/>}
                    </div>
                    <span className="text-sm font-kids text-gray-700">{item.transliteration || item.title}</span>
                 </div>
                 {view === AppView.JUZ_30 && <span className="font-arabic text-xl text-sky-600">{item.name}</span>}
              </button>
             ))}
          </div>
        </div>
      );
    }

    if (selectedSurah) {
      return (
        <div className="space-y-4 animate-in slide-in-from-bottom pb-24">
          <div className="bg-white rounded-[2rem] p-6 shadow-lg text-center border-b-8 border-sky-50">
            <div className="font-arabic text-6xl text-sky-600 mb-2">{selectedSurah.name}</div>
            <h2 className="text-2xl font-kids text-gray-800">{selectedSurah.transliteration}</h2>
          </div>
          <div className="bg-amber-50 p-5 rounded-2xl border-2 border-white shadow-sm">
             <h3 className="font-kids text-amber-800 text-sm mb-2 flex items-center gap-2"><Sun size={18}/> Pesan Moral</h3>
             {loading ? <Loader2 size={20} className="animate-spin text-amber-400 mx-auto"/> : <p className="text-amber-900 text-xs leading-relaxed font-medium">{tafsir}</p>}
          </div>
          <div className="space-y-4">
             {verses.map((v, i) => (
               <div key={i} className="bg-white rounded-2xl p-6 shadow-sm border-b-4 border-gray-50">
                 <div className="flex justify-between mb-4"><div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center font-kids text-[10px] text-emerald-600">{v.nomorAyat}</div></div>
                 <div className="text-right font-arabic text-3xl leading-loose text-gray-800 mb-4" dir="rtl">{v.teksArab}</div>
                 <p className="text-emerald-900 text-xs font-medium italic opacity-70 border-t pt-3">{v.teksIndonesia}</p>
               </div>
             ))}
          </div>
          <div className="fixed bottom-6 left-0 right-0 px-6 z-40 max-w-md mx-auto">
             <button onClick={() => {
                const newP = hifzProgress.includes(selectedSurah.number) ? hifzProgress.filter(n => n !== selectedSurah.number) : [...hifzProgress, selectedSurah.number];
                setHifzProgress(newP);
                localStorage.setItem('alifbata_hifz', JSON.stringify(newP));
             }} className={`w-full py-4 rounded-2xl font-kids text-lg shadow-xl active:translate-y-1 transition-all ${hifzProgress.includes(selectedSurah.number) ? 'bg-emerald-500 text-white' : 'bg-amber-400 text-amber-950'}`}>
                {hifzProgress.includes(selectedSurah.number) ? 'HAFAL! ✅' : 'TANDAI HAFAL ❤️'}
             </button>
          </div>
        </div>
      );
    }

    if (selectedPrayer) {
      return (
        <div className="animate-in fade-in py-4">
           <div className="bg-white rounded-[2rem] p-6 shadow-lg border-b-8 border-pink-50 text-center">
              <h2 className="text-xl font-kids text-pink-800 mb-6">{selectedPrayer.title}</h2>
              <div className="font-arabic text-3xl text-emerald-700 leading-relaxed mb-6" dir="rtl">{selectedPrayer.arabic}</div>
              <div className="p-4 bg-pink-50 rounded-xl text-pink-900 italic text-sm mb-6">{selectedPrayer.translation}</div>
              <button onClick={() => geminiService.playSpeech(selectedPrayer.arabic, getAudioContext())} className="bg-pink-500 text-white p-4 rounded-2xl mx-auto flex items-center gap-2 shadow-md active:scale-95">
                 <Volume2 size={24} /> DENGARKAN
              </button>
           </div>
        </div>
      );
    }

    return null;
  };

  if (!hasStarted) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center p-6 text-center z-[100] bg-sky-100 overflow-hidden">
        <BackgroundDecor />
        <div className="relative z-10 animate-in zoom-in duration-500">
          <div className="w-48 h-48 md:w-56 md:h-56 bg-white rounded-[3rem] shadow-2xl floating flex items-center justify-center mb-8 border-4 border-white">
            <ArabicLogo size="lg" />
          </div>
          <h1 className="text-5xl font-kids text-emerald-600 drop-shadow-md mb-2">AlifBaTa</h1>
          <p className="font-kids text-sky-600 tracking-widest text-sm mb-10">KIDS EDITION</p>
          <button onClick={handleStartApp} className="bg-amber-400 text-amber-950 px-10 py-6 rounded-[2rem] font-kids text-2xl shadow-[0_8px_0_#d97706] active:translate-y-1 active:shadow-none transition-all flex items-center gap-3">
            <PlayCircle size={32} /> AYO MULAI!
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-10 max-w-md mx-auto px-4 pt-6 relative z-10">
      <BackgroundDecor />
      <header className="flex items-center justify-between mb-8 sticky top-4 z-50 glass p-3 rounded-2xl shadow-lg border-2 border-white/50">
        <div className="flex items-center gap-2 cursor-pointer" onClick={() => { setView(AppView.LANDING); setSelectedSurah(null); setSelectedPrayer(null); }}>
          <div className="bg-white p-1 rounded-lg shadow-inner"><ArabicLogo /></div>
          <h1 className="text-lg font-kids gradient-text">AlifBaTa</h1>
        </div>
        <div className="flex gap-2">
          <button onClick={() => { setIsMuted(!isMuted); if(!isMuted) bgMusicRef.current?.play(); else bgMusicRef.current?.pause(); }} className={`p-3 rounded-xl shadow-md transition-all ${isMuted ? 'bg-gray-200' : 'bg-amber-100 text-amber-600'}`}>
            <Music size={18} />
          </button>
          {view !== AppView.LANDING && (
            <button onClick={() => { if(selectedSurah) setSelectedSurah(null); else if(selectedPrayer) setSelectedPrayer(null); else setView(AppView.LANDING); }} className="p-3 bg-emerald-500 text-white rounded-xl shadow-md active:scale-90">
              <ArrowLeft size={18} />
            </button>
          )}
        </div>
      </header>
      <main className="relative z-10">
        {renderContent()}
      </main>
    </div>
  );
};

export default App;
