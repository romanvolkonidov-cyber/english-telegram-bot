# English Homework Telegram Bot

A Telegram bot for **RV private English tutoring**. Students log in with the
**same username/password** they use on the website, see **the same homework**,
do it **right inside Telegram**, and review their results any time. Teachers log
in to browse students and review submissions — and get a ping whenever a
student finishes something.

It talks to the **same Firebase project** (`tracking-budget-app`) as the
[`rv2class`](../rv2class) website and the [`rv-website`](../rv-website) admin
panel, so **no data is duplicated and no schema changes are needed**. Homework
you assign on the website shows up in the bot; homework done in the bot shows up
on the website's teacher view (marked `completedVia: "bot"`).

---

## What it does

### For students
- 🔐 **Login** with their existing username/password (same as the website).
- 📚 **My homework** — the list of pending assignments, done question-by-question:
  - multiple choice (tap a button)
  - text answers & fill-in-the-blank (type a message)
  - 🎤 **speaking answers** — send a voice message and get **instant AI feedback
    + a transcript** (Google Gemini), with the recording saved for the teacher.
- 📊 **My results** — every completed homework, with your answers, the correct
  answers, your score, and your saved voice feedback to re-listen to.
- 🎮 **My progress** — XP, level, coins, weekly streak and badges, **kept in
  sync** with the website's gamification (`studentGameProfiles`).
- 🌐 **Language** — each student picks English or Russian (`/language`).
- ⏰ **Lesson reminders** — a DM before each lesson (default 60 and 10 minutes; `/reminders` to toggle).

### For teachers
- 🔐 Log in with the website's admin credentials (`admin` / `2206` by default).
- 👩‍🎓 **Students** — browse all students; ones with new submissions show a 🔴 badge.
- 📋 **Review** any student's completed homework in full, including listening to
  their voice answers and reading the AI feedback.
- 📩 **Live notifications** — get a Telegram message the moment a student
  submits, with their score and a one-tap **Review** button.

---

## How it connects (no backend changes)

Everything is the existing Firestore data model:

| Purpose | Collection | Notes |
|---|---|---|
| Student accounts & logins | `students` | `username`/`password` compared as-is (plaintext, like the site) |
| Homework assignments | `telegramAssignments` | queried by `studentId` |
| Questions | `telegramQuestions` | by `topicId`; types: `multipleChoice`, `textAnswer`, `fillInBlank`, `voiceAnswer` |
| Submissions & grades | `telegramHomeworkReports` | written with `completedVia: "bot"` |
| Topics (sentences) | `telegramTopics` | for fill-in-the-blank context |
| Gamification | `studentGameProfiles` | XP/coins/streak math ported 1:1 from the site |
| Voice recordings | Firebase Storage `voiceAnswers/…` | same path scheme as the website |
| Telegram ↔ student links | `telegramConnections` | bot-owned docs are id-prefixed `etb_…` |
| Lesson schedule (read-only) | `weeklySchedule` | for reminders; `dayIndex` + UTC `time` + `timezone` |

The bot uses the **Firebase client SDK with anonymous auth** — exactly like the
website — which satisfies the shared Firestore/Storage security rules without
needing a service-account key.

---

## Setup

1. **Install** (Node 20+):
   ```bash
   npm install
   ```
