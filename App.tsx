
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
  Home,
  Users,
  Palette,
  Hash,
  Sun,
  Moon,
  Dog
} from 'lucide-react';

// --- Dekorasi Latar Belakang Bergerak ---
const BackgroundDecor: React.FC = () => (
  <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
    <div className="cloud-drift top-[10%]" style={{ animationDuration: '40s' }}><Cloud size={100} color="white" fill="white" /></div>
    <div className="cloud-drift top-[40%] left-[-20%]" style={{ animationDuration: '55s' }}><Cloud size={120} color="white" fill="white" /></div>
    
    <div className="absolute top-[5%] left-[10%] star-blink text-yellow-300"><Star fill="currentColor" size={24} /></div>
    <div className="absolute top-[20%] right-[15%] star-blink text-blue-200" style={{ animationDelay: '1s' }}><Star fill="currentColor" size={20} /></div>
    <div className="absolute bottom-[20%] left-[20%] star-blink text-pink-300" style={{ animationDelay: '2s' }}><Star fill="currentColor" size={30} /></div>
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
  const [errorNotice, setErrorNotice] = useState<string | null>(null);
  const [playingAyat, setPlayingAyat] = useState<number | null>(null);
  const [loadingAyat, setLoadingAyat] = useState<number | null>(null);

  const audioContextRef = useRef<AudioContext | null>(null);
  const bgMusicRef = useRef<HTMLAudioElement | null>(null);
  const ayatAudioRef = useRef<HTMLAudioElement | null>(null);
  const clickSfx = useRef(new Audio("https://assets.mixkit.co/active_storage/sfx/2571/2571-preview.mp3"));
  const correctSfx = useRef(new Audio("https://cdn.pixabay.com/audio/2022/03/15/audio_78330a6e38.mp3"));
  const wrongSfx = useRef(new Audio("https://cdn.pixabay.com/audio/2022/03/10/audio_c356133068.mp3"));

  useEffect(() => {
    const saved = localStorage.getItem('alifbata_hifz');
    if (saved) setHifzProgress(JSON.parse(saved));

    bgMusicRef.current = new Audio("https://cdn.pixabay.com/audio/2022/10/30/audio_517935f111.mp3");
    bgMusicRef.current.loop = true;
    bgMusicRef.current.volume = 0.08;

    return () => {
      bgMusicRef.current?.pause();
      ayatAudioRef.current?.pause();
    };
  }, []);

  const playClick = () => { 
    clickSfx.current.currentTime = 0; 
    clickSfx.current.play().catch(() => {}); 
  };

  const handleStartApp = () => {
    playClick();
    setHasStarted(true);
    if (!isMuted) bgMusicRef.current?.play().catch(() => {});
  };

  const startQuiz = async (category: string) => {
    playClick();
    setLoading(true);
    setCurrentCategory(category);
    try {
      let questions = await geminiService.generateQuizQuestions(category);
      setCurrentQuiz(questions);
      setQuizIndex(0);
      setScore(0);
      setView(AppView.QUIZ_GAME);
      loadQuizMedia(0, questions);
    } catch (err) {
      setCurrentQuiz(STATIC_QUIZ_DATA[category] || []);
      setView(AppView.QUIZ_GAME);
    } finally {
      setLoading(false);
    }
  };

  const loadQuizMedia = async (index: number, questions: QuizQuestion[]) => {
    const q = questions[index];
    if (!q) return;
    setItemLoading(true);
    try {
      const imgVal = await geminiService.generateImage(q.imagePrompt);
      const audioVal = await geminiService.generateSpeech(q.arabicWord);
      const updatedQuiz = [...questions];
      updatedQuiz[index] = { ...q, generatedImage: imgVal ? `data:image/png;base64,${imgVal}` : undefined, audioData: audioVal };
      setCurrentQuiz(updatedQuiz);
    } catch (err) { console.error(err); } finally { setItemLoading(false); }
  };

  const handleAnswer = (answer: string) => {
    if (answering) return;
    setAnswering(true);
    setSelectedOption(answer);
    const isCorrect = answer === currentQuiz[quizIndex].correctAnswer;
    
    if (isCorrect) {
      setScore(s => s + 10);
      correctSfx.current.currentTime = 0;
      correctSfx.current.play().catch(() => {});
    } else {
      wrongSfx.current.currentTime = 0;
      wrongSfx.current.play().catch(() => {});
    }

    setTimeout(() => {
      if (quizIndex < currentQuiz.length - 1) {
        setQuizIndex(quizIndex + 1);
        setSelectedOption(null);
        setAnswering(false);
        loadQuizMedia(quizIndex + 1, currentQuiz);
      } else {
        setView(AppView.ACHIEVEMENTS);
      }
    }, 1500);
  };

  const openSurahDetail = async (surah: Surah) => {
    playClick();
    setSelectedSurah(surah);
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

  const toggleHifz = (num: number) => {
    playClick();
    const newProgress = hifzProgress.includes(num) 
      ? hifzProgress.filter(n => n !== num) 
      : [...hifzProgress, num];
    setHifzProgress(newProgress);
    localStorage.setItem('alifbata_hifz', JSON.stringify(newProgress));
  };

  if (!hasStarted) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center p-8 text-center z-[100] overflow-hidden">
        <BackgroundDecor />
        <div className="relative z-10 animate-in zoom-in duration-700">
          <div className="relative mb-10 flex justify-center">
            <div className="absolute inset-0 bg-white/40 blur-3xl rounded-full transform scale-150 animate-pulse"></div>
            <div className="w-64 h-64 md:w-80 md:h-80 rounded-[4rem] glass border-4 border-white shadow-2xl overflow-hidden floating flex items-center justify-center p-2">
              <img 
                src="icon.png" 
                alt="Mascot" 
                className="w-full h-full object-cover rounded-[3.5rem]" 
                onError={(e) => { (e.target as any).src = "https://cdn-icons-png.flaticon.com/512/3241/3241470.png"; }}
              />
            </div>
          </div>
          <h1 className="text-7xl font-kids mb-2 drop-shadow-xl text-emerald-600">AlifBaTa</h1>
          <h2 className="text-3xl font-kids text-sky-600 mb-8">Kids Edition</h2>
          <button onClick={handleStartApp} className="btn-chunky bg-amber-400 text-amber-950 px-14 py-8 rounded-[2.5rem] font-kids text-3xl shadow-[0_12px_0_#d97706] flex items-center gap-4 active:shadow-none active:translate-y-2 transition-all">
            <PlayCircle size={48} /> AYO MULAI!
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-20 max-w-lg mx-auto px-4 pt-8 relative z-10 font-sans">
      <BackgroundDecor />
      
      {/* Navbar Atas */}
      <div className="flex items-center justify-between mb-10 sticky top-4 z-50 glass p-5 rounded-[2.5rem] shadow-2xl border-2 border-white">
        <div className="flex items-center gap-4 cursor-pointer" onClick={() => { playClick(); setView(AppView.LANDING); setSelectedSurah(null); setSelectedPrayer(null); }}>
          <div className="w-12 h-12 bg-white rounded-2xl p-1 shadow-inner border border-emerald-50 overflow-hidden">
            <img src="icon.png" className="w-full h-full object-cover rounded-xl" onError={(e) => { (e.target as any).src = "https://cdn-icons-png.flaticon.com/512/3241/3241470.png"; }} />
          </div>
          <h1 className="text-2xl font-kids gradient-text">AlifBaTa</h1>
        </div>
        <div className="flex gap-2">
          <button onClick={() => { playClick(); setIsMuted(!isMuted); if(!isMuted) bgMusicRef.current?.play(); else bgMusicRef.current?.pause(); }} className={`p-4 rounded-2xl shadow-lg transition-all ${isMuted ? 'bg-gray-200 text-gray-500' : 'bg-amber-100 text-amber-600'}`}>
            <Music size={24} />
          </button>
          {view !== AppView.LANDING && (
            <button onClick={() => { playClick(); if(selectedSurah) setSelectedSurah(null); else if(selectedPrayer) setSelectedPrayer(null); else setView(AppView.LANDING); }} className="p-4 bg-emerald-500 text-white rounded-2xl shadow-lg active:scale-95 transition-all">
              <ArrowLeft size={24} />
            </button>
          )}
        </div>
      </div>

      {/* Halaman Beranda */}
      {view === AppView.LANDING && (
        <div className="space-y-8 animate-in slide-in-from-bottom duration-500">
          <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-[3rem] p-10 text-white shadow-2xl relative overflow-hidden border-b-[12px] border-emerald-800/20 group">
            <div className="relative z-10">
              <h2 className="text-4xl font-kids mb-2">Assalamu'alaikum!</h2>
              <p className="text-emerald-100 text-xl font-medium opacity-90">Hari ini mau belajar apa?</p>
            </div>
            <Sparkles className="absolute -right-4 -top-4 text-white/10 w-40 h-40" />
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div onClick={() => { playClick(); setView(AppView.QUIZ_MENU); }} className="btn-chunky bg-white rounded-[2.5rem] p-8 shadow-xl border-b-[10px] border-amber-100 flex flex-col items-center cursor-pointer group">
              <div className="bg-amber-400 p-6 rounded-[2rem] mb-4 text-white shadow-lg group-hover:scale-110 transition-transform">
                <Gamepad2 size={48} />
              </div>
              <h3 className="font-kids text-2xl text-amber-800">Kuis Seru</h3>
            </div>
            
            <div onClick={() => { playClick(); setView(AppView.JUZ_30); }} className="btn-chunky bg-white rounded-[2.5rem] p-8 shadow-xl border-b-[10px] border-sky-100 flex flex-col items-center cursor-pointer group">
              <div className="bg-sky-500 p-6 rounded-[2rem] mb-4 text-white shadow-lg group-hover:scale-110 transition-transform">
                <BookOpen size={48} />
              </div>
              <h3 className="font-kids text-2xl text-sky-800">Juz 30</h3>
            </div>
          </div>

          <div onClick={() => { playClick(); setView(AppView.DAILY_PRAYERS); }} className="btn-chunky bg-white rounded-[2.5rem] p-8 shadow-xl border-b-[10px] border-pink-100 flex items-center justify-between cursor-pointer group">
             <div className="flex items-center gap-6">
                <div className="bg-pink-500 p-6 rounded-[2rem] text-white shadow-lg group-hover:rotate-6 transition-transform">
                  <Heart size={40} fill="currentColor" />
                </div>
                <div>
                   <h3 className="font-kids text-3xl text-pink-800">Doa Harian</h3>
                   <p className="text-pink-400 font-bold uppercase tracking-widest text-xs mt-1">Hafalan Doa Anak Sholeh</p>
                </div>
             </div>
             <ChevronRight size={32} className="text-pink-200" />
          </div>

          <div className="glass p-8 rounded-[3rem] border-2 border-white shadow-2xl flex justify-around items-center">
            <div className="text-center">
              <div className="w-16 h-16 bg-emerald-100 rounded-2xl flex items-center justify-center mx-auto mb-2 text-emerald-600"><Star fill="currentColor" size={32}/></div>
              <span className="block text-2xl font-kids text-emerald-800">{score} Bintang</span>
            </div>
            <div className="h-16 w-px bg-emerald-200"></div>
            <div className="text-center">
              <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-2 text-blue-600"><CheckCircle2 size={32}/></div>
              <span className="block text-2xl font-kids text-blue-800">{hifzProgress.length} Hafal</span>
            </div>
          </div>
        </div>
      )}

      {/* Menu Kuis, Juz 30, atau Doa */}
      {(view === AppView.QUIZ_MENU || view === AppView.JUZ_30 || view === AppView.DAILY_PRAYERS) && !selectedSurah && !selectedPrayer && (
        <div className="space-y-6 animate-in slide-in-from-right duration-500 pb-10">
          <div className={`rounded-[3rem] p-8 text-white shadow-2xl relative overflow-hidden ${view === AppView.QUIZ_MENU ? 'bg-amber-500' : view === AppView.JUZ_30 ? 'bg-sky-500' : 'bg-pink-500'}`}>
             <h2 className="text-3xl font-kids mb-1">
               {view === AppView.QUIZ_MENU ? 'Pilih Tema Kuis' : view === AppView.JUZ_30 ? 'Pilih Surat' : 'Doa Harian'}
             </h2>
             <p className="opacity-90">Kumpulkan bintang untuk jadi pemenang! ⭐</p>
          </div>
          <div className="grid grid-cols-1 gap-4">
             {view === AppView.QUIZ_MENU ? (
               ['Hewan Lucu', 'Buah Segar', 'Benda di Rumah', 'Anggota Keluarga', 'Warna-warni', 'Angka Arab'].map((cat) => (
                 <button key={cat} onClick={() => startQuiz(cat)} className="btn-chunky bg-white rounded-[2rem] p-6 shadow-xl border-b-[8px] border-gray-100 flex items-center justify-between group">
                    <div className="flex items-center gap-5">
                       <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center">
                          {cat === 'Hewan Lucu' ? <Dog size={24}/> : <Sparkles size={24}/>}
                       </div>
                       <span className="text-xl font-kids text-gray-700">{cat}</span>
                    </div>
                    {loading && currentCategory === cat ? <Loader2 className="animate-spin text-amber-500"/> : <ChevronRight size={24} className="text-gray-300" />}
                 </button>
               ))
             ) : (view === AppView.JUZ_30 ? JUZ_30_SURAHS : DAILY_PRAYERS).map((item: any) => (
              <button key={item.number || item.id} onClick={() => view === AppView.JUZ_30 ? openSurahDetail(item) : setSelectedPrayer(item)} className="btn-chunky bg-white rounded-[2rem] p-6 shadow-xl border-b-[8px] border-gray-100 flex items-center justify-between group">
                 <div className="flex items-center gap-5">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-kids text-white ${hifzProgress.includes(item.number) ? 'bg-emerald-500' : 'bg-gray-100 text-gray-400'}`}>
                      {view === AppView.JUZ_30 ? (hifzProgress.includes(item.number) ? <Heart fill="currentColor" size={20}/> : item.number) : <Sparkles size={24}/>}
                    </div>
                    <span className="text-xl font-kids text-gray-700">{item.transliteration || item.title}</span>
                 </div>
                 {view === AppView.JUZ_30 && <span className="font-arabic text-3xl text-sky-600">{item.name}</span>}
              </button>
             ))}
          </div>
        </div>
      )}

      {/* Detail Surat Al-Qur'an */}
      {selectedSurah && (
        <div className="space-y-6 animate-in slide-in-from-bottom duration-500 pb-32">
          <div className="bg-white rounded-[3rem] p-10 shadow-2xl text-center border-b-[12px] border-sky-50">
            <div className="font-arabic text-8xl text-sky-600 mb-4">{selectedSurah.name}</div>
            <h2 className="text-4xl font-kids text-gray-800">{selectedSurah.transliteration}</h2>
            <p className="text-gray-400 italic">"{selectedSurah.translation}"</p>
          </div>
          <div className="bg-amber-50 p-8 rounded-[2.5rem] border-2 border-white shadow-xl">
             <h3 className="font-kids text-amber-800 mb-3 flex items-center gap-3"><Sun size={24}/> Cerita Singkat</h3>
             {loading ? <Loader2 className="animate-spin text-amber-400 mx-auto"/> : <p className="text-amber-900 leading-relaxed font-medium text-lg">{tafsir}</p>}
          </div>
          <div className="space-y-6">
             {verses.map((v, i) => (
               <div key={i} className="bg-white rounded-[2.5rem] p-8 shadow-xl border-b-[8px] border-gray-50">
                 <div className="flex justify-between items-center mb-6">
                   <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center font-kids text-emerald-600">{v.nomorAyat}</div>
                 </div>
                 <div className="text-right font-arabic text-5xl leading-loose text-gray-800 mb-8" dir="rtl">{v.teksArab}</div>
                 <p className="text-emerald-900 text-xl font-medium leading-relaxed italic border-t border-emerald-50 pt-6">{v.teksIndonesia}</p>
               </div>
             ))}
          </div>
          <div className="fixed bottom-8 left-0 right-0 px-8 z-40 max-w-lg mx-auto">
             <button onClick={() => toggleHifz(selectedSurah.number)} className={`w-full py-6 rounded-full font-kids text-2xl shadow-2xl btn-chunky ${hifzProgress.includes(selectedSurah.number) ? 'bg-emerald-500 text-white' : 'bg-amber-400 text-amber-950'}`}>
                {hifzProgress.includes(selectedSurah.number) ? 'Hafal! ✅' : 'Tandai Hafal ❤️'}
             </button>
          </div>
        </div>
      )}

      {/* Detail Doa Harian */}
      {selectedPrayer && (
        <div className="space-y-8 animate-in slide-in-from-bottom duration-500 pb-20">
           <div className="bg-white rounded-[3rem] p-8 shadow-2xl border-b-[12px] border-pink-50 text-center">
              <h2 className="text-3xl font-kids text-pink-800 mb-8">{selectedPrayer.title}</h2>
              <div className="font-arabic text-5xl text-emerald-700 leading-relaxed mb-8" dir="rtl">{selectedPrayer.arabic}</div>
              <div className="p-6 bg-pink-50 rounded-[2rem] text-pink-900 italic text-lg leading-relaxed mb-8">{selectedPrayer.translation}</div>
              <button onClick={() => geminiService.generateSpeech(selectedPrayer.arabic).then(d => d && new Audio(`data:audio/wav;base64,${d}`).play())} className="btn-chunky bg-pink-500 text-white p-6 rounded-3xl mx-auto flex items-center gap-3">
                 <Volume2 size={32} /> Dengarkan Doa
              </button>
           </div>
        </div>
      )}
    </div>
  );
};

export default App;
