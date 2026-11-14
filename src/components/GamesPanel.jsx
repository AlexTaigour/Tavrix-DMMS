import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, Gamepad2, Lock, Sparkles, TimerReset, Trophy, X, XCircle } from 'lucide-react';
import { fetchGamesContent, fetchGamesLeaderboard, submitGameScore } from '../api/client';
import { useSound } from '../hooks/useSound';

const PLAYABLE_STATUSES = new Set(['accepted', 'preparing', 'cooked']);
const GAME_META = {
  quiz: {
    label: 'Quiz',
    accent: 'text-amber-700',
    title: 'Quick Quiz',
    instruction: 'Choose the correct answer before the timer runs out.',
    palette: ['#fef3c7', '#f59e0b', '#f97316', '#7c2d12'],
  },
  memory: {
    label: 'Memory Match',
    accent: 'text-emerald-700',
    title: 'Memory Match',
    instruction: 'Clear each board to advance. Rounds add pairs and shorten the timer.',
    palette: ['#ecfdf5', '#10b981', '#065f46', '#047857'],
  },
  maths: {
    label: 'Maths Challenge',
    accent: 'text-sky-700',
    title: 'Maths Speed',
    instruction: 'Solve as many sums as you can before time runs out.',
    palette: ['#e0f2fe', '#38bdf8', '#0f172a', '#1d4ed8'],
  },
};

const GAME_STYLE = `
  @keyframes mascot-bounce { 0%, 100% { transform: translateY(1px) rotate(-3deg); } 50% { transform: translateY(-2px) rotate(3deg); } }
  @keyframes mascot-run-a { 0%, 100% { transform: rotate(16deg); } 50% { transform: rotate(-24deg); } }
  @keyframes mascot-run-b { 0%, 100% { transform: rotate(-22deg); } 50% { transform: rotate(18deg); } }
  @keyframes mascot-prop { 0%, 100% { transform: translateY(0) rotate(4deg); } 50% { transform: translateY(-2px) rotate(-5deg); } }
  @keyframes mascot-card-flip { 0%, 35%, 100% { transform: rotate(0deg) scale(1); } 48%, 70% { transform: rotate(8deg) scale(.92); } }
  @keyframes mascot-press { 0%, 55%, 100% { transform: translateY(0) scale(1); } 68%, 82% { transform: translateY(1px) scale(.88); } }
  .mascot-bounce { transform-box: fill-box; transform-origin: center; animation: mascot-bounce 0.7s ease-in-out infinite; }
  .mascot-arm-a, .mascot-leg-a { transform-box: fill-box; transform-origin: 80% 15%; animation: mascot-run-a 0.55s ease-in-out infinite; }
  .mascot-arm-b, .mascot-leg-b { transform-box: fill-box; transform-origin: 20% 15%; animation: mascot-run-b 0.55s ease-in-out infinite; }
  .mascot-prop { transform-box: fill-box; transform-origin: center; animation: mascot-prop 1s ease-in-out infinite; }
  .mascot-card-a, .mascot-card-b { transform-box: fill-box; transform-origin: center; animation: mascot-card-flip 1.7s ease-in-out infinite; }
  .mascot-card-b { animation-delay: .35s; }
  .mascot-press { transform-box: fill-box; transform-origin: center; animation: mascot-press 1.4s ease-in-out infinite; }
  @keyframes pulse-dot { 0%, 100% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.9); opacity: 0.7; } }
  @media (prefers-reduced-motion: reduce) {
    .mascot-bounce, .mascot-arm-a, .mascot-arm-b, .mascot-leg-a, .mascot-leg-b, .mascot-prop, .mascot-card-a, .mascot-card-b, .mascot-press { animation: none !important; }
  }
`;

function shallowShuffle(items) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function getLocalDateKey(date = new Date()) {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' });
  const parts = formatter.formatToParts(date);
  const map = {};
  for (const part of parts) {
    if (part.type !== 'literal') map[part.type] = part.value;
  }
  return `${map.year}-${map.month}-${map.day}`;
}

