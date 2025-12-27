
import React, { useState, useEffect, useRef } from 'react';
import { AppView, AppViewType, Surah, QuizQuestion, Verse } from './types';
import { JUZ_30_SURAHS } from './constants';
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
  Star
} from 'lucide-react';

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
    className={`bg-white rounded-3xl shadow-xl p-6 border-b-8 border-gray-100 active:translate-y-1 active:border-b-4 transition-all cursor-pointer ${className}`}
  >
    {children}
  </div>
);

const Button: React.FC<{ children: React.ReactNode; variant?: 'primary' | 'secondary' | 'danger'; onClick?: () => void; className?: string }> = ({ children, variant = 'primary', onClick, className = "" }) => {
  const styles = {
    primary: "bg-emerald-500 hover:bg-emerald-600 border-emerald-700 text-white",
    secondary: "bg-amber-400 hover:bg-amber-500 border-amber-600 text-white",
    danger: "bg-rose-500 hover:bg-rose-600 border-rose-700 text-white"
  };

  return (
    <button 
      onClick={onClick}
      className={`px-8 py-4 rounded-2xl font-kids text-xl border-b-4 transition-all active:translate-y-1 active:border-b-0 ${styles[variant]} ${className}`}
    >
      {children}
    </button>
  );
};

const MusicNotes: React.FC = () => (
  <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-30 select-none">
    <div className="absolute top-[10%] left-[5%] animate-bounce text-emerald-400" style={{ animationDuration: '3s', animationDelay: '0.2s' }}><Music size={48}/></div>
    <div className="absolute top-[40%] right-[8%] animate-pulse text-amber-400" style={{ animationDuration: '4s', animationDelay: '1s' }}><Music size={32}/></div>
    <div className="absolute bottom-[20%] left-[12%] animate-bounce text-sky-400" style={{ animationDuration: '2.5s', animationDelay: '0.5s' }}><Music size={40}/></div>
    <div className="absolute top-[60%] left-[45%] animate-pulse text-rose-400" style={{ animationDuration: '5s', animationDelay: '2s' }}><Music size={24}/></div>
  </div>
);

