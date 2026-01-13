
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
  RefreshCcw,
  AlertCircle,
  Bike,
  Shirt,
  Trees,
  CarFront
} from 'lucide-react';

const ArabicLogo: React.FC<{ size?: 'sm' | 'lg' }> = ({ size = 'sm' }) => (
  <div className={`flex items-center justify-center font-arabic font-bold ${size === 'lg' ? 'text-7xl gap-6' : 'text-3xl gap-1.5'}`}>
    <span className="text-emerald-500 transform hover:scale-110 transition-transform" style={{ textShadow: '2px 2px 0px white' }}>ا</span>
    <span className="text-amber-500 transform hover:scale-110 transition-transform" style={{ textShadow: '2px 2px 0px white' }}>ب</span>
    <span className="text-sky-500 transform hover:scale-110 transition-transform" style={{ textShadow: '2px 2px 0px white' }}>ت</span>
  </div>
);

const BackgroundDecor: React.FC = () => (
  <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
    <div className="cloud-drift top-[10%]" style={{ animationDuration: '40s' }}><Cloud size={60} color="white" fill="white" /></div>
    <div className="cloud-drift top-[30%] left-[-10%]" style={{ animationDuration: '55s' }}><Cloud size={80} color="white" fill="white" /></div>
    <div className="absolute top-[5%] right-[10%] star-blink text-yellow-300 opacity-30"><Star fill="currentColor" size={16} /></div>
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
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

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
    setErrorMsg(null);
    setCurrentCategory(category);
    try {
      // Mencoba menggunakan Gemini untuk membuat kuis variatif
      const q = await geminiService.generateQuizQuestions(category);
      setCurrentQuiz(q);
      setQuizIndex(0);
      setScore(0);
      setView(AppView.QUIZ_GAME);
      loadQuizMedia(0, q);
    } catch (err: any) {
      // Jika quota habis atau error, gunakan data kuis statis
      if (err.message === 'QUOTA_EXCEEDED') {
        setErrorMsg("Batas AI tercapai. Menggunakan kuis cadangan!");
      }
      const fallback = STATIC_QUIZ_DATA[category] || STATIC_QUIZ_DATA['Hewan Lucu'];
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
      if (!q.generatedImage) {
        const img = await geminiService.generateImage(q.imagePrompt);
        const updated = [...questions];
        updated[idx] = { ...q, generatedImage: img ? `data:image/png;base64,${img}` : undefined };
        setCurrentQuiz(updated);
      }
      geminiService.playSpeech(q.arabicWord, getAudioContext());
    } catch {
      console.warn("Media load failed");
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

  const renderContent = () => {
    if (view === AppView.QUIZ_GAME) {
      const q = currentQuiz[quizIndex];
      if (!q) return null;
      return (
        <div className="space-y-3 animate-in fade-in duration-300">
          {errorMsg && (
            <div className="bg-amber-100 border border-amber-300 text-amber-800 p-2 rounded-xl text-[10px] flex items-center gap-2">
              <AlertCircle size={14} /> {errorMsg}
            </div>
          )}
          <div className="flex justify-between items-center p-2 rounded-2xl">
            <span className="font-kids text-sky-600 text-xs">Soal {quizIndex + 1}/{currentQuiz.length}</span>
            <div className="flex items-center gap-1 bg-amber-400 text-white px-2 py-1 rounded-full text-xs shadow-sm">
              <Star size={12} fill="currentColor" />
              <span className="font-kids">{score}</span>
            </div>
          </div>
          <div className="bg-white rounded-[2rem] p-4 shadow-xl border-b-8 border-amber-50 flex flex-col items-center">
            <div className="w-full aspect-square max-w-[180px] bg-sky-50 rounded-[1.5rem] overflow-hidden relative mb-3 flex items-center justify-center border-2 border-white shadow-inner">
              {itemLoading ? (
                <div className="flex flex-col items-center"><Loader2 className="animate-spin text-sky-400" size={32} /><p className="font-kids text-[10px] text-sky-300 mt-1">Sabar ya...</p></div>
              ) : q.generatedImage ? (
                <img src={q.generatedImage} className="w-full h-full object-cover" />
              ) : (
                <div className="flex flex-col items-center text-sky-200">
                  <ImageIcon size={40} />
                  <button onClick={() => loadQuizMedia(quizIndex, currentQuiz)} className="text-[10px] mt-1 text-sky-500 underline flex items-center gap-1"><RefreshCcw size={10}/> Coba lagi</button>
                </div>
              )}
            </div>
            <button onClick={() => geminiService.playSpeech(q.arabicWord, getAudioContext())} className="bg-sky-500 text-white px-4 py-2 rounded-xl flex items-center gap-2 mb-3 shadow-md active:scale-95 transition-transform">
              <Volume2 size={20} />
              <span className="font-arabic text-2xl">{q.arabicWord}</span>
            </button>
            <h2 className="text-sm font-kids text-gray-800 text-center px-2">{q.question}</h2>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {q.options.map((opt, i) => (
              <button
                key={i}
                disabled={answering}
                onClick={() => handleAnswer(opt)}
                className={`p-3 rounded-xl font-kids text-[13px] shadow-sm border-b-4 transition-all active:translate-y-1
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

    if (view === AppView.LANDING) {
      return (
        <div className="space-y-3 animate-in fade-in duration-300">
          <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-[1.5rem] p-5 text-white shadow-lg relative overflow-hidden">
            <h2 className="text-xl font-kids mb-0.5">Assalamu'alaikum!</h2>
            <p className="text-[12px] opacity-90">Hari ini mau belajar apa?</p>
            <Sparkles className="absolute -right-3 -top-3 text-white/10 w-20 h-20" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div onClick={() => setView(AppView.QUIZ_MENU)} className="bg-white rounded-[1.5rem] p-5 shadow-sm border-b-4 border-amber-100 flex flex-col items-center cursor-pointer active:translate-y-1 active:border-b-0">
              <div className="bg-amber-400 p-3 rounded-xl mb-2 text-white shadow-md"><Gamepad2 size={24} /></div>
              <h3 className="font-kids text-sm text-amber-800">Kuis Seru</h3>
            </div>
            <div onClick={() => setView(AppView.JUZ_30)} className="bg-white rounded-[1.5rem] p-5 shadow-sm border-b-4 border-sky-100 flex flex-col items-center cursor-pointer active:translate-y-1 active:border-b-0">
              <div className="bg-sky-400 p-3 rounded-xl mb-2 text-white shadow-md"><BookOpen size={24} /></div>
              <h3 className="font-kids text-sm text-sky-800">Juz 30</h3>
            </div>
          </div>
          <div onClick={() => setView(AppView.DAILY_PRAYERS)} className="bg-white rounded-[1.5rem] p-4 shadow-sm border-b-4 border-pink-100 flex items-center justify-between cursor-pointer active:translate-y-1">
            <div className="flex items-center gap-3">
              <div className="bg-pink-500 p-3 rounded-xl text-white shadow-md"><Heart size={20} fill="currentColor" /></div>
              <div><h3 className="font-kids text-md text-pink-800">Doa Harian</h3><p className="text-[9px] text-pink-400 font-bold uppercase">Hafalan Doa</p></div>
            </div>
            <ChevronRight size={18} className="text-pink-200" />
          </div>
        </div>
      );
    }

    if ((view === AppView.QUIZ_MENU || view === AppView.JUZ_30 || view === AppView.DAILY_PRAYERS) && !selectedSurah && !selectedPrayer) {
      const themes = [
        { name: 'Hewan Lucu', icon: <Heart size={16}/> },
        { name: 'Buah Segar', icon: <Sun size={16}/> },
        { name: 'Benda di Rumah', icon: <ImageIcon size={16}/> },
        { name: 'Anggota Keluarga', icon: <Heart size={16} fill="currentColor"/> },
        { name: 'Warna-warni', icon: <Sparkles size={16}/> },
        { name: 'Kendaraan', icon: <CarFront size={16}/> },
        { name: 'Pakaian', icon: <Shirt size={16}/> },
        { name: 'Hobi & Olahraga', icon: <Bike size={16}/> },
        { name: 'Alam & Cuaca', icon: <Trees size={16}/> },
        { name: 'Angka Arab', icon: <Star size={16}/> }
      ];

      return (
        <div className="space-y-3 animate-in slide-in-from-right duration-300 pb-10">
          <div className={`rounded-2xl p-4 text-white shadow-md ${view === AppView.QUIZ_MENU ? 'bg-amber-500' : view === AppView.JUZ_30 ? 'bg-sky-500' : 'bg-pink-500'}`}>
             <h2 className="text-md font-kids">{view === AppView.QUIZ_MENU ? 'Pilih Tema Kuis' : view === AppView.JUZ_30 ? 'Pilih Surat Juz 30' : 'Pilih Doa'}</h2>
             <p className="text-[10px] opacity-90">Ayo semangat belajar! ⭐</p>
          </div>
          <div className="grid gap-2">
             {view === AppView.QUIZ_MENU ? (
               themes.map((t) => (
                 <button key={t.name} onClick={() => startQuiz(t.name)} className="bg-white rounded-xl p-3 shadow-sm border-b-2 border-gray-100 flex items-center justify-between active:translate-y-0.5 group">
                    <div className="flex items-center gap-3">
                      <div className="bg-amber-50 text-amber-500 p-2 rounded-lg group-hover:scale-110 transition-transform">
                        {t.icon}
                      </div>
                      <span className="text-sm font-kids text-gray-700">{t.name}</span>
                    </div>
                    {loading && currentCategory === t.name ? <Loader2 className="animate-spin text-amber-500" size={16}/> : <ChevronRight size={16} className="text-gray-300" />}
                 </button>
               ))
             ) : (view === AppView.JUZ_30 ? JUZ_30_SURAHS : DAILY_PRAYERS).map((item: any) => (
              <button key={item.number || item.id} onClick={() => view === AppView.JUZ_30 ? setSelectedSurah(item) : setSelectedPrayer(item)} className="bg-white rounded-xl p-3 shadow-sm border-b-2 border-gray-100 flex items-center justify-between active:translate-y-0.5">
                 <div className="flex items-center gap-2">
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center font-kids text-[10px] text-white ${hifzProgress.includes(item.number) ? 'bg-emerald-500' : 'bg-gray-200 text-gray-400'}`}>
                      {view === AppView.JUZ_30 ? (hifzProgress.includes(item.number) ? <Heart fill="currentColor" size={12}/> : item.number) : <Sparkles size={14}/>}
                    </div>
                    <span className="text-xs font-kids text-gray-700">{item.transliteration || item.title}</span>
                 </div>
                 {view === AppView.JUZ_30 && <span className="font-arabic text-lg text-sky-600">{item.name}</span>}
              </button>
             ))}
          </div>
        </div>
      );
    }

    if (view === AppView.ACHIEVEMENTS) {
      return (
        <div className="text-center py-4 animate-in zoom-in duration-300">
          <div className="bg-white rounded-[2rem] p-6 shadow-xl border-b-8 border-amber-50">
            <Trophy size={64} className="mx-auto text-amber-400 mb-2 animate-bounce" />
            <h2 className="text-2xl font-kids text-emerald-600">Barakallah!</h2>
            <div className="bg-emerald-50 p-4 rounded-[1.5rem] my-3">
              <span className="text-gray-400 text-[9px] font-bold uppercase">Skor Kamu</span>
              <div className="flex items-center justify-center gap-2">
                <Star fill="#f59e0b" className="text-amber-400" size={24}/>
                <span className="text-4xl font-kids text-amber-500">{score}</span>
              </div>
            </div>
            <button onClick={() => setView(AppView.LANDING)} className="w-full bg-emerald-500 text-white py-3 rounded-xl font-kids text-md shadow-[0_4px_0_#059669] active:translate-y-1 active:shadow-none">
              BERANDA
            </button>
          </div>
        </div>
      );
    }

    if (selectedSurah) {
      return (
        <div className="space-y-3 pb-24 animate-in slide-in-from-bottom">
           <div className="bg-white rounded-[1.5rem] p-4 text-center shadow-md">
              <div className="font-arabic text-5xl text-sky-600 mb-1 leading-tight">{selectedSurah.name}</div>
              <h2 className="text-xl font-kids text-gray-800">{selectedSurah.transliteration}</h2>
              <p className="text-[10px] text-gray-400 italic">"{selectedSurah.translation}"</p>
           </div>
           <div className="bg-amber-50 p-3 rounded-xl border-2 border-white shadow-sm">
             <h3 className="font-kids text-amber-800 text-[10px] mb-1 flex items-center gap-2"><Sun size={12}/> Pesan Moral</h3>
             <p className="text-amber-900 text-[11px] leading-tight font-medium">Buka aplikasi Quran favoritmu untuk tadarus bersama orang tuamu ya! Membaca Quran berpahala besar.</p>
           </div>
           <div className="fixed bottom-4 left-0 right-0 px-4 z-40 max-w-md mx-auto">
             <button onClick={() => {
                const newP = hifzProgress.includes(selectedSurah.number) ? hifzProgress.filter(n => n !== selectedSurah.number) : [...hifzProgress, selectedSurah.number];
                setHifzProgress(newP);
                localStorage.setItem('alifbata_hifz', JSON.stringify(newP));
             }} className={`w-full py-3 rounded-xl font-kids text-sm shadow-lg ${hifzProgress.includes(selectedSurah.number) ? 'bg-emerald-500 text-white' : 'bg-amber-400 text-amber-950'}`}>
                {hifzProgress.includes(selectedSurah.number) ? 'HAFAL! ✅' : 'TANDAI HAFAL ❤️'}
             </button>
          </div>
        </div>
      );
    }

    if (selectedPrayer) {
      return (
        <div className="animate-in fade-in py-2">
           <div className="bg-white rounded-[1.5rem] p-5 shadow-lg border-b-4 border-pink-50 text-center">
              <h2 className="text-md font-kids text-pink-800 mb-4">{selectedPrayer.title}</h2>
              <div className="font-arabic text-3xl text-emerald-700 leading-relaxed mb-4" dir="rtl">{selectedPrayer.arabic}</div>
              <div className="p-3 bg-pink-50 rounded-xl text-pink-900 italic text-[11px] mb-4 leading-relaxed">{selectedPrayer.translation}</div>
              <button onClick={() => geminiService.playSpeech(selectedPrayer.arabic, getAudioContext())} className="bg-pink-500 text-white p-3 rounded-xl mx-auto flex items-center gap-2 shadow-sm active:scale-95 text-xs">
                 <Volume2 size={16} /> DENGARKAN
              </button>
           </div>
        </div>
      );
    }

    return null;
  };

  if (!hasStarted) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center p-4 text-center z-[100] bg-sky-100 overflow-hidden">
        <BackgroundDecor />
        <div className="relative z-10 animate-in zoom-in duration-500 flex flex-col items-center">
          <div className="w-40 h-40 bg-white rounded-[2.5rem] shadow-2xl floating flex items-center justify-center mb-6 border-4 border-white">
            <ArabicLogo size="lg" />
          </div>
          <h1 className="text-4xl font-kids text-emerald-600 mb-1 drop-shadow-sm">AlifBaTa</h1>
          <p className="font-kids text-sky-600 tracking-widest text-[10px] mb-8 uppercase">Kids Edition</p>
          <button onClick={handleStartApp} className="bg-amber-400 text-amber-950 px-8 py-4 rounded-[1.5rem] font-kids text-xl shadow-[0_6px_0_#d97706] active:translate-y-1 active:shadow-none transition-all flex items-center gap-2">
            <PlayCircle size={24} /> AYO MULAI!
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-6 max-w-[360px] mx-auto px-3 pt-4 relative z-10">
      <BackgroundDecor />
      <header className="flex items-center justify-between mb-6 sticky top-2 z-50 glass p-2 rounded-xl shadow-md border border-white/40">
        <div className="flex items-center gap-1.5 cursor-pointer" onClick={() => { setView(AppView.LANDING); setSelectedSurah(null); setSelectedPrayer(null); }}>
          <div className="bg-white p-1 rounded-lg"><ArabicLogo /></div>
          <h1 className="text-md font-kids gradient-text">AlifBaTa</h1>
        </div>
        <div className="flex gap-1.5">
          <button onClick={() => { setIsMuted(!isMuted); if(!isMuted) bgMusicRef.current?.play(); else bgMusicRef.current?.pause(); }} className={`p-2 rounded-lg shadow-sm transition-all ${isMuted ? 'bg-gray-200 text-gray-400' : 'bg-amber-100 text-amber-600'}`}>
            <Music size={14} />
          </button>
          {view !== AppView.LANDING && (
            <button onClick={() => { if(selectedSurah) setSelectedSurah(null); else if(selectedPrayer) setSelectedPrayer(null); else setView(AppView.LANDING); }} className="p-2 bg-emerald-500 text-white rounded-lg shadow-sm active:scale-90">
              <ArrowLeft size={14} />
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
