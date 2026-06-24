import { useCallback, useEffect, useState } from "react";
import {
  Button,
  Caption,
  Cell,
  Headline,
  LargeTitle,
  Placeholder,
  Section,
  Spinner,
  Title,
} from "@telegram-apps/telegram-ui";
import {
  api,
  ApiError,
  playPronunciation,
  type AnswerResp,
  type Level,
  type LeaderRow,
  type RoundResp,
  type ShopResp,
  type StateResp,
} from "./api";
import { haptic, tg } from "./telegram";

type Screen = "loading" | "home" | "play" | "leaderboard" | "shop" | "error";

export function App() {
  const [screen, setScreen] = useState<Screen>("loading");
  const [state, setState] = useState<StateResp | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  // Play state
  const [level, setLevel] = useState<Level | null>(null);
  const [round, setRound] = useState<RoundResp | null>(null);
  const [answer, setAnswer] = useState<AnswerResp | null>(null);
  const [picked, setPicked] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [usedWords, setUsedWords] = useState<string[]>([]);
  const [score, setScore] = useState({ correct: 0, total: 0 });
  const [streak, setStreak] = useState(0);

  const ru = state?.nativeLanguage === "Russian";
  const T = (rus: string, en: string) => (ru ? rus : en);

  const loadState = useCallback(async () => {
    try {
      setState(await api.state());
      setScreen("home");
    } catch {
      setErrorMsg("Couldn't load. Please reopen the app.");
      setScreen("error");
    }
  }, []);

  useEffect(() => {
    void loadState();
  }, [loadState]);

  const balanceLabel = (s: StateResp): string => {
    if (s.isAdmin) return "∞";
    if ((s.freeLeft ?? 0) > 0) return T(`🎁 ${s.freeLeft} бесплатных`, `🎁 ${s.freeLeft} free`);
    return T(`🎮 ${s.paidLeft ?? 0} раундов`, `🎮 ${s.paidLeft ?? 0} rounds`);
  };

  const fetchRound = useCallback(
    async (lv: Level, used: string[]) => {
      setBusy(true);
      setAnswer(null);
      setPicked(null);
      try {
        const r = await api.round(lv.from, lv.to, used);
        setRound(r);
        setUsedWords((w) => [...w, r.word].slice(-40));
        setScreen("play");
      } catch (e) {
        if (e instanceof ApiError && e.status === 402) {
          await openShop("out");
        } else {
          setErrorMsg(T("Не удалось создать раунд. Попробуй ещё раз.", "Couldn't generate a round. Try again."));
          setScreen("error");
        }
      } finally {
        setBusy(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const startLevel = (lv: Level) => {
    haptic.tap();
    setLevel(lv);
    setUsedWords([]);
    setScore({ correct: 0, total: 0 });
    setStreak(0);
    void fetchRound(lv, []);
  };

  const submit = async (idx: number) => {
    if (answer || busy) return;
    setPicked(idx);
    setBusy(true);
    try {
      const a = await api.answer(idx);
      setAnswer(a);
      setStreak(a.currentStreak);
      setScore((s) => ({ correct: s.correct + (a.correct ? 1 : 0), total: s.total + 1 }));
      if (a.correct) haptic.success();
      else haptic.error();
    } catch {
      setPicked(null);
      setErrorMsg(T("Ошибка. Попробуй ещё раз.", "Something went wrong. Try again."));
      setScreen("error");
    } finally {
      setBusy(false);
    }
  };

  const next = () => {
    haptic.tap();
    if (level) void fetchRound(level, usedWords);
  };

  const goHome = async () => {
    haptic.tap();
    await loadState();
  };

  // ── Shop ──
  const [shop, setShop] = useState<ShopResp | null>(null);
  const [shopNote, setShopNote] = useState<"out" | "menu">("menu");
  const [customStars, setCustomStars] = useState("");

  const openShop = async (note: "out" | "menu") => {
    setShopNote(note);
    setScreen("loading");
    try {
      setShop(await api.shop());
      setScreen("shop");
    } catch {
      setErrorMsg("Couldn't load the shop.");
      setScreen("error");
    }
  };

  const buy = async (body: { packId?: string; customStars?: number }) => {
    haptic.tap();
    try {
      const { invoiceLink } = await api.buy(body);
      tg?.openInvoice(invoiceLink, async (status) => {
        if (status === "paid") {
          haptic.success();
          await loadState();
        }
      });
    } catch {
      setErrorMsg(T("Не удалось открыть оплату.", "Couldn't open payment."));
      setScreen("error");
    }
  };

  // ── Leaderboard ──
  const [board, setBoard] = useState<LeaderRow[] | null>(null);
  const openLeaderboard = async () => {
    haptic.tap();
    setScreen("loading");
    try {
      setBoard((await api.leaderboard()).rows);
      setScreen("leaderboard");
    } catch {
      setErrorMsg("Couldn't load the leaderboard.");
      setScreen("error");
    }
  };

  // ── Render ──
  if (screen === "loading") {
    return (
      <Placeholder>
        <Spinner size="l" />
      </Placeholder>
    );
  }

  if (screen === "error") {
    return (
      <Placeholder
        header={T("Упс", "Oops")}
        description={errorMsg}
        action={
          <Button size="l" onClick={goHome}>
            {T("На главную", "Back home")}
          </Button>
        }
      />
    );
  }

  if (screen === "home" && state) {
    return (
      <div className="screen">
        <div className="hero">
          <LargeTitle weight="1">{T("Игра слов", "Word Game")}</LargeTitle>
          <Caption level="1" className="muted">
            {T(
              "Выбери уровень. Покажем слово — найди лучший синоним уровнем выше.",
              "Pick a level. We show a word — find the best higher-level synonym.",
            )}
          </Caption>
          <div className="badge">{balanceLabel(state)}</div>
        </div>

        <Section header={T("Уровень", "Level")}>
          {state.levels.map((lv) => (
            <Cell
              key={lv.label}
              onClick={() => startLevel(lv)}
              after={<span className="chev">▶</span>}
              disabled={busy}
            >
              {lv.label}
            </Cell>
          ))}
        </Section>

        <Section>
          <Cell onClick={openLeaderboard} before={<span>🏆</span>}>
            {T("Таблица лидеров", "Leaderboard")}
          </Cell>
          <Cell onClick={() => void openShop("menu")} before={<span>💎</span>}>
            {T("Пополнить раунды", "Get more rounds")}
          </Cell>
        </Section>

        {(state.bestStreak > 0 || state.weeklyCorrect > 0) && (
          <Caption level="1" className="muted center">
            🔥 {T("Лучшая серия", "Best streak")}: {state.bestStreak} · 🏆 {T("за неделю", "this week")}:{" "}
            {state.weeklyCorrect}
          </Caption>
        )}
      </div>
    );
  }

  if (screen === "play" && round) {
    const optionClass = (i: number): string => {
      if (!answer) return "opt";
      if (i === answer.correctIndex) return "opt opt-correct";
      if (i === picked) return "opt opt-wrong";
      return "opt opt-dim";
    };
    return (
      <div className="screen">
        <div className="topbar">
          <span>{level?.label}</span>
          <span>
            {T("Счёт", "Score")} {score.correct}/{score.total}
            {streak >= 2 ? `  🔥${streak}` : ""}
          </span>
        </div>

        <div className="wordcard">
          <Title weight="1" className="word">
            {round.word}
          </Title>
          {round.definition && <Caption className="muted">{round.definition}</Caption>}
          <button className="speak" onClick={() => void playPronunciation(round.word)} aria-label="play">
            🔊
          </button>
        </div>

        <Headline weight="2" className="prompt">
          {T(`Какой синоним уровня ${round.toLevel}?`, `Which ${round.toLevel} synonym fits best?`)}
        </Headline>

        <div className="options">
          {round.options.map((opt, i) => (
            <button
              key={i}
              className={optionClass(i)}
              disabled={!!answer || busy}
              onClick={() => void submit(i)}
            >
              <span className="opt-letter">{String.fromCharCode(65 + i)}</span>
              {opt}
            </button>
          ))}
        </div>

        {answer && (
          <div className="explainCard">
            <div className={answer.correct ? "verdict ok" : "verdict no"}>
              {answer.correct
                ? T("✅ Верно!", "✅ Correct!")
                : T(`❌ Лучший ответ: ${answer.correctWord}`, `❌ Best answer: ${answer.correctWord}`)}
            </div>
            <Caption className="muted">{answer.explain}</Caption>
          </div>
        )}

        <div className="actions">
          {answer && (
            <Button size="l" stretched onClick={next} loading={busy}>
              {T("Следующее слово ▶", "Next word ▶")}
            </Button>
          )}
          <Button size="l" mode="outline" stretched onClick={goHome}>
            {T("Завершить", "End")}
          </Button>
        </div>
      </div>
    );
  }

  if (screen === "leaderboard") {
    return (
      <div className="screen">
        <LargeTitle weight="1">{T("🏆 Лидеры недели", "🏆 Weekly leaders")}</LargeTitle>
        {board && board.length > 0 ? (
          <Section>
            {board.map((r, i) => (
              <Cell
                key={i}
                before={<span className="rank">{["🥇", "🥈", "🥉"][i] ?? `${i + 1}`}</span>}
                after={<span>{r.weeklyCorrect}</span>}
                subtitle={`🔥 ${r.bestStreak}`}
                className={r.me ? "me" : ""}
              >
                {r.displayName}
                {r.me ? T(" ← ты", " ← you") : ""}
              </Cell>
            ))}
          </Section>
        ) : (
          <Caption className="muted">{T("Пока никого. Будь первым!", "No scores yet. Be the first!")}</Caption>
        )}
        <div className="actions">
          <Button size="l" stretched onClick={goHome}>
            {T("На главную", "Home")}
          </Button>
        </div>
      </div>
    );
  }

  if (screen === "shop" && shop) {
    const cs = Number(customStars);
    const csValid = Number.isInteger(cs) && cs >= shop.custom.minStars && cs <= shop.custom.maxStars;
    const csRounds = csValid ? Math.floor(cs / shop.custom.starsPerRound) : 0;
    return (
      <div className="screen">
        <LargeTitle weight="1">{T("💎 Пополнить", "💎 Get rounds")}</LargeTitle>
        {shopNote === "out" && (
          <Caption className="muted">
            {T("Раунды закончились. Выбери пакет, чтобы продолжить.", "Out of rounds — pick a pack to keep playing.")}
          </Caption>
        )}
        <Caption className="muted">
          {T(`Цена: ${shop.starsPerRound} ⭐ за раунд`, `Price: ${shop.starsPerRound} ⭐ per round`)}
        </Caption>

        <Section>
          {shop.packages.map((p) => (
            <Cell
              key={p.id}
              onClick={() => void buy({ packId: p.id })}
              after={<span>{p.stars} ⭐</span>}
              subtitle={T(`${p.rounds} раундов`, `${p.rounds} rounds`)}
            >
              {p.title}
            </Cell>
          ))}
        </Section>

        <Section header={T("Своя сумма", "Custom amount")}>
          <div className="customRow">
            <input
              className="starsInput"
              type="number"
              inputMode="numeric"
              placeholder={`${shop.custom.minStars}–${shop.custom.maxStars} ⭐`}
              value={customStars}
              onChange={(e) => setCustomStars(e.target.value)}
            />
            <Button size="m" disabled={!csValid} onClick={() => void buy({ customStars: cs })}>
              {csValid ? T(`${csRounds} раундов`, `${csRounds} rounds`) : "⭐"}
            </Button>
          </div>
        </Section>

        <div className="actions">
          <Button size="l" mode="outline" stretched onClick={goHome}>
            {T("Назад", "Back")}
          </Button>
        </div>
      </div>
    );
  }

  return null;
}