const App: React.FC = () => {
  const [view, setView] = useState<AppViewType>(AppView.LANDING);
  const [hasStarted, setHasStarted] = useState(false);
  const [selectedSurah, setSelectedSurah] = useState<Surah | null>(null);
  const [hifzProgress, setHifzProgress] = useState<number[]>([]);
  const [currentQuiz, setCurrentQuiz] = useState<QuizQuestion[]>([]);
  const [quizIndex, setQuizIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [loading, setLoading] = useState(false);
  const [itemLoading, setItemLoading] = useState(false);
  const [tafsir, setTafsir] = useState<string>("");
  const [verses, setVerses] = useState<Verse[]>([]);
  const [answering, setAnswering] = useState(false);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [errorNotice, setErrorNotice] = useState<string | null>(null);
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

    // Audio Inits
    bgMusicRef.current = new Audio("https://cdn.pixabay.com/audio/2022/10/30/audio_517935f111.mp3"); 
    bgMusicRef.current.loop = true;
    bgMusicRef.current.volume = 0.12; 

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

  const playArabicAudio = async (base64Audio: string) => {
    ensureMusicPlaying();
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

  const playAyatAudio = (surahNum: number, ayahNum: number, index: number) => {
    ensureMusicPlaying();
    playClick();
    if (ayatAudioRef.current) {
      ayatAudioRef.current.pause();
    }
    
    setLoadingAyat(index);
    setPlayingAyat(null);
    
    const s = surahNum.toString().padStart(3, '0');
    const a = ayahNum.toString().padStart(3, '0');
    const url = `https://mirrors.quranicaudio.com/everyayah.com/data/Alafasy_128kbps/${s}${a}.mp3`;
    
    const audio = new Audio(url);
    ayatAudioRef.current = audio;

    audio.oncanplaythrough = () => {
      setLoadingAyat(null);
      setPlayingAyat(index);
      audio.play().catch(e => {
        console.error("Murottal play error:", e);
        setErrorNotice("Gagal memutar murottal. Periksa internetmu.");
        setPlayingAyat(null);
      });
    };

    audio.onerror = () => {
      setErrorNotice("Audio ayat ini sedang tidak tersedia.");
      setLoadingAyat(null);
      setPlayingAyat(null);
    };

    audio.onended = () => setPlayingAyat(null);
  };

  const startQuiz = async (category: string) => {
    playClick();
    ensureMusicPlaying();
    setLoading(true);
    setView(AppView.QUIZ_GAME);
    setQuizIndex(0);
    setScore(0);
    setSelectedOption(null);
    setAnswering(false);
    setErrorNotice(null);
    
    try {
      const questions = await geminiService.generateQuizQuestions(category);
      if (questions.length === 0) throw new Error("Gagal mengambil soal kuis.");
      setCurrentQuiz(questions);

      const correct = await geminiService.generateSpeech("Maa Shaa Allah, Benar!");
      if (correct) setCorrectAudio(correct);
      const wrong = await geminiService.generateSpeech("Sayang sekali, kurang tepat. Ayo coba lagi!");
      if (wrong) setWrongAudio(wrong);

      await loadQuizMedia(0, questions);
    } catch (err: any) {
      setErrorNotice(err.message || "Terjadi kesalahan koneksi.");
    } finally {
      setLoading(false);
    }
  };

  const loadQuizMedia = async (index: number, questions: QuizQuestion[]) => {
    const q = questions[index];
    if (q.generatedImage && q.audioData) return; 

    setItemLoading(true);
    try {
      const img = await geminiService.generateImage(q.imagePrompt);
      const audio = await geminiService.generateSpeech(q.arabicWord);
      const updatedQuiz = [...questions];
      updatedQuiz[index] = { 
        ...q, 
        generatedImage: img ? `data:image/png;base64,${img}` : undefined,
        audioData: audio
      };
      setCurrentQuiz(updatedQuiz);
      if (audio) playArabicAudio(audio);
    } catch (err) {
      console.error("Failed to load quiz media:", err);
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
      if (correctAudio) setTimeout(() => playArabicAudio(correctAudio), 500);
    } else {
      if (wrongSfxRef.current) {
        wrongSfxRef.current.currentTime = 0;
        wrongSfxRef.current.play().catch(() => {});
      }
      if (wrongAudio) setTimeout(() => playArabicAudio(wrongAudio), 500);
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
    }, 2500);
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
        geminiService.getSurahTafsirForKids(surah.transliteration),
        fetch(`https://equran.id/api/v2/surat/${surah.number}`).then(res => res.json())
      ]);
      setTafsir(tafsirText);
      setVerses(versesRes.data.ayat);
    } catch (err) {
      console.error("Error opening surah:", err);
      setErrorNotice("Gagal memuat ayat. Periksa koneksi internetmu.");
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
      <div className="fixed inset-0 bg-emerald-500 flex flex-col items-center justify-center p-8 text-white z-[100]">
        <div className="bg-white p-10 rounded-[4rem] shadow-2xl mb-8 animate-in zoom-in-75 duration-700">
           <Sparkles size={100} className="text-emerald-500 animate-pulse" />
        </div>
        <h1 className="text-6xl font-kids mb-4 text-center tracking-tight">AlifBaTa Kids</h1>
        <p className="text-emerald-50 text-2xl mb-12 text-center max-w-sm leading-relaxed opacity-90 font-medium font-sans">
          Petualangan Seru Belajar Bahasa Arab & Hafalan Juz 30!
        </p>
        <button 
          onClick={handleStartApp}
          className="bg-amber-400 text-amber-900 px-14 py-6 rounded-full font-kids text-3xl shadow-[0_8px_0_rgb(180,120,0)] flex items-center gap-4 hover:translate-y-1 hover:shadow-[0_4px_0_rgb(180,120,0)] active:translate-y-2 active:shadow-none transition-all"
        >
          <PlayCircle size={40} /> Mulai Belajar
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-20 max-w-2xl mx-auto px-4 pt-8 relative overflow-x-hidden" onClick={ensureMusicPlaying}>
      
      {/* Navbar */}
      <div className="flex items-center justify-between mb-8 sticky top-4 z-50 bg-[#F0FDF4]/90 backdrop-blur-md p-3 rounded-[2.5rem] border-2 border-emerald-100 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="bg-emerald-500 p-2.5 rounded-2xl shadow-lg shadow-emerald-200 cursor-pointer hover:rotate-12 transition-transform" onClick={() => { playClick(); setView(AppView.LANDING); setSelectedSurah(null); }}>
            <Sparkles className="text-white w-6 h-6" />
          </div>
          <h1 className="text-2xl font-kids text-emerald-800 tracking-tight">AlifBaTa</h1>
        </div>
        
        <div className="flex items-center gap-2">
          {!isMuted && (
            <div className="flex gap-1 items-end h-5 mr-3">
              <div className="w-1.5 bg-emerald-500 h-2 animate-bounce" style={{ animationDuration: '0.6s' }}></div>
              <div className="w-1.5 bg-emerald-500 h-5 animate-bounce" style={{ animationDuration: '0.8s' }}></div>
              <div className="w-1.5 bg-emerald-500 h-3 animate-bounce" style={{ animationDuration: '0.5s' }}></div>
            </div>
          )}
          <button 
            onClick={toggleMusic}
            className={`p-3.5 rounded-2xl shadow-md transition-all active:scale-95 ${isMuted ? 'bg-gray-100 text-gray-400' : 'bg-amber-400 text-amber-900 border-2 border-amber-500/20'}`}
          >
            {isMuted ? <VolumeX className="w-6 h-6" /> : <Music className="w-6 h-6" />}
          </button>
          
          {view !== AppView.LANDING && (
            <button 
              onClick={() => {
                playClick();
                if (selectedSurah) setSelectedSurah(null);
                else setView(AppView.LANDING);
              }}
              className="p-3.5 bg-white rounded-2xl shadow-md text-emerald-600 hover:bg-emerald-50 transition-colors border-2 border-emerald-50"
            >
              <ArrowLeft className="w-6 h-6" />
            </button>
          )}
        </div>
      </div>

      {errorNotice && (
        <div className="bg-rose-50 border-2 border-rose-200 p-5 rounded-[2rem] mb-6 flex items-center gap-4 animate-in slide-in-from-top-4">
          <AlertTriangle className="text-rose-600 shrink-0" />
          <p className="text-rose-800 font-bold leading-tight font-sans">{errorNotice}</p>
          <button onClick={() => { playClick(); setErrorNotice(null); }} className="ml-auto text-rose-300 hover:text-rose-600">
            <X size={24} />
          </button>
        </div>
      )}

      {/* Landing */}
      {view === AppView.LANDING && (
        <div className="space-y-6 animate-in fade-in duration-700">
          <MusicNotes />
          <div className="bg-emerald-500 rounded-[3rem] p-10 text-white shadow-2xl relative overflow-hidden group">
            <div className="relative z-10">
              <h2 className="text-5xl font-kids mb-3">Assalamu'alaikum! 👋</h2>
              <p className="text-emerald-50 opacity-95 text-xl leading-relaxed font-medium font-sans">
                Ayo belajar bahasa Arab dan hafalan Juz 30!
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-5">
            <Card onClick={() => { playClick(); setView(AppView.QUIZ_MENU); }} className="border-amber-400 bg-amber-50 flex flex-col items-center justify-center text-center py-12 group">
              <div className="bg-amber-400 p-5 rounded-[2rem] mb-4 text-white shadow-xl group-hover:rotate-6 transition-transform"><Gamepad2 size={48} /></div>
              <h3 className="font-kids text-3xl text-amber-800">Kuis Arab</h3>
            </Card>

            <Card onClick={() => { playClick(); setView(AppView.JUZ_30); }} className="border-sky-400 bg-sky-50 flex flex-col items-center justify-center text-center py-12 group">
              <div className="bg-sky-400 p-5 rounded-[2rem] mb-4 text-white shadow-xl group-hover:-rotate-6 transition-transform"><BookOpen size={48} /></div>
              <h3 className="font-kids text-3xl text-sky-800">Juz 30</h3>
            </Card>
          </div>

          <div className="bg-white/60 backdrop-blur-sm p-8 rounded-[3rem] border-4 border-emerald-100 mt-6 shadow-sm">
            <h4 className="text-emerald-900 font-kids text-2xl text-center mb-6">Pencapaian Hebat Kamu:</h4>
            <div className="flex justify-around items-center">
              <div className="text-center">
                <Heart className="text-emerald-500 mx-auto mb-2" fill="currentColor" size={32}/>
                <span className="block text-3xl font-kids text-emerald-700">{hifzProgress.length}</span>
                <span className="text-xs font-bold text-gray-500 uppercase">Hafalan</span>
              </div>
              <div className="text-center">
                <Star className="text-amber-500 mx-auto mb-2" fill="currentColor" size={32}/>
                <span className="block text-3xl font-kids text-amber-600">{score}</span>
                <span className="text-xs font-bold text-gray-500 uppercase">Poin</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Quiz Menu */}
      {view === AppView.QUIZ_MENU && (
        <div className="space-y-6 animate-in slide-in-from-right-8 duration-500">
          <h2 className="text-4xl font-kids text-emerald-800 text-center mb-10">Kuis Kosakata Ceria</h2>
          <div className="grid grid-cols-1 gap-5">
            {['Hewan Lucu', 'Buah Segar', 'Benda di Rumah', 'Anggota Keluarga', 'Warna-warni', 'Angka Arab'].map((cat) => (
              <button 
               key={cat} 
               onClick={() => startQuiz(cat)}
               className="flex items-center justify-between bg-white p-7 rounded-[2.5rem] border-b-[10px] border-gray-100 active:translate-y-1 active:border-b-[5px] transition-all hover:bg-emerald-50 group shadow-lg"
              >
                <div className="flex items-center gap-6">
                  <div className="w-16 h-16 bg-emerald-100 rounded-2xl flex items-center justify-center text-emerald-600 group-hover:bg-emerald-500 group-hover:text-white transition-colors shadow-inner"><BrainCircuit size={32} /></div>
                  <span className="text-2xl font-bold text-gray-700 font-kids">{cat}</span>
                </div>
                <ChevronRight className="text-gray-300 group-hover:text-emerald-500 transition-colors" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Quiz Game */}
      {view === AppView.QUIZ_GAME && (
        <div className="space-y-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center pt-24 text-center">
              <Loader2 className="w-24 h-24 text-emerald-500 animate-spin mb-8" />
              <p className="text-3xl font-kids text-emerald-800">Menyiapkan Kuis Seru... </p>
            </div>
          ) : currentQuiz[quizIndex] && (
            <>
              <div className="flex items-center justify-between px-3">
                <span className="font-kids text-xl text-emerald-700">Soal {quizIndex + 1} / {currentQuiz.length}</span>
                <div className="bg-amber-400 px-6 py-2 rounded-full text-amber-950 font-kids text-xl shadow-md border-b-4 border-amber-600">Skor: {score}</div>
              </div>
              
              <div className="bg-white rounded-[4rem] p-8 shadow-2xl text-center border-b-[16px] border-gray-100 overflow-hidden flex flex-col items-center justify-center relative">
                {itemLoading ? (
                  <div className="flex flex-col items-center gap-6 py-12">
                    <Music className="text-emerald-200 w-24 h-24 animate-bounce" />
                    <p className="text-emerald-800 font-kids text-2xl">Memuat gambar... </p>
                  </div>
                ) : (
                  <>
                    {currentQuiz[quizIndex].generatedImage && (
                      <img 
                        src={currentQuiz[quizIndex].generatedImage} 
                        alt="Visual" 
                        className="w-72 h-72 object-cover rounded-[3rem] shadow-2xl mb-8 border-8 border-white ring-4 ring-emerald-50"
                      />
                    )}
                    
                    <div className="flex items-center gap-6 mb-4">
                      <div className="font-arabic text-7xl text-emerald-600 drop-shadow-md">
                        {currentQuiz[quizIndex].arabicWord}
                      </div>
                      <button 
                        onClick={() => playArabicAudio(currentQuiz[quizIndex].audioData!)}
                        className="w-16 h-16 bg-emerald-500 rounded-[1.5rem] flex items-center justify-center text-white shadow-[0_6px_0_rgb(5,150,105)] active:translate-y-1 transition-all"
                      >
                        <Volume2 size={36}/>
                      </button>
                    </div>
                    
                    <h3 className="text-3xl font-bold text-gray-800 px-8 font-kids">
                      {currentQuiz[quizIndex].question}
                    </h3>
                  </>
                )}
              </div>

              <div className="grid grid-cols-1 gap-5 pt-6">
                {currentQuiz[quizIndex].options.map((option, i) => {
                  const isSelected = selectedOption === option;
                  const isCorrect = option === currentQuiz[quizIndex].correctAnswer;
                  
                  let buttonClass = "bg-white border-gray-100 hover:border-emerald-500 text-gray-700";
                  if (answering) {
                    if (isCorrect) buttonClass = "bg-emerald-100 border-emerald-500 text-emerald-800 scale-[1.03]";
                    else if (isSelected) buttonClass = "bg-rose-100 border-rose-500 text-rose-800";
                    else buttonClass = "opacity-40";
                  }

                  return (
                    <button
                      key={i}
                      disabled={itemLoading || answering}
                      onClick={() => handleAnswer(option)}
                      className={`p-7 rounded-[2.5rem] border-2 border-b-[10px] text-2xl font-bold shadow-lg transition-all text-left flex items-center gap-6 ${buttonClass}`}
                    >
                      <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center font-kids text-2xl">
                        {String.fromCharCode(65 + i)}
                      </div>
                      <span className="font-kids">{option}</span>
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}

      {/* Juz 30 */}
      {view === AppView.JUZ_30 && !selectedSurah && (
        <div className="space-y-8 animate-in slide-in-from-right-8 duration-700">
          <div className="text-center mb-10">
            <h2 className="text-5xl font-kids text-emerald-800 mb-3">Hafalan Juz 30</h2>
            <p className="text-emerald-600 font-bold text-xl">Mari kumpulkan bintang hafalan! ⭐</p>
          </div>
          
          <div className="space-y-5">
            {JUZ_30_SURAHS.map((surah) => (
              <div 
                key={surah.number}
                className="bg-white rounded-[2.5rem] p-7 shadow-xl border-b-[10px] border-gray-100 flex items-center gap-6 hover:shadow-2xl transition-all cursor-pointer group active:scale-95"
                onClick={() => openSurahDetail(surah)}
              >
                <div 
                  className={`w-16 h-16 rounded-[1.5rem] flex items-center justify-center text-2xl font-kids border-[4px] ${
                    hifzProgress.includes(surah.number) ? 'bg-emerald-100 border-emerald-500 text-emerald-600' : 'bg-gray-50 border-gray-200 text-gray-300'
                  }`}
                  onClick={(e) => { e.stopPropagation(); toggleHifz(surah.number); }}
                >
                  {hifzProgress.includes(surah.number) ? <Heart fill="currentColor" size={32}/> : surah.number}
                </div>
                <div className="flex-1">
                  <h4 className="text-3xl font-bold text-gray-800 font-kids">{surah.transliteration}</h4>
                  <p className="text-lg text-emerald-600/70 font-bold uppercase font-sans">{surah.translation}</p>
                </div>
                <div className="text-right font-arabic text-5xl text-emerald-700">{surah.name}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {selectedSurah && (
        <div className="space-y-8 animate-in slide-in-from-bottom-12 duration-700">
          <div className="bg-white rounded-[4rem] p-12 shadow-2xl text-center border-b-[18px] border-emerald-100">
            <div className="font-arabic text-9xl text-emerald-600 mb-8">{selectedSurah.name}</div>
            <h2 className="text-5xl font-kids text-gray-800 mb-3">{selectedSurah.transliteration}</h2>
            <p className="text-2xl text-gray-500 italic font-bold">"{selectedSurah.translation}"</p>
          </div>

          <div className="bg-emerald-50 rounded-[3.5rem] p-10 relative shadow-xl border-2 border-emerald-200">
            <h3 className="text-3xl font-kids text-emerald-800 mb-6 flex items-center gap-4">
              <Sparkles size={36} className="text-amber-500 animate-pulse"/> Kisah Al-Qur'an
            </h3>
            {loading ? (
              <Loader2 className="animate-spin w-8 h-8"/>
            ) : <p className="text-emerald-900 leading-relaxed text-2xl font-medium">{tafsir}</p>}
          </div>

          <div className="space-y-6 pt-8">
             <div className="flex items-center justify-between px-4">
               <h3 className="text-3xl font-kids text-gray-800">Mari Baca! 📖</h3>
               <p className="text-xs text-emerald-600 font-black uppercase">Qari: Al-Afasy</p>
             </div>

             {verses.map((v, i) => (
               <div key={i} className={`bg-white rounded-[3rem] p-10 shadow-xl border-b-8 border-gray-100 group transition-all ${playingAyat === i ? 'ring-4 ring-amber-400' : ''}`}>
                 <div className="flex justify-between items-start mb-8">
                   <div className="w-12 h-12 rounded-full bg-emerald-500 flex items-center justify-center font-kids text-xl text-white">{v.nomorAyat}</div>
                   <button 
                    onClick={() => playAyatAudio(selectedSurah!.number, v.nomorAyat, i)}
                    className={`w-16 h-16 rounded-[1.5rem] flex items-center justify-center transition-all shadow-xl active:translate-y-2 ${playingAyat === i ? 'bg-amber-400 text-white animate-pulse' : 'bg-emerald-500 text-white'}`}
                   >
                     {loadingAyat === i ? <Loader2 className="animate-spin" size={24}/> : <Volume2 size={32}/>}
                   </button>
                 </div>
                 <div className="text-right font-arabic text-6xl leading-[6.5rem] text-gray-800 mb-8" dir="rtl">
                   {v.teksArab}
                 </div>
                 <div className="bg-gray-50 p-6 rounded-[2rem] border-l-8 border-emerald-400">
                  <p className="text-emerald-800 font-bold text-lg mb-4 italic tracking-wide">{v.teksLatin}</p>
                  <p className="text-gray-700 font-bold text-xl leading-relaxed">{v.teksIndonesia}</p>
                 </div>
               </div>
             ))}
          </div>

          <Button className="w-full text-3xl py-8 rounded-[3.5rem]" onClick={() => toggleHifz(selectedSurah.number)}>
            {hifzProgress.includes(selectedSurah.number) ? 'Sudah Hafal! ✅' : 'Tandai Hafal 💖'}
          </Button>
        </div>
      )}

      {/* Achievements */}
      {view === AppView.ACHIEVEMENTS && (
        <div className="text-center space-y-12 pt-24 animate-in zoom-in-90 duration-700">
          <Trophy size={180} className="mx-auto text-amber-500 animate-bounce" />
          <div className="space-y-6">
            <h2 className="text-7xl font-kids text-gray-800">Masya Allah!</h2>
            <p className="text-4xl text-emerald-600 font-kids">Skor Kamu: {score} Poin!</p>
          </div>
          <div className="flex flex-col gap-6 max-w-sm mx-auto">
            <Button onClick={() => { playClick(); setView(AppView.QUIZ_MENU); }} className="text-3xl py-6">Kuis Lagi 🎮</Button>
            <Button variant="secondary" onClick={() => { playClick(); setView(AppView.LANDING); }} className="text-3xl py-6">Menu Utama 🏠</Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
