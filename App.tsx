
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
  CarFront,
  Briefcase,
  GraduationCap,
  UtensilsCrossed,
  CheckCircle2,
  XCircle,
  Apple,
  Home,
  Users,
  Palette,
  Hash,
  ShoppingBag,
  CloudRain,
  Stethoscope,
  School,
  Pizza
} from 'lucide-react';

const SUCCESS_PHRASES = ["Maa Syaa Allah! Hebat!", "Bagus sekali!", "Pintar!", "Luar biasa!", "Benar! Barakallah!", "Wah, kamu hebat!"];
const FAILURE_PHRASES = ["Ayo coba lagi!", "Jangan menyerah ya!", "Hampir benar!", "Yuk coba lagi!", "Belum tepat, ayo fokus!"];

// Pemetaan Ikon dan Warna untuk Tema Kuis
const THEME_CONFIG: Record<string, { icon: React.ReactNode, color: string, bgColor: string }> = {
  'Hewan Lucu': { icon: <Heart size={20}/>, color: 'text-amber-500', bgColor: 'bg-amber-50' },
  'Buah Segar': { icon: <Apple size={20}/>, color: 'text-emerald-500', bgColor: 'bg-emerald-50' },
  'Benda di Rumah': { icon: <Home size={20}/>, color: 'text-sky-500', bgColor: 'bg-sky-50' },
  'Anggota Keluarga': { icon: <Users size={20}/>, color: 'text-rose-500', bgColor: 'bg-rose-50' },
  'Warna-warni': { icon: <Palette size={20}/>, color: 'text-purple-500', bgColor: 'bg-purple-50' },
  'Kendaraan': { icon: <CarFront size={20}/>, color: 'text-blue-500', bgColor: 'bg-blue-50' },
  'Pakaian': { icon: <Shirt size={20}/>, color: 'text-orange-500', bgColor: 'bg-orange-50' },
  'Hobi & Olahraga': { icon: <Bike size={20}/>, color: 'text-teal-500', bgColor: 'bg-teal-50' },
  'Alam & Cuaca': { icon: <CloudRain size={20}/>, color: 'text-green-500', bgColor: 'bg-green-50' },
  'Profesi': { icon: <Stethoscope size={20}/>, color: 'text-indigo-500', bgColor: 'bg-indigo-50' },
  'Sekolah': { icon: <School size={20}/>, color: 'text-cyan-500', bgColor: 'bg-cyan-50' },
  'Makanan & Minuman': { icon: <Pizza size={20}/>, color: 'text-red-500', bgColor: 'bg-red-50' },
  'Angka Arab': { icon: <Hash size={20}/>, color: 'text-yellow-600', bgColor: 'bg-yellow-50' },
};

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
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);

  const audioContextRef = useRef<AudioContext | null>(null);
  const bgMusicRef = useRef<HTMLAudioElement | null>(null);
  const sfxCorrectRef = useRef<HTMLAudioElement | null>(null);
  const sfxWrongRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem('alifbata_hifz');
    if (saved) setHifzProgress(JSON.parse(saved));
    
    bgMusicRef.current = new Audio("https://cdn.pixabay.com/audio/2022/10/30/audio_517935f111.mp3");
    bgMusicRef.current.loop = true;
    bgMusicRef.current.volume = 0.05;

    sfxCorrectRef.current = new Audio("https://cdn.pixabay.com/audio/2021/08/04/audio_bb6300843e.mp3");
    sfxWrongRef.current = new Audio("https://cdn.pixabay.com/audio/2022/01/18/audio_8241517409.mp3");
    
    return () => {
      bgMusicRef.current?.pause();
    };
  }, []);

  const getAudioContext = () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    return audioContextRef.current;
  };

  const playSfx = (correct: boolean) => {
    if (isMuted) return;
    const sfx = correct ? sfxCorrectRef.current : sfxWrongRef.current;
    if (sfx) {
      sfx.currentTime = 0;
      sfx.play().catch(() => {});
    }
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
      const q = await geminiService.generateQuizQuestions(category);
      setCurrentQuiz(q);
      setQuizIndex(0);
      setScore(0);
      setView(AppView.QUIZ_GAME);
      loadQuizMedia(0, q);
    } catch (err: any) {
      if (err.message === 'QUOTA_EXCEEDED') {
        setErrorMsg("Batas AI tercapai. Menggunakan kuis cadangan!");
      }
      const fallback = [...(STATIC_QUIZ_DATA[category] || STATIC_QUIZ_DATA['Hewan Lucu'])];
      fallback.sort(() => Math.random() - 0.5);
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
    
    const ctx = getAudioContext();
    if (ctx.state === 'suspended') await ctx.resume();

    setItemLoading(true);
    try {
      if (!q.generatedImage) {
        const img = await geminiService.generateImage(q.imagePrompt);
        if (img) {
          const updated = [...questions];
          updated[idx] = { ...q, generatedImage: `data:image/png;base64,${img}` };
          setCurrentQuiz(updated);
        }
      }
      // Memutar audio otomatis untuk memperkenalkan kosakata
      playQuizAudio(q.arabicWord);
    } catch (e) {
      console.warn("Failed to load quiz media", e);
    } finally {
      setItemLoading(false);
    }
  };

  const playQuizAudio = async (text: string) => {
    if (isAudioPlaying) return;
    setIsAudioPlaying(true);
    const ctx = getAudioContext();
    await geminiService.playSpeech(text, ctx);
    setTimeout(() => setIsAudioPlaying(false), 2000);
  };

  const handleAnswer = (answer: string) => {
    if (answering) return;
    setAnswering(true);
    setSelectedOption(answer);
    const correct = answer === currentQuiz[quizIndex].correctAnswer;
    
    playSfx(correct);
    
    const phrases = correct ? SUCCESS_PHRASES : FAILURE_PHRASES;
    const feedback = phrases[Math.floor(Math.random() * phrases.length)];
    geminiService.playNarrator(feedback);

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
    }, 2500);
  };

  const renderContent = () => {
    if (view === AppView.QUIZ_GAME) {
      const q = currentQuiz[quizIndex];
      if (!q) return null;
      return (
        <div className="space-y-4 animate-in fade-in duration-300">
          {errorMsg && (
            <div className="bg-amber-100 border border-amber-300 text-amber-800 p-2 rounded-xl text-[10px] flex items-center gap-2">
              <AlertCircle size={14} /> {errorMsg}
            </div>
          )}
          
          <div className="flex justify-between items-center px-2">
            <div className="bg-white/90 backdrop-blur-sm px-4 py-1.5 rounded-2xl shadow-sm border border-white">
               <span className="font-kids text-sky-600 text-sm">Soal {quizIndex + 1}/{currentQuiz.length}</span>
            </div>
            <div className="flex items-center gap-2 bg-amber-400 text-white px-4 py-1.5 rounded-2xl shadow-md border-b-4 border-amber-600">
              <Star size={16} fill="currentColor" />
              <span className="font-kids text-sm">{score}</span>
            </div>
          </div>

          <div className="bg-white rounded-[2.5rem] p-5 shadow-2xl border-b-[10px] border-sky-100/50 flex flex-col items-center relative overflow-hidden">
            <div className="w-full aspect-square max-w-[220px] bg-gradient-to-b from-sky-50 to-white rounded-[2rem] overflow-hidden relative mb-4 flex items-center justify-center border-4 border-white shadow-inner">
              {itemLoading && !q.generatedImage ? (
                <div className="flex flex-col items-center">
                  <Loader2 className="animate-spin text-sky-400" size={40} />
                  <p className="font-kids text-xs text-sky-300 mt-2">Menyiapkan...</p>
                </div>
              ) : q.generatedImage ? (
                <img src={q.generatedImage} className="w-full h-full object-cover animate-in zoom-in-50 duration-500" alt="Quiz target" />
              ) : (
                <div className="flex flex-col items-center text-sky-200">
                  <ImageIcon size={50} strokeWidth={1.5} />
                </div>
              )}
              
              {answering && (
                <div className="absolute inset-0 bg-white/40 backdrop-blur-[2px] flex items-center justify-center animate-in zoom-in-90 duration-300">
                  {selectedOption === q.correctAnswer ? (
                    <CheckCircle2 size={100} className="text-emerald-500 drop-shadow-xl" />
                  ) : (
                    <XCircle size={100} className="text-rose-500 drop-shadow-xl" />
                  )}
                </div>
              )}
            </div>

            <button 
              onClick={() => playQuizAudio(q.arabicWord)} 
              disabled={isAudioPlaying}
              className={`group ${isAudioPlaying ? 'bg-sky-400 scale-95' : 'bg-sky-500 hover:bg-sky-600'} text-white px-8 py-5 rounded-[2rem] flex items-center gap-4 mb-4 shadow-lg active:scale-95 transition-all w-full justify-center border-b-4 border-sky-700`}
            >
              <div className={`p-2 rounded-xl transition-all ${isAudioPlaying ? 'bg-white text-sky-500 animate-pulse scale-110 shadow-lg' : 'bg-white/20'}`}>
                {isAudioPlaying ? <Volume2 size={28} /> : <Volume2 size={28} />}
              </div>
              <div className="flex flex-col items-start leading-none">
                <span className="text-xs font-kids opacity-80 mb-1">Klik untuk dengar:</span>
                <span className="font-arabic text-3xl" dir="rtl">{q.arabicWord}</span>
              </div>
            </button>

            <h2 className="text-lg font-kids text-gray-800 text-center leading-tight px-2">{q.question}</h2>
          </div>

          <div className="grid grid-cols-2 gap-3 pb-6">
            {q.options.map((opt, i) => {
              const isCorrect = opt === q.correctAnswer;
              const isSelected = opt === selectedOption;
              
              let buttonClass = "bg-white text-gray-700 border-gray-100 hover:bg-sky-50";
              if (answering) {
                if (isCorrect) buttonClass = "bg-emerald-500 text-white border-emerald-700 ring-4 ring-emerald-100";
                else if (isSelected) buttonClass = "bg-rose-500 text-white border-rose-700 ring-4 ring-rose-100";
                else buttonClass = "bg-white text-gray-300 border-gray-50 opacity-50";
              }

              return (
                <button
                  key={i}
                  disabled={answering}
                  onClick={() => handleAnswer(opt)}
                  className={`p-4 rounded-[1.5rem] font-kids text-sm shadow-md border-b-[6px] transition-all active:translate-y-1 h-20 flex items-center justify-center text-center leading-tight ${buttonClass} ${answering && isCorrect ? 'animate-bounce' : ''}`}
                >
                  {opt}
                </button>
              );
            })}
          </div>
        </div>
      );
    }

    if (view === AppView.QUIZ_MENU) {
      const themes = Object.keys(STATIC_QUIZ_DATA).map(key => ({
        name: key,
        ...THEME_CONFIG[key] || { icon: <Star size={20}/>, color: 'text-amber-500', bgColor: 'bg-amber-50' }
      }));

      return (
        <div className="space-y-4 animate-in slide-in-from-right duration-300 pb-12">
          <div className="rounded-[2rem] p-6 text-white shadow-xl bg-amber-500 relative overflow-hidden">
             <div className="relative z-10">
               <h2 className="text-2xl font-kids">Pilih Tema Kuis</h2>
               <p className="text-sm opacity-90">Yuk kita belajar kata-kata baru! ⭐</p>
             </div>
             <Gamepad2 className="absolute -right-6 -bottom-6 text-white/10 w-32 h-32" />
          </div>
          <div className="grid gap-3">
             {themes.map((t) => (
               <button 
                 key={t.name} 
                 onClick={() => startQuiz(t.name)} 
                 className="bg-white rounded-2xl p-4 shadow-md border-b-4 border-gray-100 flex items-center justify-between active:translate-y-1 group hover:bg-gray-50 transition-all"
               >
                  <div className="flex items-center gap-4">
                    <div className={`${t.bgColor} ${t.color} p-4 rounded-2xl group-hover:scale-110 transition-transform shadow-inner`}>
                      {t.icon}
                    </div>
                    <span className="text-md font-kids text-gray-700">{t.name}</span>
                  </div>
                  {loading && currentCategory === t.name ? (
                    <Loader2 className="animate-spin text-amber-500" size={24}/>
                  ) : (
                    <div className="bg-gray-50 p-2 rounded-full text-gray-300 group-hover:text-amber-500 group-hover:bg-amber-50 transition-colors">
                      <ChevronRight size={24} />
                    </div>
                  )}
               </button>
             ))}
          </div>
        </div>
      );
    }

    if (view === AppView.LANDING) {
      return (
        <div className="space-y-4 animate-in fade-in duration-300">
          <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-[2.5rem] p-7 text-white shadow-xl relative overflow-hidden border-b-[10px] border-emerald-700/20">
            <h2 className="text-3xl font-kids mb-1">Assalamu'alaikum!</h2>
            <p className="text-sm opacity-90 font-medium">Anak Sholeh, yuk kita mulai petualangan!</p>
            <Sparkles className="absolute -right-4 -top-4 text-white/10 w-28 h-28" />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div onClick={() => setView(AppView.QUIZ_MENU)} className="bg-white rounded-[2rem] p-6 shadow-lg border-b-[10px] border-amber-100 flex flex-col items-center cursor-pointer active:translate-y-1 active:border-b-0 transition-all hover:bg-amber-50 group">
              <div className="bg-amber-400 p-4 rounded-2xl mb-3 text-white shadow-md group-hover:scale-110 transition-transform"><Gamepad2 size={32} /></div>
              <h3 className="font-kids text-lg text-amber-800">Kuis Seru</h3>
            </div>
            <div onClick={() => setView(AppView.JUZ_30)} className="bg-white rounded-[2rem] p-6 shadow-lg border-b-[10px] border-sky-100 flex flex-col items-center cursor-pointer active:translate-y-1 active:border-b-0 transition-all hover:bg-sky-50 group">
              <div className="bg-sky-400 p-4 rounded-2xl mb-3 text-white shadow-md group-hover:scale-110 transition-transform"><BookOpen size={32} /></div>
              <h3 className="font-kids text-lg text-sky-800">Juz 30</h3>
            </div>
          </div>

          <div onClick={() => setView(AppView.DAILY_PRAYERS)} className="bg-white rounded-[2rem] p-5 shadow-lg border-b-[10px] border-pink-100 flex items-center justify-between cursor-pointer active:translate-y-1 transition-all hover:bg-pink-50 group">
            <div className="flex items-center gap-4">
              <div className="bg-pink-500 p-4 rounded-2xl text-white shadow-md group-hover:rotate-12 transition-transform"><Heart size={28} fill="currentColor" /></div>
              <div>
                <h3 className="font-kids text-xl text-pink-800 leading-tight">Doa Harian</h3>
                <p className="text-[10px] text-pink-400 font-bold uppercase tracking-wider">Hafalan Doa</p>
              </div>
            </div>
            <div className="bg-pink-50 p-2 rounded-full text-pink-500">
              <ChevronRight size={24} />
            </div>
          </div>
        </div>
      );
    }

    if ((view === AppView.JUZ_30 || view === AppView.DAILY_PRAYERS) && !selectedSurah && !selectedPrayer) {
      return (
        <div className="space-y-4 animate-in slide-in-from-right duration-300 pb-12">
          <div className={`rounded-[2rem] p-5 text-white shadow-xl ${view === AppView.JUZ_30 ? 'bg-sky-500' : 'bg-pink-500'}`}>
             <h2 className="text-xl font-kids">{view === AppView.JUZ_30 ? 'Surah Juz 30' : 'Kumpulan Doa'}</h2>
             <p className="text-xs opacity-90">Kumpulkan bintang yang banyak! ⭐</p>
          </div>
          <div className="grid gap-3">
             {(view === AppView.JUZ_30 ? JUZ_30_SURAHS : DAILY_PRAYERS).map((item: any) => (
              <button key={item.number || item.id} onClick={() => view === AppView.JUZ_30 ? setSelectedSurah(item) : setSelectedPrayer(item)} className="bg-white rounded-2xl p-4 shadow-md border-b-4 border-gray-100 flex items-center justify-between active:translate-y-1 hover:bg-sky-50 transition-all">
                 <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-kids text-xs text-white shadow-md ${hifzProgress.includes(item.number) ? 'bg-emerald-500' : 'bg-gray-200 text-gray-400'}`}>
                      {view === AppView.JUZ_30 ? (hifzProgress.includes(item.number) ? <Heart fill="currentColor" size={16}/> : item.number) : <Sparkles size={18}/>}
                    </div>
                    <span className="text-sm font-kids text-gray-700">{item.transliteration || item.title}</span>
                 </div>
                 {view === AppView.JUZ_30 && <span className="font-arabic text-2xl text-sky-600" dir="rtl">{item.name}</span>}
              </button>
             ))}
          </div>
        </div>
      );
    }

    if (view === AppView.ACHIEVEMENTS) {
      return (
        <div className="text-center py-6 animate-in zoom-in duration-300">
          <div className="bg-white rounded-[3rem] p-10 shadow-2xl border-b-[12px] border-amber-50 flex flex-col items-center">
            <div className="relative mb-6">
              <Trophy size={100} className="text-amber-400 animate-bounce" />
              <Sparkles size={40} className="absolute -top-4 -right-4 text-sky-400 animate-pulse" />
            </div>
            <h2 className="text-3xl font-kids text-emerald-600 mb-2">Maa Syaa Allah!</h2>
            <p className="text-gray-500 font-kids text-sm mb-6 uppercase tracking-widest">Kamu Hebat Sekali!</p>
            
            <div className="bg-emerald-50 p-8 rounded-[2.5rem] w-full mb-8 relative border-2 border-emerald-100 shadow-inner">
              <span className="text-gray-400 text-[10px] font-bold uppercase tracking-tighter block mb-2">Total Bintang</span>
              <div className="flex items-center justify-center gap-3">
                <Star fill="#f59e0b" className="text-amber-400 filter drop-shadow-md" size={40}/>
                <span className="text-6xl font-kids text-amber-500">{score}</span>
              </div>
            </div>

            <button onClick={() => setView(AppView.LANDING)} className="w-full bg-emerald-500 text-white py-5 rounded-[1.5rem] font-kids text-xl shadow-[0_8px_0_#059669] active:translate-y-1 active:shadow-none transition-all flex items-center justify-center gap-3">
              <RefreshCcw size={24} /> MAIN LAGI
            </button>
          </div>
        </div>
      );
    }

    if (selectedSurah) {
      return (
        <div className="space-y-4 pb-28 animate-in slide-in-from-bottom">
           <div className="bg-white rounded-[2.5rem] p-6 text-center shadow-xl border-b-[10px] border-sky-100/50">
              <div className="font-arabic text-6xl text-sky-600 mb-2 leading-tight" dir="rtl">{selectedSurah.name}</div>
              <h2 className="text-2xl font-kids text-gray-800">{selectedSurah.transliteration}</h2>
              <p className="text-xs text-gray-400 italic font-kids mt-1">"{selectedSurah.translation}"</p>
           </div>
           
           <div className="bg-amber-50 p-5 rounded-[2rem] border-2 border-white shadow-lg relative overflow-hidden">
             <div className="absolute -right-4 -bottom-4 opacity-5 rotate-12">
               <Sun size={100} />
             </div>
             <h3 className="font-kids text-amber-800 text-xs mb-2 flex items-center gap-2 uppercase tracking-wider">
               <Sun size={16}/> Pesan Motivasi
             </h3>
             <p className="text-amber-900 text-sm leading-relaxed font-bold">
               Ayo baca surat ini bareng Ayah & Ibu ya! Menghafal Al-Quran bikin hati senang dan disayang Allah SWT.
             </p>
           </div>

           <div className="fixed bottom-6 left-0 right-0 px-6 z-40 max-w-md mx-auto">
             <button onClick={() => {
                const newP = hifzProgress.includes(selectedSurah.number) ? hifzProgress.filter(n => n !== selectedSurah.number) : [...hifzProgress, selectedSurah.number];
                setHifzProgress(newP);
                localStorage.setItem('alifbata_hifz', JSON.stringify(newP));
                if (!hifzProgress.includes(selectedSurah.number)) playSfx(true);
             }} className={`w-full py-5 rounded-[1.5rem] font-kids text-lg shadow-xl active:translate-y-1 transition-all ${hifzProgress.includes(selectedSurah.number) ? 'bg-emerald-500 text-white shadow-emerald-700/30' : 'bg-amber-400 text-amber-950 shadow-amber-600/30'}`}>
                {hifzProgress.includes(selectedSurah.number) ? (
                  <div className="flex items-center justify-center gap-2">
                    <CheckCircle2 size={24} /> SUDAH HAFAL!
                  </div>
                ) : 'TANDAI HAFAL ❤️'}
             </button>
          </div>
        </div>
      );
    }

    if (selectedPrayer) {
      return (
        <div className="animate-in fade-in py-4">
           <div className="bg-white rounded-[2.5rem] p-8 shadow-2xl border-b-[10px] border-pink-100/50 text-center relative overflow-hidden">
              <div className="absolute top-0 right-0 opacity-5 -m-4">
                <Heart size={150} fill="currentColor" />
              </div>
              <h2 className="text-xl font-kids text-pink-800 mb-6 relative">{selectedPrayer.title}</h2>
              <div className="font-arabic text-4xl text-emerald-700 leading-loose mb-8 bg-emerald-50/50 p-6 rounded-[2rem] border border-emerald-100/50 shadow-inner" dir="rtl">
                {selectedPrayer.arabic}
              </div>
              <div className="p-5 bg-pink-50 rounded-[1.5rem] text-pink-900 italic text-sm mb-8 leading-relaxed font-bold">
                "{selectedPrayer.translation}"
              </div>
              <button 
                onClick={() => geminiService.playSpeech(selectedPrayer.arabic, getAudioContext())} 
                className="bg-pink-500 hover:bg-pink-600 text-white p-5 rounded-[1.5rem] mx-auto flex items-center gap-3 shadow-xl active:scale-95 transition-all w-full justify-center font-kids"
              >
                 <Volume2 size={24} /> DENGARKAN DOA
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
        <div className="relative z-10 animate-in zoom-in duration-700 flex flex-col items-center">
          <div className="w-48 h-48 bg-white rounded-[3rem] shadow-2xl floating flex items-center justify-center mb-10 border-4 border-white">
            <ArabicLogo size="lg" />
          </div>
          <h1 className="text-5xl font-kids text-emerald-600 mb-2 drop-shadow-md">AlifBaTa</h1>
          <p className="font-kids text-sky-600 tracking-[0.3em] text-sm mb-12 uppercase">Belajar Arab Seru</p>
          <button onClick={handleStartApp} className="bg-amber-400 text-amber-950 px-12 py-6 rounded-[2rem] font-kids text-2xl shadow-[0_10px_0_#d97706] active:translate-y-2 active:shadow-none transition-all flex items-center gap-4 group">
            <PlayCircle size={40} className="group-hover:rotate-12 transition-transform" /> AYO MULAI!
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-10 max-w-[400px] mx-auto px-4 pt-6 relative z-10">
      <BackgroundDecor />
      <header className="flex items-center justify-between mb-8 sticky top-4 z-50 glass p-3 rounded-2xl shadow-xl border border-white/50">
        <div className="flex items-center gap-2 cursor-pointer group" onClick={() => { setView(AppView.LANDING); setSelectedSurah(null); setSelectedPrayer(null); }}>
          <div className="bg-white p-1.5 rounded-xl shadow-md group-active:scale-95 transition-transform"><ArabicLogo /></div>
          <h1 className="text-lg font-kids gradient-text tracking-tight">AlifBaTa</h1>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => { setIsMuted(!isMuted); if(isMuted) bgMusicRef.current?.play(); else bgMusicRef.current?.pause(); }} 
            className={`p-3 rounded-xl shadow-md transition-all active:scale-90 ${isMuted ? 'bg-gray-200 text-gray-400' : 'bg-amber-100 text-amber-600 hover:bg-amber-200'}`}
          >
            {isMuted ? <Music size={18} className="opacity-40" /> : <Music size={18} />}
          </button>
          {view !== AppView.LANDING && (
            <button onClick={() => { if(selectedSurah) setSelectedSurah(null); else if(selectedPrayer) setSelectedPrayer(null); else setView(AppView.LANDING); }} className="p-3 bg-emerald-500 text-white rounded-xl shadow-md active:scale-90 hover:bg-emerald-600">
              <ArrowLeft size={18} />
            </button>
          )}
        </div>
      </header>
      <main className="relative z-10 pb-10">
        {renderContent()}
      </main>
    </div>
  );
};

export default App;