function readPendingScores() {
  try {
    const raw = localStorage.getItem('tavrix-pending-game-scores');
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writePendingScores(items) {
  try {
    localStorage.setItem('tavrix-pending-game-scores', JSON.stringify(items));
  } catch {
    // no-op; browser storage is optional for guests.
  }
}

async function retryPendingScores(onSuccess) {
  const items = readPendingScores();
  if (!items.length) return;
  const remaining = [];
  for (const item of items) {
    try {
      await submitGameScore(item);
      if (onSuccess) onSuccess();
    } catch {
      remaining.push(item);
    }
  }
  writePendingScores(remaining);
}

function GameMascot({ game }) {
  const meta = GAME_META[game];
  const ink = meta.palette[3];

  return (
    <svg viewBox="0 0 88 88" className="relative h-full w-full overflow-visible" role="img" aria-label={`${meta.title} running mascot`}>
      <ellipse cx="43" cy="77" rx="24" ry="4" fill="#292323" opacity="0.14" />

      <g className="mascot-leg-a" fill="none" stroke={ink} strokeLinecap="round" strokeLinejoin="round" strokeWidth="5">
        <path d="M35 57c-2 6-7 9-12 12" />
        <path d="M23 69c-5 1-8 0-10-2" stroke="#fff" strokeWidth="7" />
        <path d="M23 69c-5 1-8 0-10-2" stroke={ink} />
      </g>
      <g className="mascot-leg-b" fill="none" stroke={ink} strokeLinecap="round" strokeLinejoin="round" strokeWidth="5">
        <path d="M51 57c4 5 8 8 14 8" />
        <path d="M64 65c4 0 7-2 9-5" stroke="#fff" strokeWidth="7" />
        <path d="M64 65c4 0 7-2 9-5" stroke={ink} />
      </g>

      <g className="mascot-arm-a" fill="none" stroke={ink} strokeLinecap="round" strokeLinejoin="round" strokeWidth="5">
        <path d="M30 38c-6-4-10-8-14-13" />
        <circle cx="15" cy="24" r="4" fill="#fff" />
      </g>
      <g className="mascot-arm-b" fill="none" stroke={ink} strokeLinecap="round" strokeLinejoin="round" strokeWidth="5">
        <path d="M56 37c6-4 9-8 12-13" />
        <circle cx="69" cy="23" r="4" fill="#fff" />
      </g>

      <g className="mascot-bounce">
        <path d="M34 23c-7 3-11 11-10 21 1 12 9 21 20 21s19-9 20-21c1-10-3-18-10-21-3-5-6-8-10-8s-7 3-10 8Z" fill={meta.palette[1]} stroke={ink} strokeLinejoin="round" strokeWidth="3" />
        <path d="M41 18c-2-7 3-11 11-10-1 6-4 10-11 10Z" fill="#4ade80" stroke="#166534" strokeLinejoin="round" strokeWidth="2" />
        <path d="M28 50c8 5 22 6 32 0" fill="none" stroke={meta.palette[3]} strokeLinecap="round" strokeWidth="5" />
        <ellipse cx="37" cy="38" rx="3.3" ry="4.3" fill="#fff" />
        <ellipse cx="51" cy="38" rx="3.3" ry="4.3" fill="#fff" />
        <circle cx="38" cy="39" r="1.7" fill="#292323" />
        <circle cx="52" cy="39" r="1.7" fill="#292323" />
        <path d="M38 47c3 4 9 4 12 0" fill="none" stroke="#292323" strokeLinecap="round" strokeWidth="2" />
        <circle cx="32" cy="45" r="2" fill="#fb7185" opacity=".8" />
        <circle cx="56" cy="45" r="2" fill="#fb7185" opacity=".8" />
      </g>

      <g className="mascot-prop">
        {game === 'quiz' && (
          <>
            <g transform="rotate(7 72 22)">
              <rect x="61" y="5" width="23" height="35" rx="4" fill="#fff" stroke="#c2410c" strokeWidth="2.5" />
              <rect x="65" y="9" width="15" height="4" rx="2" fill="#fde68a" />
              <rect x="65" y="17" width="15" height="7" rx="2" fill="#fef3c7" />
              <circle cx="69" cy="20.5" r="1.5" fill="#f59e0b" />
              <path d="M73 20.5h5" stroke="#b45309" strokeLinecap="round" strokeWidth="1.5" />
              <rect x="65" y="27" width="15" height="8" rx="2.5" fill="#bbf7d0" stroke="#16a34a" strokeWidth="1" />
              <path d="m68 30 2 2 4-4" fill="none" stroke="#15803d" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
            </g>
            <path d="m75 28 1 8 2-2 2 3 1.5-1-2-3 3-.3-7.5-4.7Z" fill="#2563eb" stroke="#fff" strokeLinejoin="round" strokeWidth="1" />
            <path d="m58 11 2-3 2 3 3 1-3 2-2 3-2-3-3-2 3-1Z" fill="#facc15" />
          </>
        )}
        {game === 'memory' && (
          <>
            <g className="mascot-card-a" transform="rotate(-12 12 21)">
              <rect x="4" y="9" width="16" height="24" rx="3.5" fill="#fff" stroke="#047857" strokeWidth="2" />
              <path d="m12 16 2-2 2 2 2 2-6 7-6-7 2-2 2 2 2-2Z" fill="#f472b6" />
              <path d="m9 29 1.5 1.5L13 28" fill="none" stroke="#16a34a" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.6" />
            </g>
            <g className="mascot-card-b" transform="rotate(10 76 21)">
              <rect x="68" y="9" width="16" height="24" rx="3.5" fill="#dbeafe" stroke="#2563eb" strokeWidth="2" />
              <path d="m76 16 2-2 2 2 2 2-6 7-6-7 2-2 2 2 2-2Z" fill="#f472b6" />
              <path d="m73 29 1.5 1.5L77 28" fill="none" stroke="#16a34a" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.6" />
            </g>
            <circle cx="44" cy="15" r="6" fill="#fff" stroke="#16a34a" strokeWidth="1.5" />
            <path d="m41 15 2 2 4-4" fill="none" stroke="#16a34a" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
          </>
        )}
        {game === 'maths' && (
          <>
            <g transform="rotate(8 73 18)">
              <rect x="64" y="6" width="18" height="26" rx="4" fill="#fff" stroke="#1d4ed8" strokeWidth="2.5" />
              <rect x="68" y="10" width="10" height="5" rx="1.5" fill="#bfdbfe" />
              <text x="73" y="14" textAnchor="middle" fill="#1e3a8a" fontSize="4" fontWeight="900">42</text>
              <circle cx="70" cy="20" r="1.5" fill="#38bdf8" />
              <circle cx="76" cy="20" r="1.5" fill="#38bdf8" />
              <circle cx="70" cy="25" r="1.7" fill="#f59e0b" />
              <circle cx="76" cy="25" r="1.7" fill="#22c55e" />
              <circle className="mascot-press" cx="70" cy="25" r="3" fill="none" stroke="#fff" strokeWidth="1" />
            </g>
            <path d="m58 12 2-3 2 3" fill="none" stroke="#f59e0b" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
          </>
        )}
      </g>
    </svg>
  );
}

function GameCard({ game, active, onSelect, disabled }) {
  const meta = GAME_META[game];

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onSelect(game)}
      aria-label={`Play ${meta.title}`}
      className={`group flex min-h-[106px] min-w-0 flex-col items-center justify-center gap-2 rounded-2xl border p-2 text-center transition duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-chiya sm:min-h-[122px] sm:gap-2.5 sm:p-3 ${active ? 'border-chiya bg-rose-50 shadow-sm ring-2 ring-chiya/10' : 'border-espresso/10 bg-white hover:border-espresso/20 hover:shadow-sm'} ${disabled ? 'cursor-not-allowed opacity-60' : ''}`}
    >
      <div
        aria-hidden="true"
        className="relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-white/70 p-0.5 shadow-sm transition-transform group-hover:scale-105 sm:h-[72px] sm:w-[72px]"
        style={{
          background: `linear-gradient(135deg, ${meta.palette[0]} 0%, ${meta.palette[1]} 100%)`,
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.4)',
        }}
      >
        <div className="absolute inset-0 opacity-20" style={{ background: 'radial-gradient(circle at top, rgba(255,255,255,0.9), transparent 50%)' }} />
        <GameMascot game={game} />
      </div>

      <span className={`line-clamp-2 min-h-7 w-full break-words text-[11px] font-black leading-tight ${meta.accent} sm:text-xs`}>{meta.title}</span>
    </button>
  );
}

function QuestionArt({ question, badge }) {
  const artMap = {
    basic: { emoji: '🌞', gradient: 'from-amber-200 via-orange-100 to-yellow-50', glow: '#f59e0b' },
    society: { emoji: '🏘️', gradient: 'from-cyan-200 via-sky-100 to-blue-50', glow: '#2563eb' },
    family: { emoji: '👨‍👩‍👧', gradient: 'from-pink-200 via-rose-100 to-orange-50', glow: '#ec4899' },
    relationships: { emoji: '🤝', gradient: 'from-emerald-200 via-teal-100 to-green-50', glow: '#10b981' },
  };
  const style = artMap[question?.category] || artMap.basic;

  return (
    <div className={`relative overflow-hidden rounded-2xl border border-espresso/10 bg-gradient-to-br ${style.gradient}`}>
      <div className="absolute inset-0 opacity-30" style={{ background: `radial-gradient(circle at 50% 20%, ${style.glow} 0%, transparent 55%)` }} />
      <div className="relative flex items-center justify-between gap-3 p-3">
        <div className="rounded-xl bg-white/55 px-2 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-bean/70">
          {badge}
        </div>
        <div className="text-4xl drop-shadow-sm" aria-hidden="true">{style.emoji}</div>
      </div>
    </div>
  );
}