2. **Configure** — copy the example env and fill it in:
   ```bash
   cp .env.example .env
   ```
   | Variable | Required | What it is |
   |---|---|---|
   | `BOT_TOKEN` | ✅ | Token from [@BotFather](https://t.me/BotFather) |
   | `GEMINI_API` | optional | Google Gemini key for voice feedback (without it, voice answers are still recorded for the teacher) |
   | `ADMIN_USERNAME` / `ADMIN_PASSWORD` | optional | Teacher login (defaults to `admin` / `2206`) |
   | `DEFAULT_LANGUAGE` | optional | `en` (default) or `ru` for brand-new users |

3. **Sanity check** the connections (no messages are sent):
   ```bash
   npm run smoke
   ```

## Run

```bash
npm start        # production (long polling)
npm run dev      # auto-reload during development
npm run typecheck
```

### Docker
```bash
docker build -t english-bot .
docker run --env-file .env english-bot
```

> The bot uses **long polling**, so it needs no public URL or open ports — it
> runs anywhere (a small VPS, Railway, Render, Fly.io, a Raspberry Pi…). Run
> **only one instance** at a time, otherwise Telegram returns a `409 Conflict`.

---

## Lesson reminders & the DST caveat

The bot DMs students before their lessons — offsets via `REMINDER_OFFSETS`
(default `60,10` minutes). It also sends a **09:00 (student-local) "you have a
lesson today" reminder** when the lesson starts at/after 09:00 (`MORNING_REMINDER`,
on by default). Each student can toggle all reminders with `/reminders`. Reminders
are sent in the student's chosen language, only to students who have logged into
the bot, and read lesson times from the website's `weeklySchedule` — **fully
independent of the legacy Cloud Functions**.

**The old DST bug — now fixed.** Previously the website saved a lesson's time as
a **fixed UTC** string using the DST offset in effect on the save date, so
DST-observing zones (Europe/UK/US) drifted by an hour after each clock change,
while Moscow (no DST) stayed correct.

It now stores the **wall-clock time exactly as entered** (e.g. `"16:00"`) plus
the IANA `timezone`, marked `timeIsLocal: true`, and converts to UTC only when
needed using the **actual lesson date** — so spring/autumn changes are handled
correctly everywhere. The bot understands both formats: `timeIsLocal` rows are
resolved in their timezone (DST-correct, via `src/util/tz.ts`), and legacy
UTC-stored rows keep working unchanged.

**Existing lessons** created before the fix stay in the legacy format until
re-saved. Moscow lessons are unaffected (no DST); just re-open and save any
**non-Moscow** lesson once to convert it to the new, drift-free format.

---

## Security notes

- **Never commit `.env`** — it is git-ignored. The bot token and Gemini key live
  only there.
- The shared system stores student **passwords in plaintext** and the bot matches
  that to stay compatible. Recommended hardening (website + bot together): hash
  passwords (e.g. bcrypt) and tighten the Firestore rules. This bot is structured
  so only `data/students.ts` would change.
- The bot token was shared in a chat during setup; consider **rotating it** via
  BotFather (`/revoke`) and putting the new one in `.env`.

---

## Project structure

```
src/
  config.ts            env + shared Firebase config
  firebase.ts          client SDK init + anonymous auth
  i18n.ts              English/Russian strings
  types.ts             Firestore document shapes
  util/format.ts       HTML escaping, answer normalization, dates
  data/                Firestore access (students, homework, gamification, connections)
  services/            Gemini voice evaluation, Storage upload
  bot/
    context.ts         session + context types
    keyboards.ts       inline keyboards
    ui.ts / report.ts  shared rendering
    handlers/          auth, student, quiz, teacher, language
  index.ts             wiring + long-polling entrypoint
scripts/smoke-test.ts  offline-safe integration check
```

---

## Ideas & roadmap

Good next steps for the tutoring business:

- ✅ **Lesson reminders** — done (see the section above). Fixing the website's
  DST storage is the recommended follow-up so reminder/display times stop drifting.
- 🔔 **Homework nudges**: gently remind students with pending homework after N days.
- 🗓 **Weekly recap** to the teacher (who's behind, who's on a streak).
- 🧾 **Payment/attendance reminders** reusing the website's billing fields.
- 🏆 **Leaderboard** in the bot (the website already computes ratings).
- 📈 Per-student **progress summaries** a parent could receive.

These are intentionally **not** built yet — the foundation (auth, sessions,
shared data access, i18n, teacher notifications) is here to make them quick to add.
