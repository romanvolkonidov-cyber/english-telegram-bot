import type { Language } from "./config.js";

/**
 * Flat translation dictionaries. The English dictionary defines the set of
 * valid keys; the Russian one must implement every key (enforced by the
 * type below). Placeholders look like {name} and are filled by `t()`.
 *
 * Callers are responsible for HTML-escaping any user/content values they
 * pass in (see util/format.ts `esc`), because messages are sent with
 * parse_mode "HTML".
 */
const en = {
  // ── onboarding / auth ──
  welcome:
    "👋 <b>Welcome to your English homework bot!</b>\n\nHere you can see and do the same homework as on the website, and review your results.\n\nPlease log in with the username and password your teacher gave you.",
  ask_username: "👤 Enter your <b>username</b>:",
  ask_password: "🔑 Now enter your <b>password</b>:",
  login_success: "✅ Welcome, <b>{name}</b>!",
  login_failed:
    "❌ That username or password didn't match. Type /start to try again.",
  already_logged_in: "You're already logged in as <b>{name}</b>.",
  logged_out: "👋 Logged out. Type /start to log in again.",
  not_logged_in: "You're not logged in. Type /start to begin.",
  teacher_welcome: "👩‍🏫 <b>Teacher mode</b>\n\nPick what you'd like to do.",

  // ── language ──
  choose_language: "🌐 Choose your language:",
  language_set: "✅ Language set to English.",

  // ── student main menu ──
  main_menu_title: "🏠 <b>Main menu</b> — what would you like to do?",
  menu_greeting: "👋 Hi, <b>{name}</b>!",
  menu_pending: "📚 Homework to do: <b>{n}</b>",
  menu_caught_up: "🎉 You're all caught up — no homework right now!",
  menu_homework: "📚 My homework",
  menu_results: "📊 My results",
  menu_progress: "🎮 My progress",
  menu_language: "🌐 Language",
  menu_logout: "🚪 Log out",

  // ── homework list ──
  hw_list_title: "📚 <b>Your homework</b>",
  hw_none:
    "🎉 You have no pending homework right now. Great job staying on top of it!",
  hw_item: "{topic} · {count}Q · {date}",
  hw_questions: "{count} questions",

  // ── quiz ──
  quiz_started: "📝 <b>{topic}</b>\n{count} questions. Let's go!",
  quiz_progress: "<b>Question {i}/{n}</b>",
  quiz_prompt_text: "✍️ Type your answer:",
  quiz_prompt_fill: "✍️ Type the missing word(s):",
  quiz_prompt_choice: "👇 Choose the correct answer:",
  quiz_prompt_voice:
    "🎤 Send a <b>voice message</b> with your spoken answer.",
  quiz_voice_processing: "🎧 Listening to your answer…",
  quiz_voice_feedback: "🗣 <b>Feedback:</b> {feedback}",
  quiz_voice_saved: "🎤 Recorded ✓ Your teacher will listen to this.",
  quiz_expecting_text:
    "Please type your answer as a message, or use the buttons below.",
  quiz_expecting_voice:
    "Please reply with a 🎤 voice message (or press Skip).",
  quiz_skip: "⏭ Skip",
  quiz_cancel: "✖️ Quit",
  quiz_cancelled: "Homework cancelled. Your progress was not saved.",
  quiz_submitting: "⏳ Checking your answers…",

  // ── submission result ──
  result_title: "🎉 <b>Homework complete!</b>",
  result_score: "📊 Score: <b>{correct}/{total}</b> ({pct}%)",
  result_rewards: "✨ <b>+{xp} XP</b>   🪙 <b>+{coins}</b>",
  result_levelup: "⬆️ <b>Level up!</b> {emoji} Level {level} — {title}",
  result_streak_kept: "🔥 {n}-week streak — keep it alive!",
  result_streak_started: "🔥 Streak started — come back next week!",
  result_badges: "🏅 New badge: {badges}",

  // ── results history / review ──
  results_title: "📊 <b>Your results</b>",
  results_none: "You haven't completed any homework yet.",
  results_item: "{topic} · {pct}% · {date}",
  report_header: "📋 <b>{topic}</b>\n📊 Score: <b>{pct}%</b> ({correct}/{total})",
  report_q_correct: "✅ <b>Q{i}.</b> {q}",
  report_q_wrong: "❌ <b>Q{i}.</b> {q}",
  report_q_voice: "🎤 <b>Q{i}.</b> {q}",
  report_your_answer: "   • Your answer: {a}",
  report_correct_answer: "   • Correct: <i>{a}</i>",
  report_transcript: "   • 📝 You said: <i>{t}</i>",
  report_feedback: "   • 🗣 {f}",
  report_no_answer: "— (no answer)",
  report_voice_note: "🎤 Voice answer for Q{i}:",
  report_questions_changed:
    "⚠️ Questions were updated since this was completed — showing your saved answers.",
  review_end: "— end of review —",

  // ── progress ──
  progress_title: "🎮 <b>Your progress</b>",
  progress_level: "{emoji} <b>Level {level}</b> — {title}",
  progress_xp: "✨ {current}/{needed} XP to next level",
  progress_xp_max: "✨ {xp} XP — max level reached! 🏆",
  progress_coins: "🪙 Coins: <b>{coins}</b>",
  progress_streak: "🔥 Streak: <b>{streak}</b> week(s) (best {best})",
  progress_done: "✅ Homeworks completed: <b>{n}</b>",
  progress_badges: "🏅 Badges earned: <b>{n}</b>",
  progress_web_hint:
    "💡 Open the website to spend coins, grow your tree and care for your pet.",

  // ── teacher ──
  teacher_menu_students: "👩‍🎓 Students",
  teacher_menu_logout: "🚪 Log out",
  teacher_students_title:
    "👩‍🎓 <b>Students</b> — tap one to see their homework. 🔴 = new submissions.",
  teacher_student_btn: "{name}",
  teacher_student_btn_unseen: "🔴 {name} ({n})",
  teacher_no_students: "No students found.",
  teacher_reports_title: "📋 <b>{name}</b> — submitted homework:",
  teacher_no_reports: "No completed homework for this student yet.",
  teacher_report_btn: "{topic} · {pct}% · {date}",
  teacher_notify:
    "📩 <b>{name}</b> finished <b>{topic}</b>\n📊 {pct}% ({correct}/{total})",
  teacher_notify_view: "👀 Review",

  // ── reminders ──
  reminder_message:
    "⏰ <b>Lesson reminder</b>\n{subject} — starts in about <b>{minutes}</b> min (at <b>{time}</b>).",
  reminder_morning: "🌅 <b>Good morning!</b> {subject} — today at <b>{time}</b>.",
  reminder_default_subject: "Your lesson",
  reminders_enabled: "🔔 Lesson reminders are now <b>on</b>.",
  reminders_disabled: "🔕 Lesson reminders are now <b>off</b>. Send /reminders to turn them back on.",
  new_homework: "📚 <b>New homework!</b> {topic}\n\nOpen the menu to do it 👇",

  // ── generic ──
  btn_back: "⬅️ Back",
  btn_menu: "🏠 Menu",
  btn_open: "▶️ Open",
  btn_view: "👀 View",
  error_generic: "⚠️ Something went wrong. Please try again.",
  loading: "⏳ Loading…",
  help:
    "ℹ️ <b>Help</b>\n\n/start — log in or open the bot\n/menu — main menu\n/language — change language\n/reminders — turn lesson reminders on/off\n/logout — log out\n\nDo your homework right here in the chat, then review your results any time.",
} as const;