function getTextEmoji(value = '') {
  const text = String(value).toLowerCase();
  if (/sun|day|light|morning|सूर्य|सूरज/.test(text)) return '☀️';
  if (/water|river|rain|sea|drop|पानी|जल/.test(text)) return '💧';
  if (/tree|plant|leaf|रुख|पेड़/.test(text)) return '🌿';
  if (/book|read|story|school|पुस्तक/.test(text)) return '📘';
  if (/cat|dog|animal|pet|lion|cow|duck|wolf|fish|bird|बिरालो/.test(text)) return '🐾';
  if (/number|one|two|three|four|five|six|seven|eight|nine|zero/.test(text)) return '🔢';
  if (/family|mother|father|sister|brother|grand|uncle|aunt|cousin/.test(text)) return '👨‍👩‍👧';
  if (/friend|respect|kind|manners|help|community|neighbour|citizen/.test(text)) return '🤝';
  if (/flower|फूल/.test(text)) return '🌷';
  if (/festival|celebrate|holiday|diwali|new year/.test(text)) return '🎉';
  return '✨';
}

const MEMORY_PAIR_EMOJIS = {
  sun: ['🌞', '🌅'],
  water: ['💧', '🌊'],
  tree: ['🌳', '🌲'],
  book: ['📖', '📚'],
  cat: ['🐈', '🐱'],
  flower: ['🌷', '🌼'],
  one: ['1️⃣', '🔤'],
  two: ['2️⃣', '🔠'],
  three: ['3️⃣', '🔡'],
  four: ['4️⃣', '🔢'],
  five: ['5️⃣', '🔣'],
  six: ['6️⃣', '🔤'],
};

function getMemoryCardEmoji(card) {
  const pairEmojis = MEMORY_PAIR_EMOJIS[card.pairId];
  if (pairEmojis) return pairEmojis[card.face === 'front' ? 0 : 1];
  return getTextEmoji(card.value);
}

function getMemoryRoundPairCount(round, totalPairs) {
  return Math.min(totalPairs, round + 2);
}

function getMemoryRoundTime(round) {
  return Math.max(30, 75 - (round - 1) * 5);
}

function QuizGame({ bank, tableNumber, onScoreSaved, onExit, orderStatus }) {
  const { chime, wrong } = useSound();
  const [round, setRound] = useState(1);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [timeLeft, setTimeLeft] = useState(15);
  const [roundScore, setRoundScore] = useState(0);
  const [usedQuestionIds, setUsedQuestionIds] = useState([]);
  const [selectedIndex, setSelectedIndex] = useState(null);
  const [locked, setLocked] = useState(false);
  const [statusTone, setStatusTone] = useState(null);

  const difficultyCap = Math.min(3, Math.max(1, round));

  const questions = useMemo(() => {
    const preferred = bank.filter((q) => !usedQuestionIds.includes(q.id) && q.difficulty <= difficultyCap);
    const pool = preferred.length >= 4 ? preferred : bank.filter((q) => !usedQuestionIds.includes(q.id));
    return shallowShuffle(pool).slice(0, Math.min(4, pool.length));
  }, [bank, difficultyCap, usedQuestionIds]);

  const currentQuestion = questions[questionIndex];
  const questionCount = questions.length;
  const timerPercent = (timeLeft / 15) * 100;

  useEffect(() => {
    if (!currentQuestion || locked) return undefined;
    const startedAt = Date.now();
    const tick = setInterval(() => {
      const elapsed = Math.max(0, Math.ceil((Date.now() - startedAt) / 1000));
      const remaining = Math.max(0, 15 - elapsed);
      setTimeLeft(remaining);
      if (remaining <= 0) {
        clearInterval(tick);
        handleAnswer(null, true);
      }
    }, 200);
    return () => clearInterval(tick);
  }, [currentQuestion, locked]);

  useEffect(() => {
    if (orderStatus === 'served') onExit();
  }, [orderStatus, onExit]);

  useEffect(() => {
    setSelectedIndex(null);
    setStatusTone(null);
    setLocked(false);
  }, [questionIndex, round]);

  const handleAnswer = (answerIndex, timedOut = false) => {
    if (!currentQuestion || locked) return;
    setLocked(true);
    setSelectedIndex(answerIndex ?? -1);

    const correct = answerIndex != null && currentQuestion.answerIndex === answerIndex;
    const bonus = correct && !timedOut ? Math.max(0, Math.round((timeLeft / 15) * 5)) : 0;
    const earned = correct ? 10 + bonus : 0;
    const nextScore = roundScore + earned;
    setRoundScore(nextScore);
    setStatusTone(correct ? 'correct' : 'wrong');

    if (correct) {
      chime();
    } else {
      wrong();
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate([80, 40, 120]);
      }
    }

    setTimeout(() => {
      advanceRound(nextScore);
    }, 900);
  };

  const advanceRound = (nextRoundScore) => {
    const nextIndex = questionIndex + 1;
    if (nextIndex < questions.length) {
      setQuestionIndex(nextIndex);
      setTimeLeft(15);
      setSelectedIndex(null);
      setStatusTone(null);
      return;
    }

    setUsedQuestionIds((prev) => [...prev, ...questions.map((item) => item.id)]);
    setTimeout(() => {
      setRound((prev) => prev + 1);
      setQuestionIndex(0);
      setRoundScore(0);
      setTimeLeft(15);
      setSelectedIndex(null);
      setStatusTone(null);
    }, 650);

    onScoreSaved('quiz', nextRoundScore, true);
  };

  return (
    <div className="space-y-3">
      <div className="rounded-2xl bg-gradient-to-br from-[#4b211c] via-[#68291f] to-[#963a24] p-3.5 text-white shadow-sm">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="rounded-full bg-white/15 px-2.5 py-1 text-xs font-black">Round {round}</span>
              <span className="rounded-full bg-amber-300/20 px-2.5 py-1 text-xs font-black text-amber-100">Level {difficultyCap}</span>
            </div>
            <p className="mt-1 text-[10px] font-semibold text-white/65">Each round gets a little harder</p>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <div className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-white/10 px-2.5 text-sm font-black" aria-label={`Round score: ${roundScore} points`}>
              <Trophy size={15} className="text-amber-300" />
              <span>{roundScore}</span>
              <span className="text-[10px] font-bold text-white/65">PTS</span>
            </div>
            <button
              type="button"
              onClick={onExit}
              aria-label="Exit quiz game"
              className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-white/20 px-2.5 text-xs font-black text-white transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
            >
              <X size={14} /> Exit
            </button>
          </div>
        </div>
        {questionCount > 0 && (
          <div
            role="progressbar"
            aria-label="Question progress"
            aria-valuemin={1}
            aria-valuemax={questionCount}
            aria-valuenow={questionIndex + 1}
            aria-valuetext={`Question ${questionIndex + 1} of ${questionCount}`}
            className="mt-3 flex gap-1.5"
          >
            {questions.map((question, index) => (
              <span
                key={question.id}
                aria-hidden="true"
                className={`h-1.5 flex-1 rounded-full ${index < questionIndex ? 'bg-amber-300' : index === questionIndex ? 'bg-white' : 'bg-white/25'}`}
              />
            ))}
          </div>
        )}
      </div>

      {!currentQuestion ? (
        <div className="rounded-2xl border border-espresso/10 bg-white px-4 py-8 text-center shadow-sm">
          <Sparkles size={24} className="mx-auto text-chiya" />
          <p className="mt-2 text-sm font-black text-bean">Getting your quiz ready</p>
          <p className="mt-1 text-xs text-bean/55">Your next question is on its way.</p>
        </div>
      ) : (
        <>
          <QuestionArt question={currentQuestion} badge={`Question ${questionIndex + 1} of ${questionCount}`} />

          <section aria-labelledby="quiz-question" className="rounded-2xl border border-espresso/10 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-bean/45">Pick the best answer</p>
              <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs font-black ${timeLeft <= 5 ? 'bg-rose-50 text-rose-700' : 'bg-amber-50 text-amber-800'}`}>
                <TimerReset size={14} /> {timeLeft}s
              </span>
            </div>
            <h4 id="quiz-question" className="mt-2 text-lg font-black leading-snug text-bean sm:text-xl">{currentQuestion.question}</h4>
            <div
              role="progressbar"
              aria-label="Time remaining"
              aria-valuemin={0}
              aria-valuemax={15}
              aria-valuenow={timeLeft}
              className="mt-3 h-2 overflow-hidden rounded-full bg-espresso/10"
            >
              <div
                className={`h-full rounded-full transition-all duration-200 ${timeLeft <= 5 ? 'bg-rose-500' : 'bg-amber-400'}`}
                style={{ width: `${timerPercent}%` }}
              />
            </div>
          </section>

          <div role="group" aria-labelledby="quiz-question" className="grid gap-2.5 sm:grid-cols-2">
            {currentQuestion.options.map((option, index) => {
              const isCorrect = index === currentQuestion.answerIndex;
              const isSelected = index === selectedIndex;
              let choiceClass = 'border-espresso/15 bg-white text-bean hover:border-amber-400 hover:bg-amber-50';
              if (statusTone && isCorrect) choiceClass = 'border-green-500 bg-green-50 text-green-900 ring-2 ring-green-100';
              if (statusTone === 'wrong' && isSelected && !isCorrect) choiceClass = 'border-red-500 bg-red-50 text-red-900 ring-2 ring-red-100';

              return (
                <button
                  key={`${currentQuestion.id}-${index}`}
                  type="button"
                  onClick={() => handleAnswer(index, false)}
                  disabled={locked}
                  aria-pressed={isSelected}
                  className={`flex min-h-16 w-full items-center gap-3 rounded-xl border-2 px-3.5 py-3 text-left text-sm font-bold shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-chiya focus-visible:ring-offset-2 disabled:cursor-default ${choiceClass}`}
                >
                  <span className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-black ${statusTone && isCorrect ? 'bg-green-600 text-white' : statusTone === 'wrong' && isSelected ? 'bg-red-600 text-white' : 'bg-[#f5ede8] text-bean'}`}>
                    {String.fromCharCode(65 + index)}
                  </span>
                  <span className="min-w-0 flex-1 leading-snug">{option}</span>
                  {statusTone && isCorrect && <CheckCircle2 size={20} className="shrink-0 text-green-600" aria-label="Correct answer" />}
                  {statusTone === 'wrong' && isSelected && !isCorrect && <XCircle size={20} className="shrink-0 text-red-600" aria-label="Your answer" />}
                </button>
              );
            })}
          </div>

          {statusTone && (
            <div
              role="status"
              aria-live="polite"
              className={`flex items-start gap-2.5 rounded-xl px-3.5 py-3 text-sm ${statusTone === 'correct' ? 'bg-green-50 text-green-900' : 'bg-red-50 text-red-900'}`}
            >
              {statusTone === 'correct'
                ? <CheckCircle2 size={19} className="mt-0.5 shrink-0" />
                : <XCircle size={19} className="mt-0.5 shrink-0" />}
              <div>
                <p className="font-black">{statusTone === 'correct' ? 'Correct! Great job.' : selectedIndex < 0 ? "Time's up!" : 'Not quite!'}</p>
                <p className="mt-0.5 text-xs font-semibold opacity-80">
                  {statusTone === 'correct' ? 'Points added. Next question coming up.' : 'The correct answer is highlighted in green.'}
                </p>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between gap-2 rounded-xl bg-[#fff8f6] px-3.5 py-2.5">
            <p className="text-xs font-semibold text-bean/60">Correct answers earn points + a speed bonus</p>
            <span className="shrink-0 rounded-full bg-white px-2.5 py-1 text-[10px] font-black text-chiya shadow-sm">+10 PTS</span>
          </div>
        </>
      )}
    </div>
  );
}