type TranslationKey = keyof typeof en;

const ru: Record<TranslationKey, string> = {
  welcome:
    "👋 <b>Добро пожаловать в бота для домашних заданий по английскому!</b>\n\nЗдесь можно видеть и выполнять те же домашние задания, что и на сайте, а также смотреть свои результаты.\n\nВойдите, используя логин и пароль, которые дал преподаватель.",
  ask_username: "👤 Введите ваш <b>логин</b>:",
  ask_password: "🔑 Теперь введите <b>пароль</b>:",
  login_success: "✅ Здравствуйте, <b>{name}</b>!",
  login_failed:
    "❌ Логин или пароль не подошли. Напишите /start, чтобы попробовать снова.",
  already_logged_in: "Вы уже вошли как <b>{name}</b>.",
  logged_out: "👋 Вы вышли. Напишите /start, чтобы войти снова.",
  not_logged_in: "Вы не вошли. Напишите /start, чтобы начать.",
  teacher_welcome: "👩‍🏫 <b>Режим преподавателя</b>\n\nВыберите действие.",

  choose_language: "🌐 Выберите язык:",
  language_set: "✅ Язык переключён на русский.",

  main_menu_title: "🏠 <b>Главное меню</b> — что хотите сделать?",
  menu_greeting: "👋 Привет, <b>{name}</b>!",
  menu_pending: "📚 Заданий к выполнению: <b>{n}</b>",
  menu_caught_up: "🎉 Всё выполнено — заданий пока нет!",
  menu_homework: "📚 Домашние задания",
  menu_results: "📊 Мои результаты",
  menu_progress: "🎮 Мой прогресс",
  menu_language: "🌐 Язык",
  menu_logout: "🚪 Выйти",

  hw_list_title: "📚 <b>Ваши домашние задания</b>",
  hw_none: "🎉 Сейчас нет невыполненных заданий. Отличная работа!",
  hw_item: "{topic} · {count}в. · {date}",
  hw_questions: "{count} вопрос(ов)",

  quiz_started: "📝 <b>{topic}</b>\nВопросов: {count}. Поехали!",
  quiz_progress: "<b>Вопрос {i}/{n}</b>",
  quiz_prompt_text: "✍️ Введите ответ:",
  quiz_prompt_fill: "✍️ Впишите пропущенное слово(а):",
  quiz_prompt_choice: "👇 Выберите правильный ответ:",
  quiz_prompt_voice:
    "🎤 Отправьте <b>голосовое сообщение</b> с устным ответом.",
  quiz_voice_processing: "🎧 Слушаю ваш ответ…",
  quiz_voice_feedback: "🗣 <b>Отзыв:</b> {feedback}",
  quiz_voice_saved: "🎤 Записано ✓ Преподаватель прослушает ответ.",
  quiz_expecting_text:
    "Пожалуйста, введите ответ сообщением или используйте кнопки ниже.",
  quiz_expecting_voice:
    "Пожалуйста, ответьте 🎤 голосовым сообщением (или нажмите «Пропустить»).",
  quiz_skip: "⏭ Пропустить",
  quiz_cancel: "✖️ Выйти",
  quiz_cancelled: "Задание отменено. Прогресс не сохранён.",
  quiz_submitting: "⏳ Проверяю ваши ответы…",

  result_title: "🎉 <b>Задание выполнено!</b>",
  result_score: "📊 Результат: <b>{correct}/{total}</b> ({pct}%)",
  result_rewards: "✨ <b>+{xp} XP</b>   🪙 <b>+{coins}</b>",
  result_levelup: "⬆️ <b>Новый уровень!</b> {emoji} Уровень {level} — {title}",
  result_streak_kept: "🔥 Серия {n} недель(и) — не прерывайте!",
  result_streak_started: "🔥 Серия началась — возвращайтесь на следующей неделе!",
  result_badges: "🏅 Новый значок: {badges}",

  results_title: "📊 <b>Ваши результаты</b>",
  results_none: "Вы ещё не выполнили ни одного задания.",
  results_item: "{topic} · {pct}% · {date}",
  report_header: "📋 <b>{topic}</b>\n📊 Результат: <b>{pct}%</b> ({correct}/{total})",
  report_q_correct: "✅ <b>В{i}.</b> {q}",
  report_q_wrong: "❌ <b>В{i}.</b> {q}",
  report_q_voice: "🎤 <b>В{i}.</b> {q}",
  report_your_answer: "   • Ваш ответ: {a}",
  report_correct_answer: "   • Правильно: <i>{a}</i>",
  report_transcript: "   • 📝 Вы сказали: <i>{t}</i>",
  report_feedback: "   • 🗣 {f}",
  report_no_answer: "— (нет ответа)",
  report_voice_note: "🎤 Голосовой ответ на В{i}:",
  report_questions_changed:
    "⚠️ Вопросы изменились после выполнения — показаны сохранённые ответы.",
  review_end: "— конец обзора —",

  progress_title: "🎮 <b>Ваш прогресс</b>",
  progress_level: "{emoji} <b>Уровень {level}</b> — {title}",
  progress_xp: "✨ {current}/{needed} XP до следующего уровня",
  progress_xp_max: "✨ {xp} XP — максимальный уровень! 🏆",
  progress_coins: "🪙 Монеты: <b>{coins}</b>",
  progress_streak: "🔥 Серия: <b>{streak}</b> нед. (рекорд {best})",
  progress_done: "✅ Выполнено заданий: <b>{n}</b>",
  progress_badges: "🏅 Значков получено: <b>{n}</b>",
  progress_web_hint:
    "💡 Откройте сайт, чтобы тратить монеты, растить дерево и заботиться о питомце.",

  teacher_menu_students: "👩‍🎓 Ученики",
  teacher_menu_logout: "🚪 Выйти",
  teacher_students_title:
    "👩‍🎓 <b>Ученики</b> — нажмите на ученика, чтобы увидеть задания. 🔴 = новые ответы.",
  teacher_student_btn: "{name}",
  teacher_student_btn_unseen: "🔴 {name} ({n})",
  teacher_no_students: "Ученики не найдены.",
  teacher_reports_title: "📋 <b>{name}</b> — выполненные задания:",
  teacher_no_reports: "У этого ученика пока нет выполненных заданий.",
  teacher_report_btn: "{topic} · {pct}% · {date}",
  teacher_notify:
    "📩 <b>{name}</b> выполнил(а) <b>{topic}</b>\n📊 {pct}% ({correct}/{total})",
  teacher_notify_view: "👀 Посмотреть",

  reminder_message:
    "⏰ <b>Напоминание об уроке</b>\n{subject} — начнётся примерно через <b>{minutes}</b> мин (в <b>{time}</b>).",
  reminder_morning: "🌅 <b>Доброе утро!</b> {subject} — сегодня в <b>{time}</b>.",
  reminder_default_subject: "Ваш урок",
  reminders_enabled: "🔔 Напоминания об уроках <b>включены</b>.",
  reminders_disabled: "🔕 Напоминания об уроках <b>выключены</b>. Отправьте /reminders, чтобы включить снова.",
  new_homework: "📚 <b>Новое задание!</b> {topic}\n\nОткройте меню, чтобы выполнить 👇",

  btn_back: "⬅️ Назад",
  btn_menu: "🏠 Меню",
  btn_open: "▶️ Открыть",
  btn_view: "👀 Смотреть",
  error_generic: "⚠️ Что-то пошло не так. Попробуйте ещё раз.",
  loading: "⏳ Загрузка…",
  help:
    "ℹ️ <b>Помощь</b>\n\n/start — вход или открыть бота\n/menu — главное меню\n/language — сменить язык\n/reminders — напоминания об уроках вкл/выкл\n/logout — выйти\n\nВыполняйте домашние задания прямо в чате и смотрите результаты в любой момент.",
};

const dictionaries: Record<Language, Record<TranslationKey, string>> = { en, ru };

export function t(
  lang: Language,
  key: TranslationKey,
  params?: Record<string, string | number>,
): string {
  let str: string = dictionaries[lang][key] ?? en[key];
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      str = str.replaceAll(`{${k}}`, String(v));
    }
  }
  return str;
}

export type { TranslationKey };