function MemoryGame({ deck, tableNumber, onScoreSaved, onExit, orderStatus }) {
  const { chime, wrong } = useSound();
  const [cards, setCards] = useState([]);
  const [flipped, setFlipped] = useState([]);
  const [mismatchIds, setMismatchIds] = useState([]);
  const [matched, setMatched] = useState([]);
  const resolvedPair = useRef(null);
  const timeoutHandled = useRef(false);
  const [moves, setMoves] = useState(0);
  const [timeLeft, setTimeLeft] = useState(90);
  const [done, setDone] = useState(false);
  const [round, setRound] = useState(1);
  const [roundComplete, setRoundComplete] = useState(false);
  const [finalScore, setFinalScore] = useState(0);
  const pairCount = deck.pairs?.length || 0;
  const roundPairCount = getMemoryRoundPairCount(round, pairCount);
  const roundPairs = (deck.pairs || []).slice(0, roundPairCount);
  const timeLimit = getMemoryRoundTime(round);
  const timePercent = (timeLeft / timeLimit) * 100;
  const boardCleared = roundComplete;

  const buildDeck = (pairs = deck.pairs || []) => {
    const entries = pairs.flatMap((pair) => [
      { id: `${pair.id}-a`, pairId: pair.id, value: pair.left, face: 'front' },
      { id: `${pair.id}-b`, pairId: pair.id, value: pair.right, face: 'back' },
    ]);
    return shallowShuffle(entries);
  };

  useEffect(() => {
    const pairs = deck.pairs || [];
    setRound(1);
    setRoundComplete(false);
    setCards(buildDeck(pairs.slice(0, getMemoryRoundPairCount(1, pairs.length))));
    setFlipped([]);
    setMismatchIds([]);
    setMatched([]);
    setMoves(0);
    setTimeLeft(getMemoryRoundTime(1));
    setDone(false);
    setFinalScore(0);
    resolvedPair.current = null;
    timeoutHandled.current = false;
  }, [deck]);

  useEffect(() => {
    if (orderStatus === 'served') {
      onExit();
    }
  }, [orderStatus, onExit]);

  useEffect(() => {
    if (done || roundComplete || cards.length === 0) return undefined;
    const tick = setInterval(() => {
      setTimeLeft((current) => Math.max(0, current - 1));
    }, 1000);
    return () => clearInterval(tick);
  }, [cards, done, roundComplete]);

  useEffect(() => {
    if (timeLeft !== 0 || done || roundComplete || timeoutHandled.current) return;
    timeoutHandled.current = true;
    const remaining = Math.max(1, timeLeft);
    const score = Math.max(10, 100 - Math.max(0, moves - 12) * 2 - Math.max(0, timeLimit - remaining));
    setFinalScore(score);
    onScoreSaved('memory', score, true);
    setDone(true);
  }, [timeLeft, done, roundComplete, moves, onScoreSaved, timeLimit]);

  useEffect(() => {
    if (!roundComplete) return undefined;
    const timer = setTimeout(() => {
      const nextRound = round + 1;
      const pairs = deck.pairs || [];
      const nextPairCount = getMemoryRoundPairCount(nextRound, pairs.length);
      setRound(nextRound);
      setCards(buildDeck(pairs.slice(0, nextPairCount)));
      setFlipped([]);
      setMismatchIds([]);
      setMatched([]);
      setMoves(0);
      setTimeLeft(getMemoryRoundTime(nextRound));
      setRoundComplete(false);
      setDone(false);
      setFinalScore(0);
      resolvedPair.current = null;
      timeoutHandled.current = false;
    }, 1400);
    return () => clearTimeout(timer);
  }, [roundComplete, round, deck]);

  useEffect(() => {
    if (done || roundComplete) return undefined;
    if (flipped.length !== 2) {
      resolvedPair.current = null;
      return;
    }
    const [first, second] = flipped;
    const pairKey = `${first.id}:${second.id}`;
    if (resolvedPair.current === pairKey) return;
    resolvedPair.current = pairKey;

    if (first.pairId === second.pairId) {
      chime();
      setMatched((current) => [...current, first.pairId]);
      setCards((current) => current.map((card) => (card.id === first.id || card.id === second.id ? { ...card, matched: true } : card)));
      setFlipped([]);
      if (matched.length + 1 >= roundPairs.length) {
        const score = Math.max(10, 100 - Math.max(0, moves + 1 - 12) * 2 - Math.max(0, timeLimit - timeLeft));
        setFinalScore(score);
        onScoreSaved('memory', score, true);
        setRoundComplete(true);
      }
      return;
    }
    wrong();
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate([80, 40, 120]);
    }
    setMismatchIds([first.id, second.id]);
  }, [flipped, matched, deck, moves, timeLeft, onScoreSaved, chime, wrong, done, roundComplete, roundPairs.length, timeLimit]);

  useEffect(() => {
    if (mismatchIds.length === 0) return undefined;
    const timer = setTimeout(() => {
      setFlipped([]);
      setMismatchIds([]);
    }, 700);
    return () => clearTimeout(timer);
  }, [mismatchIds]);

  const clickCard = (card) => {
    if (done || roundComplete || flipped.length === 2 || matched.includes(card.pairId) || flipped.some((item) => item.id === card.id)) return;
    const nextFlipped = [...flipped, card];
    setFlipped(nextFlipped);
    setMoves((value) => value + 1);
  };

  return (
    <div className="space-y-3">
      <div className="rounded-2xl bg-gradient-to-br from-[#123c35] via-[#126b5c] to-[#159477] p-3.5 text-white shadow-sm">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-white/65">Round {round} · Memory match</p>
            <h4 className="mt-0.5 truncate text-base font-black">{deck.name}</h4>
          </div>
          <button
            type="button"
            onClick={onExit}
            aria-label="Exit memory game"
            className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-xl border border-white/25 px-3 text-xs font-black transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
          >
            <X size={14} /> Exit
          </button>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2">
          <div className="rounded-xl bg-white/10 px-2.5 py-2">
            <p className="text-[9px] font-bold uppercase text-white/60">Time</p>
            <p className="mt-0.5 inline-flex items-center gap-1.5 text-sm font-black"><TimerReset size={14} /> {timeLeft}s</p>
          </div>
          <div className="rounded-xl bg-white/10 px-2.5 py-2">
            <p className="text-[9px] font-bold uppercase text-white/60">Moves</p>
            <p className="mt-0.5 text-sm font-black">{moves}</p>
          </div>
          <div className="rounded-xl bg-white/10 px-2.5 py-2">
            <p className="text-[9px] font-bold uppercase text-white/60">Pairs</p>
            <p className="mt-0.5 text-sm font-black">{matched.length}/{roundPairCount}</p>
          </div>
        </div>
        <div
          role="progressbar"
          aria-label="Memory game time remaining"
          aria-valuemin={0}
          aria-valuemax={timeLimit}
          aria-valuenow={timeLeft}
          className="mt-3 h-2 overflow-hidden rounded-full bg-white/20"
        >
          <div
            className={`h-full rounded-full transition-all duration-500 ${timeLeft <= 15 ? 'bg-rose-300' : 'bg-amber-300'}`}
            style={{ width: `${timePercent}%` }}
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        {cards.map((card) => {
          const show = flipped.some((item) => item.id === card.id) || matched.includes(card.pairId);
          const isMatched = matched.includes(card.pairId);
          const mismatched = mismatchIds.includes(card.id);
          return (
            <button
              key={card.id}
              type="button"
              onClick={() => clickCard(card)}
              disabled={show || done || roundComplete}
              aria-pressed={show}
              aria-label={show ? `Revealed card: ${card.value}` : 'Hidden card, tap to reveal'}
              className={`aspect-[4/5] min-h-28 w-full overflow-hidden rounded-2xl border-2 p-2 shadow-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-chiya focus-visible:ring-offset-2 disabled:cursor-default ${isMatched ? 'border-emerald-500 bg-emerald-50 text-emerald-900 ring-2 ring-emerald-100' : mismatched ? 'border-rose-500 bg-rose-50 text-rose-900 ring-2 ring-rose-100' : show ? 'border-amber-300 bg-gradient-to-br from-amber-50 to-white text-bean' : 'border-[#1c6658] bg-gradient-to-br from-[#174c45] to-[#26806a] text-white hover:-translate-y-0.5 hover:shadow-md'}`}
            >
              {show ? (
                <span className="flex h-full flex-col items-center justify-center gap-1.5">
                  <span className={`flex h-11 w-11 items-center justify-center rounded-full text-3xl ${card.face === 'front' ? 'bg-amber-100' : 'bg-sky-100'}`} aria-hidden="true">
                    {getMemoryCardEmoji(card)}
                  </span>
                  <span className="line-clamp-2 text-[11px] font-black leading-tight">{card.value}</span>
                  {isMatched && <CheckCircle2 size={15} className="text-emerald-600" aria-hidden="true" />}
                </span>
              ) : (
                <span className="flex h-full flex-col items-center justify-center gap-1" aria-hidden="true">
                  <span className="text-3xl drop-shadow-sm">🃏</span>
                  <span className="text-[9px] font-black uppercase tracking-wide text-white/75">Tap to flip</span>
                </span>
              )}
            </button>
          );
        })}
      </div>

      {mismatchIds.length > 0 && (
        <div role="status" aria-live="polite" className="flex items-center gap-2 rounded-xl bg-rose-50 px-3.5 py-2.5 text-xs font-bold text-rose-800">
          <XCircle size={16} className="shrink-0" />
          <span>Not a match — try another pair!</span>
        </div>
      )}

      {roundComplete && (
        <div role="status" aria-live="polite" className="flex items-center gap-2.5 rounded-xl bg-emerald-50 px-3.5 py-3 text-sm font-bold text-emerald-900">
          <Trophy size={18} className="shrink-0" />
          <span>Round {round} cleared! +{finalScore} points. Next round gets harder.</span>
        </div>
      )}

      {done && (
        <div role="status" aria-live="polite" className={`flex items-center gap-2.5 rounded-xl px-3.5 py-3 text-sm font-bold ${boardCleared ? 'bg-emerald-50 text-emerald-900' : 'bg-amber-50 text-amber-900'}`}>
          <Trophy size={18} className="shrink-0" />
          <span>Time's up in round {round}. Round score: {finalScore}.</span>
        </div>
      )}
    </div>
  );
}

function MathsGame({ tableNumber, onScoreSaved, onExit, orderStatus }) {
  const { chime, wrong } = useSound();
  const [question, setQuestion] = useState({ prompt: 'Ready?', answer: 0 });
  const [answer, setAnswer] = useState('');
  const [answerFeedback, setAnswerFeedback] = useState(null);
  const [timeLeft, setTimeLeft] = useState(60);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [finished, setFinished] = useState(false);
  const timePercent = (timeLeft / 60) * 100;
  const finishedRef = useRef(false);

  const finishGame = (finalScore = score) => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    setFinished(true);
    if (finalScore > 0) onScoreSaved('maths', finalScore, true);
    onExit();
  };

  const makeQuestion = (easyOnly = false) => {
    const isEasy = easyOnly || timeLeft <= 20;
    const operations = isEasy ? ['+', '-'] : ['+', '-', '×', '÷'];
    const op = operations[Math.floor(Math.random() * operations.length)];
    if (op === '+') {
      const a = Math.floor(Math.random() * 20) + 1;
      const b = Math.floor(Math.random() * 20) + 1;
      setQuestion({ prompt: `${a} + ${b}`, answer: a + b, operation: op });
      return;
    }
    if (op === '-') {
      const a = Math.floor(Math.random() * 20) + 5;
      const b = Math.floor(Math.random() * a) + 1;
      setQuestion({ prompt: `${a} - ${b}`, answer: a - b, operation: op });
      return;
    }
    if (op === '×') {
      const a = Math.floor(Math.random() * 12) + 1;
      const b = Math.floor(Math.random() * 12) + 1;
      setQuestion({ prompt: `${a} × ${b}`, answer: a * b, operation: op });
      return;
    }
    const a = Math.floor(Math.random() * (isEasy ? 10 : 12)) + 1;
    const b = Math.floor(Math.random() * (isEasy ? 9 : 12)) + 1;
    const product = a * b;
    setQuestion({ prompt: `${product} ÷ ${a}`, answer: b, operation: op });
  };

  useEffect(() => {
    makeQuestion(true);
  }, []);

  useEffect(() => {
    if (orderStatus === 'served') {
      finishGame(score);
    }
  }, [orderStatus, score, finished]);

  useEffect(() => {
    if (finished) return undefined;
    const tick = setInterval(() => {
      setTimeLeft((current) => Math.max(0, current - 1));
    }, 1000);
    return () => clearInterval(tick);
  }, [finished]);

  useEffect(() => {
    if (timeLeft === 0 && !finished) finishGame(score);
  }, [timeLeft, score, finished]);

  const submitAnswer = (event) => {
    event.preventDefault();
    if (finished) return;
    const parsed = Number(answer);
    if (answer.trim() === '' || !Number.isFinite(parsed)) return;
    if (parsed === question.answer) {
      const nextStreak = streak + 1;
      const bonus = Math.floor(nextStreak / 5) * 2;
      const earned = 5 + bonus;
      setScore((current) => current + earned);
      setStreak(nextStreak);
      setAnswerFeedback({ correct: true, message: `Correct! +${earned} points` });
      chime();
    } else {
      setStreak(0);
      setAnswerFeedback({ correct: false, message: 'Not quite — no points this time.' });
      wrong();
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate([80, 40, 120]);
      }
    }
    setAnswer('');
    makeQuestion(timeLeft <= 20);
  };

  return (
    <div className="space-y-3">
      <div className="rounded-2xl bg-gradient-to-br from-[#12324c] via-[#155b80] to-[#197ca2] p-3.5 text-white shadow-sm">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-white/65">Maths speed</p>
            <p className="mt-0.5 text-sm font-black">60-second challenge</p>
          </div>
          <button
            type="button"
            onClick={() => finishGame(score)}
            aria-label="Exit maths game"
            className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-xl border border-white/25 px-3 text-xs font-black transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
          >
            <X size={14} /> Exit
          </button>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2">
          <div className="rounded-xl bg-white/10 px-2.5 py-2">
            <p className="text-[9px] font-bold uppercase text-white/60">Time</p>
            <p className="mt-0.5 inline-flex items-center gap-1.5 text-sm font-black"><TimerReset size={14} /> {timeLeft}s</p>
          </div>
          <div className="rounded-xl bg-white/10 px-2.5 py-2">
            <p className="text-[9px] font-bold uppercase text-white/60">Score</p>
            <p className="mt-0.5 inline-flex items-center gap-1.5 text-sm font-black"><Trophy size={13} className="text-amber-300" /> {score}</p>
          </div>
          <div className="rounded-xl bg-white/10 px-2.5 py-2">
            <p className="text-[9px] font-bold uppercase text-white/60">Streak</p>
            <p className="mt-0.5 text-sm font-black">{streak} <span aria-hidden="true">🔥</span></p>
          </div>
        </div>
        <div
          role="progressbar"
          aria-label="Maths challenge time remaining"
          aria-valuemin={0}
          aria-valuemax={60}
          aria-valuenow={timeLeft}
          className="mt-3 h-2 overflow-hidden rounded-full bg-white/20"
        >
          <div
            className={`h-full rounded-full transition-all duration-500 ${timeLeft <= 10 ? 'bg-rose-300' : 'bg-amber-300'}`}
            style={{ width: `${timePercent}%` }}
          />
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-sky-100 bg-white shadow-sm">
        <div className="flex items-center gap-3 bg-gradient-to-r from-sky-50 to-cyan-50 px-4 py-3">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white text-3xl shadow-sm" aria-hidden="true">🧮</span>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-black uppercase tracking-[0.13em] text-sky-800">Quick-fire maths</p>
            <p className="mt-0.5 text-xs font-semibold text-bean/55">Solve the sum to score</p>
          </div>
          <span className="text-2xl" aria-hidden="true">⚡</span>
        </div>
        <div className="p-3.5 sm:p-4">
          <p className="mb-1.5 text-[10px] font-black uppercase tracking-wide text-bean/45">Your question</p>
          <p aria-live="polite" className="rounded-xl bg-[#102c3b] px-3 py-3.5 text-center font-mono text-3xl font-black tracking-wide text-white shadow-inner sm:text-4xl">
            {question.prompt}
          </p>
        </div>
      </div>

      <form onSubmit={submitAnswer} className="rounded-2xl border border-espresso/10 bg-white p-3.5 shadow-sm">
        <label htmlFor="math-answer" className="mb-2 block text-xs font-black text-bean">Your answer</label>
        <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
          <input
            id="math-answer"
            value={answer}
            onChange={(event) => {
              setAnswer(event.target.value);
              setAnswerFeedback(null);
            }}
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete="off"
            enterKeyHint="done"
            disabled={finished}
            className="min-h-14 min-w-0 w-full rounded-xl border-2 border-espresso/10 bg-[#fffdfc] px-3 py-2 text-lg font-black text-bean outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100 disabled:opacity-60"
            placeholder="Type answer"
          />
          <button
            type="submit"
            disabled={finished || answer.trim() === ''}
            className="inline-flex min-h-14 items-center justify-center gap-1.5 rounded-xl bg-sky-700 px-4 text-sm font-black text-white shadow-sm transition-colors hover:bg-sky-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Check <CheckCircle2 size={16} />
          </button>
        </div>
      </form>

      {answerFeedback && (
        <div
          role="status"
          aria-live="polite"
          className={`flex items-center gap-2.5 rounded-xl px-3.5 py-3 text-sm font-black ${answerFeedback.correct ? 'bg-green-50 text-green-900' : 'bg-red-50 text-red-900'}`}
        >
          {answerFeedback.correct ? <CheckCircle2 size={18} /> : <XCircle size={18} />}
          <span>{answerFeedback.message}</span>
        </div>
      )}

      <div className="flex items-center gap-2 rounded-xl bg-[#fff8f6] px-3.5 py-2.5 text-xs font-semibold text-bean/60">
        <Sparkles size={15} className="shrink-0 text-chiya" />
        <span>Keep a streak going to earn bonus points!</span>
      </div>
    </div>
  );
}

export default function GamesPanel({ order }) {
  const [leaderboard, setLeaderboard] = useState([]);
  const [banks, setBanks] = useState({ quiz: [], memory: { decks: [] } });
  const [activeGame, setActiveGame] = useState(null);
  const [statusText, setStatusText] = useState('');
  const [gameScoreTotal, setGameScoreTotal] = useState(0);
  const activeGameScrollRef = useRef(null);

  const canPlay = Boolean(order && PLAYABLE_STATUSES.has(order.status));

  const refreshLeaderboard = async () => {
    try {
      const data = await fetchGamesLeaderboard();
      setLeaderboard(data.leaderboard || []);
    } catch {
      setLeaderboard([]);
    }
  };

  const loadContent = async () => {
    try {
      const data = await fetchGamesContent();
      setBanks({
        quiz: data?.quiz || [],
        memory: data?.memory || { decks: [] },
      });
    } catch {
      setBanks({ quiz: [], memory: { decks: [] } });
    }
  };

  useEffect(() => {
    loadContent();
    refreshLeaderboard();
    const interval = setInterval(refreshLeaderboard, 10000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!order) return;
    if (order.status === 'pending') {
      setStatusText('Games unlock once the restaurant confirms your order.');
      setActiveGame(null);
      setGameScoreTotal(0);
      return;
    }
    if (!canPlay) {
      setStatusText('Your food has arrived — the game ends automatically when a table is served.');
      setActiveGame(null);
      return;
    }
    if (order.status === 'served') {
      setStatusText('Food has arrived. Your final score is saved.');
      setActiveGame(null);
      return;
    }
    setStatusText('Play a quick game while the kitchen prepares your order.');
  }, [order, canPlay]);

  useEffect(() => {
    if (!activeGame) return undefined;
    const frame = requestAnimationFrame(() => {
      const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      activeGameScrollRef.current?.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
    });
    return () => cancelAnimationFrame(frame);
  }, [activeGame]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const onOnline = () => retryPendingScores();
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, []);

  const postScore = async (game, points, roundSaved = false) => {
    if (!order || !order.table || !Number.isFinite(points) || points <= 0) return;
    const payload = {
      tableNumber: String(order.table),
      game,
      points: Math.round(points),
      timestamp: new Date().toISOString(),
    };
    try {
      await submitGameScore(payload);
      if (roundSaved) {
        setStatusText(`Score saved for ${GAME_META[game].label}. Keep playing while the kitchen is still working.`);
      }
      await refreshLeaderboard();
      setGameScoreTotal((current) => current + Math.round(points));
    } catch {
      const queue = readPendingScores();
      queue.push(payload);
      writePendingScores(queue);
      setStatusText('Offline — your score is saved on this phone and will retry when the connection is back.');
    }
  };

  useEffect(() => {
    if (order && order.status === 'served' && gameScoreTotal > 0) {
      const final = gameScoreTotal;
      setGameScoreTotal(0);
      postScore(activeGame || 'quiz', final, true);
    }
  }, [order, gameScoreTotal, activeGame]);

  const handleGameEnd = () => {
    setActiveGame(null);
    setGameScoreTotal(0);
  };

  const memoryDeck = useMemo(() => {
    const deckList = banks.memory?.decks || [];
    return deckList[Math.floor(Math.random() * deckList.length)] || { name: 'Everyday Learning', pairs: [] };
  }, [banks.memory]);
  const lockedMessage = order?.status === 'pending'
    ? 'Games unlock when your order is confirmed.'
    : order?.status === 'served'
      ? 'Your order has been served. Games are now closed.'
      : 'Games are unavailable for this order.';
  const showStatusNotice = canPlay && (statusText.startsWith('Score saved') || statusText.startsWith('Offline'));

  const renderGame = () => {
    if (!activeGame) return null;
    if (activeGame === 'quiz') {
      return (
        <QuizGame
          bank={banks.quiz}
          tableNumber={order?.table}
          onScoreSaved={(game, points) => postScore(game, points, true)}
          onExit={handleGameEnd}
          orderStatus={order?.status}
        />
      );
    }
    if (activeGame === 'memory') {
      return (
        <MemoryGame
          deck={memoryDeck}
          tableNumber={order?.table}
          onScoreSaved={(game, points) => postScore(game, points, true)}
          onExit={handleGameEnd}
          orderStatus={order?.status}
        />
      );
    }
    return (
      <MathsGame
        tableNumber={order?.table}
        onScoreSaved={(game, points) => postScore(game, points, true)}
        onExit={handleGameEnd}
        orderStatus={order?.status}
      />
    );
  };

  return (
    <section aria-labelledby="games-heading" className="border-t border-espresso/10 bg-gradient-to-b from-[#fffaf8] to-white px-3 py-5 sm:px-6 sm:py-7">
      <style>{GAME_STYLE}</style>
      <div className="mb-4 flex items-center justify-between gap-3 sm:mb-5">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-chiya text-white shadow-sm">
            <Gamepad2 size={21} />
          </span>
          <div className="min-w-0">
            <p className="text-[9px] font-black uppercase tracking-[0.15em] text-chiya">Wait-time arcade</p>
            <h3 id="games-heading" className="scroll-mt-4 truncate text-lg font-black leading-tight text-bean sm:text-xl">Pick a quick game</h3>
          </div>
        </div>
        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-emerald-100 bg-white px-2.5 py-1.5 text-[9px] font-black uppercase tracking-wide text-emerald-800 sm:text-[10px]">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          Live scores
        </span>
      </div>

      {showStatusNotice && (
        <div role="status" className="mb-3 flex items-start gap-2 rounded-xl bg-white px-3 py-2.5 text-xs font-semibold leading-relaxed text-bean/65 shadow-sm">
          <Sparkles size={15} className="mt-0.5 shrink-0 text-chiya" />
          <span>{statusText}</span>
        </div>
      )}

      <div className="grid gap-3 lg:grid-cols-[1.3fr_0.7fr]">
        <section className="min-w-0 rounded-3xl border border-espresso/10 bg-white p-3 shadow-sm sm:p-4">
          {!order ? (
            <div className="flex min-h-24 items-center justify-center gap-2 text-sm font-semibold text-bean/60">
              <Sparkles size={16} className="text-chiya" /> Loading games…
            </div>
          ) : !canPlay ? (
            <div className="flex min-h-24 items-center gap-3 rounded-2xl bg-[#fff8f6] px-3 py-4 sm:px-4">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-chiya shadow-sm"><Lock size={19} /></span>
              <div>
                <p className="text-sm font-black text-bean">{order.status === 'served' ? 'Games finished' : 'Games locked'}</p>
                <p className="mt-0.5 text-xs leading-relaxed text-bean/60">{lockedMessage}</p>
              </div>
            </div>
          ) : activeGame ? (
            <div ref={activeGameScrollRef} className="scroll-mt-3">
              <div className="mb-3 flex items-start gap-2 rounded-xl bg-[#fff8f6] px-3 py-2.5 text-xs font-semibold leading-relaxed text-bean/70">
                <Sparkles size={15} className="mt-0.5 shrink-0 text-chiya" />
                <span>{GAME_META[activeGame].instruction}</span>
              </div>
              {renderGame()}
            </div>
          ) : (
            <>
              <div className="mb-3 flex items-center justify-between gap-2 px-1">
                <p className="text-xs font-black text-bean">Tap a game to start</p>
                {gameScoreTotal > 0 && (
                  <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-black text-amber-800">{gameScoreTotal} pts</span>
                )}
              </div>
              <div className="grid grid-cols-3 gap-2 sm:gap-3">
                {['quiz', 'memory', 'maths'].map((game) => (
                  <GameCard key={game} game={game} active={activeGame === game} onSelect={setActiveGame} disabled={false} />
                ))}
              </div>
              <div className="mt-3 rounded-xl bg-[#fff8f6] px-3 py-2.5">
                <p className="text-[10px] font-black uppercase tracking-wide text-bean/50">How to play</p>
                <div className="mt-1.5 space-y-1 text-[11px] leading-relaxed text-bean/65">
                  <p><span className="font-black text-amber-700">Quiz:</span> Pick the right answer before time runs out.</p>
                  <p><span className="font-black text-emerald-700">Memory:</span> Clear each board; rounds add pairs and shorten the timer.</p>
                  <p><span className="font-black text-sky-700">Maths:</span> Solve sums before the 60-second timer ends.</p>
                </div>
              </div>
              <p className="mt-2 flex items-start gap-2 px-1 text-[10px] font-medium leading-relaxed text-bean/50">
                <TimerReset size={13} className="mt-0.5 shrink-0 text-chiya" />
                Earn points for your table. Games close when your order is served.
              </p>
            </>
          )}
        </section>

        <aside aria-labelledby="leaderboard-heading" className="min-w-0 rounded-3xl border border-espresso/10 bg-[#fffaf8] p-3 sm:p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-100 text-amber-700"><Trophy size={16} /></span>
              <div>
                <h4 id="leaderboard-heading" className="text-sm font-black text-bean">Table leaderboard</h4>
                <p className="text-[10px] font-medium text-bean/45">Top scores today</p>
              </div>
            </div>
            <span className="rounded-full bg-white px-2.5 py-1 text-[9px] font-black uppercase tracking-wide text-bean/50">Today</span>
          </div>
          {leaderboard.length === 0 ? (
            <div className="flex min-h-16 items-center gap-3 rounded-2xl bg-white px-3 py-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#fff8f6] text-amber-600"><Trophy size={16} /></span>
              <p className="text-xs font-medium leading-relaxed text-bean/55">No scores yet. Be the first table to play!</p>
            </div>
          ) : (
            <ol className="space-y-1.5">
              {leaderboard.slice(0, 5).map((entry, index) => (
                <li
                  key={`${entry.tableNumber}-${index}`}
                  className={`flex min-h-10 items-center justify-between gap-3 rounded-xl px-3 py-2 ${index === 0 ? 'bg-chiya text-white shadow-sm' : 'bg-white text-bean'}`}
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-black ${index === 0 ? 'bg-white/20 text-white' : 'bg-[#fff8f6] text-bean/55'}`}>
                      {index === 0 ? <Trophy size={12} /> : index + 1}
                    </span>
                    <span className="truncate text-xs font-black">Table {entry.tableNumber}</span>
                  </span>
                  <span className={`shrink-0 text-sm font-black ${index === 0 ? 'text-white' : 'text-bean'}`}>{entry.total}<span className={`ml-1 text-[9px] font-bold ${index === 0 ? 'text-white/70' : 'text-bean/40'}`}>pts</span></span>
                </li>
              ))}
            </ol>
          )}
        </aside>
      </div>
    </section>
  );
}
