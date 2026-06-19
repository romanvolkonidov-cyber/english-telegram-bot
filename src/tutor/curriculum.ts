/**
 * A1 (beginner) curriculum for the AI tutor.
 *
 * Twelve topics, each broken into twelve short, adaptive micro-lessons. The
 * theme order and the grammar/vocabulary/function progression follow the
 * standard beginner scope-and-sequence taught in class (World English Intro,
 * A1) — i.e. the *competencies* a learner needs, in a sensible order. The
 * wording of every goal and teaching note here is original; the actual lesson
 * text, examples, and quizzes are generated fresh by the tutor at runtime, so
 * no textbook content is reproduced.
 *
 * Each lesson carries just enough structure for the AI to teach it well:
 *  - `canDo`   the student-facing "I can ..." goal (what success looks like)
 *  - `grammar` the grammar target, if any
 *  - `vocab`   a few sample target words to anchor the topic
 *  - `fn`      a communication function to practice
 *  - `note`    a private hint to the AI about how to approach the lesson
 */

export type LessonFocus =
  | "vocabulary"
  | "grammar"
  | "pronunciation"
  | "function"
  | "skill"
  | "review";

export interface MicroLesson {
  /** Stable id like "1.1" ... "12.12". */
  id: string;
  title: string;
  focus: LessonFocus;
  canDo: string;
  grammar?: string;
  vocab?: string[];
  fn?: string;
  note?: string;
}

export interface Topic {
  id: number;
  slug: string;
  title: string;
  summary: string;
  lessons: MicroLesson[];
}

export const CURRICULUM: Topic[] = [
  {
    id: 1,
    slug: "introductions",
    title: "Introductions",
    summary: "Meet people, say who you are, and talk about what you like.",
    lessons: [
      { id: "1.1", title: "Greetings & names", focus: "vocabulary", canDo: "I can greet someone and say my name.", vocab: ["hello", "hi", "goodbye", "name"], note: "Hello/hi/bye, 'My name is...', 'Nice to meet you.'" },
      { id: "1.2", title: "Personal information", focus: "vocabulary", canDo: "I can give my phone number and spell my name and email.", vocab: ["email", "phone number", "spell"], note: "Numbers 0-10, the alphabet for spelling, '@' = at." },
      { id: "1.3", title: "Subject pronouns & be", focus: "grammar", canDo: "I can use I/you/he/she/it/we/they with am/is/are.", grammar: "subject pronouns + be (am/is/are)" },
      { id: "1.4", title: "Possessive adjectives", focus: "grammar", canDo: "I can say my/your/his/her with be.", grammar: "possessive adjectives with be", note: "my name is, his name is, what's your name?" },
      { id: "1.5", title: "Contractions with be", focus: "pronunciation", canDo: "I can say and hear I'm, you're, he's, she's.", grammar: "contractions with be", note: "Drill I am->I'm, etc.; ear-training." },
      { id: "1.6", title: "Introduce yourself", focus: "function", canDo: "I can introduce myself and ask someone to repeat.", fn: "introduce yourself; 'Can you repeat that, please?'" },
      { id: "1.7", title: "Interests & favorites", focus: "vocabulary", canDo: "I can name things I like: music, sports, food.", vocab: ["favorite", "music", "sports"] },
      { id: "1.8", title: "Describing TV shows", focus: "vocabulary", canDo: "I can talk about TV shows I like.", vocab: ["comedy", "drama", "the news", "show"] },
      { id: "1.9", title: "Yes/No questions with be", focus: "grammar", canDo: "I can ask and answer yes/no questions with be.", grammar: "yes/no questions with be + short answers", note: "Are you...? Is she...? Yes, I am. / No, he isn't." },
      { id: "1.10", title: "Asking about favorites", focus: "function", canDo: "I can ask about someone's favorites.", fn: "What's your favorite...?" },
      { id: "1.11", title: "Meet someone new", focus: "skill", canDo: "I can have a short first conversation with a new person.", note: "Combine greeting + name + a favorite question." },
      { id: "1.12", title: "Unit 1 review", focus: "review", canDo: "I can introduce myself and talk about what I like.", note: "Quick mixed check of all Unit 1 goals." },
    ],
  },
  {
    id: 2,
    slug: "countries",
    title: "Countries",
    summary: "Talk about where people are from and describe places.",
    lessons: [
      { id: "2.1", title: "Countries", focus: "vocabulary", canDo: "I can name several countries.", vocab: ["China", "Mexico", "Brazil", "Japan"] },
      { id: "2.2", title: "Nationalities", focus: "vocabulary", canDo: "I can say nationalities.", vocab: ["Chinese", "Mexican", "Brazilian", "Japanese"], note: "Country -> nationality patterns (-ese, -ian, -an)." },
      { id: "2.3", title: "Where questions", focus: "grammar", canDo: "I can ask where someone is from.", grammar: "questions with where", note: "Where are you from? Where is she from?" },
      { id: "2.4", title: "Who questions", focus: "grammar", canDo: "I can ask who someone is.", grammar: "questions with who" },
      { id: "2.5", title: "Word stress", focus: "pronunciation", canDo: "I can stress the right syllable in country words.", note: "JaPANese, CHIna; clap the stressed syllable." },
      { id: "2.6", title: "Where are you from?", focus: "function", canDo: "I can ask and say where I'm from.", fn: "asking where someone is from" },
      { id: "2.7", title: "Describing cities", focus: "vocabulary", canDo: "I can describe a city with adjectives.", vocab: ["beautiful", "interesting", "large", "old", "busy"] },
      { id: "2.8", title: "Adjectives with be", focus: "grammar", canDo: "I can describe a place using be + adjective.", grammar: "adjectives with be", note: "The city is large. It's beautiful." },
      { id: "2.9", title: "Adjective word order", focus: "grammar", canDo: "I can put adjectives before nouns correctly.", grammar: "adjective + noun vs be + adjective", note: "a big city / the city is big." },
      { id: "2.10", title: "Talk about your city", focus: "function", canDo: "I can describe my town or city.", fn: "describing your city" },
      { id: "2.11", title: "A place to visit", focus: "skill", canDo: "I can describe a place to visit and say why.", note: "Short guided description using new adjectives." },
      { id: "2.12", title: "Unit 2 review", focus: "review", canDo: "I can talk about countries, nationalities, and places.", note: "Mixed check of Unit 2 goals." },
    ],
  },
  {
    id: 3,
    slug: "possessions",
    title: "Possessions",
    summary: "Talk about your things, plurals, and pointing things out.",
    lessons: [
      { id: "3.1", title: "Everyday possessions", focus: "vocabulary", canDo: "I can name common personal items.", vocab: ["phone", "laptop", "keys", "wallet", "bag"] },
      { id: "3.2", title: "Gifts & gadgets", focus: "vocabulary", canDo: "I can name more possessions and gifts.", vocab: ["headphones", "watch", "camera", "gift"] },
      { id: "3.3", title: "Plural nouns: -s/-es", focus: "grammar", canDo: "I can make regular plurals.", grammar: "plural nouns (-s, -es)", note: "book->books, box->boxes." },
      { id: "3.4", title: "Plural spelling rules", focus: "grammar", canDo: "I can spell tricky plurals.", grammar: "plural spelling (-ies, -ves, irregular)", note: "baby->babies, knife->knives, child->children." },
      { id: "3.5", title: "Plural endings", focus: "pronunciation", canDo: "I can hear /s/, /z/, /ɪz/ endings.", grammar: "plural endings", note: "cats /s/, dogs /z/, watches /ɪz/." },
      { id: "3.6", title: "Thanks & you're welcome", focus: "function", canDo: "I can give and reply to thanks.", fn: "giving and replying to thanks" },
      { id: "3.7", title: "Describing items", focus: "vocabulary", canDo: "I can describe objects.", vocab: ["clean", "expensive", "important", "cheap", "new"] },
      { id: "3.8", title: "this / that", focus: "grammar", canDo: "I can use this and that for one item.", grammar: "this / that" },
      { id: "3.9", title: "these / those", focus: "grammar", canDo: "I can use these and those for many items.", grammar: "these / those" },
      { id: "3.10", title: "Giving & receiving gifts", focus: "function", canDo: "I can talk about gifts politely.", fn: "talking about gifts" },
      { id: "3.11", title: "Objects in a room", focus: "skill", canDo: "I can describe the objects around me.", note: "Use this/that/these/those + adjectives." },
      { id: "3.12", title: "Unit 3 review", focus: "review", canDo: "I can talk about my things, plurals, and point them out.", note: "Mixed check of Unit 3 goals." },
    ],
  },
  {
    id: 4,
    slug: "activities",
    title: "Activities",
    summary: "Say what people are doing right now.",
    lessons: [
      { id: "4.1", title: "Everyday activities", focus: "vocabulary", canDo: "I can name common activities.", vocab: ["studying", "exercising", "cooking", "reading"] },
      { id: "4.2", title: "More activities", focus: "vocabulary", canDo: "I can name more things people do.", vocab: ["listening to music", "watching TV", "working", "sleeping"] },
      { id: "4.3", title: "Present continuous: +", focus: "grammar", canDo: "I can say what's happening now.", grammar: "present continuous affirmative (be + -ing)" },
      { id: "4.4", title: "Present continuous: −", focus: "grammar", canDo: "I can say what's not happening now.", grammar: "present continuous negative" },
      { id: "4.5", title: "How are you?", focus: "pronunciation", canDo: "I can say 'How are you?' naturally.", note: "Connected speech: 'how-are-you'." },
      { id: "4.6", title: "Greeting & how are you", focus: "function", canDo: "I can greet people and ask how they are.", fn: "greeting people and asking how they are" },
      { id: "4.7", title: "School subjects", focus: "vocabulary", canDo: "I can name school subjects and majors.", vocab: ["business", "history", "science", "math"] },
      { id: "4.8", title: "Present continuous: ?", focus: "grammar", canDo: "I can ask what someone is doing.", grammar: "present continuous questions", note: "What are you doing? Is he studying?" },
      { id: "4.9", title: "These days", focus: "grammar", canDo: "I can use continuous for current periods.", grammar: "present continuous for extended time", note: "I'm studying English this year." },
      { id: "4.10", title: "What are you doing?", focus: "function", canDo: "I can talk about what I'm doing now.", fn: "talking about current activities" },
      { id: "4.11", title: "Describe the action", focus: "skill", canDo: "I can describe what people in a scene are doing.", note: "Charades-style action descriptions." },
      { id: "4.12", title: "Unit 4 review", focus: "review", canDo: "I can describe what's happening now.", note: "Mixed check of Unit 4 goals." },
    ],
  },
  {
    id: 5,
    slug: "food",
    title: "Food",
    summary: "Talk about food, drinks, and what you eat.",
    lessons: [
      { id: "5.1", title: "Foods", focus: "vocabulary", canDo: "I can name common foods.", vocab: ["rice", "bread", "chicken", "eggs", "fruit"] },
      { id: "5.2", title: "Drinks & meals", focus: "vocabulary", canDo: "I can name drinks and meals.", vocab: ["coffee", "water", "breakfast", "lunch", "dinner"] },
      { id: "5.3", title: "Simple present: +", focus: "grammar", canDo: "I can say what I usually eat (I/you/we/they).", grammar: "simple present affirmative" },
      { id: "5.4", title: "He/she/it & negative", focus: "grammar", canDo: "I can use -s and don't/doesn't.", grammar: "simple present he/she/it (-s) and negative", note: "She eats / He doesn't eat." },
      { id: "5.5", title: "Reduced 'and'", focus: "pronunciation", canDo: "I can link words with 'and' naturally.", grammar: "and", note: "rice and beans -> rice 'n' beans." },
      { id: "5.6", title: "Likes & dislikes", focus: "function", canDo: "I can say what I like and don't like.", fn: "talking about likes and dislikes" },
      { id: "5.7", title: "Healthy eating", focus: "vocabulary", canDo: "I can talk about healthy and unhealthy food.", vocab: ["healthy", "energy", "good for you", "sugar"] },
      { id: "5.8", title: "Simple present: yes/no Q", focus: "grammar", canDo: "I can ask do/does questions.", grammar: "simple present yes/no questions", note: "Do you...? Does she...?" },
      { id: "5.9", title: "Short answers", focus: "grammar", canDo: "I can give short answers with do/does.", grammar: "short answers", note: "Yes, I do. / No, he doesn't." },
      { id: "5.10", title: "Ordering & favorites", focus: "function", canDo: "I can order food and talk about a favorite dish.", fn: "ordering food; favorite food" },
      { id: "5.11", title: "Plan a meal", focus: "skill", canDo: "I can plan a simple meal or dinner.", note: "Guided planning using food vocab + simple present." },
      { id: "5.12", title: "Unit 5 review", focus: "review", canDo: "I can talk about food and eating habits.", note: "Mixed check of Unit 5 goals." },
    ],
  },
  {
    id: 6,
    slug: "relationships",
    title: "Relationships",
    summary: "Talk about your family and relationships.",
    lessons: [
      { id: "6.1", title: "Family members", focus: "vocabulary", canDo: "I can name close family members.", vocab: ["father", "mother", "brother", "sister"] },
      { id: "6.2", title: "Extended family", focus: "vocabulary", canDo: "I can name more relatives.", vocab: ["grandparents", "aunt", "uncle", "cousin"] },
      { id: "6.3", title: "Possessive 's", focus: "grammar", canDo: "I can show who owns something with 's.", grammar: "possessive nouns ('s)", note: "my sister's name." },
      { id: "6.4", title: "Plural possessives", focus: "grammar", canDo: "I can use possessives with plural names.", grammar: "possessive with plurals (s')", note: "my parents' house." },
      { id: "6.5", title: "Possessive 's sounds", focus: "pronunciation", canDo: "I can pronounce 's endings.", grammar: "possessive 's", note: "/s/ /z/ /ɪz/." },
      { id: "6.6", title: "Talking about age", focus: "function", canDo: "I can ask and say how old people are.", fn: "talking about age" },
      { id: "6.7", title: "Relationships", focus: "vocabulary", canDo: "I can describe relationships.", vocab: ["married", "single", "husband", "wife"] },
      { id: "6.8", title: "have got: + / −", focus: "grammar", canDo: "I can say what I have with have got.", grammar: "have got affirmative & negative" },
      { id: "6.9", title: "have got: ?", focus: "grammar", canDo: "I can ask questions with have got.", grammar: "have got questions & short answers" },
      { id: "6.10", title: "Describe your family", focus: "function", canDo: "I can describe my family.", fn: "describing your family" },
      { id: "6.11", title: "Family quiz", focus: "skill", canDo: "I can ask and answer questions about families.", note: "Mini interview about family." },
      { id: "6.12", title: "Unit 6 review", focus: "review", canDo: "I can talk about family and relationships.", note: "Mixed check of Unit 6 goals." },
    ],
  },
  {
    id: 7,
    slug: "time",
    title: "Time",
    summary: "Tell the time and talk about routines and weekends.",
    lessons: [
      { id: "7.1", title: "Telling the time", focus: "vocabulary", canDo: "I can tell the time.", vocab: ["o'clock", "half past", "quarter to", "It's one o'clock"] },
      { id: "7.2", title: "Daily routines", focus: "vocabulary", canDo: "I can describe my daily routine.", vocab: ["wake up", "get up", "go to school", "go to bed"] },
      { id: "7.3", title: "Prepositions: at/on/in", focus: "grammar", canDo: "I can use at/on/in with times.", grammar: "prepositions of time", note: "at 7, on Monday, in the morning." },
      { id: "7.4", title: "Time in sentences", focus: "grammar", canDo: "I can put time expressions in sentences.", grammar: "prepositions of time in context" },
      { id: "7.5", title: "13 vs 30", focus: "pronunciation", canDo: "I can hear and say -teen vs -ty.", grammar: "numbers", note: "thirteen vs thirty stress." },
      { id: "7.6", title: "Suggestions", focus: "function", canDo: "I can make and respond to suggestions.", fn: "making and responding to suggestions", note: "Let's... / Why don't we...?" },
      { id: "7.7", title: "Weekend activities", focus: "vocabulary", canDo: "I can talk about weekend activities.", vocab: ["go running", "go for a bike ride", "go to the movies"] },
      { id: "7.8", title: "Wh- questions", focus: "grammar", canDo: "I can ask Wh- questions in the simple present.", grammar: "simple present Wh- questions", note: "What/When/Where do you...?" },
      { id: "7.9", title: "What time / how often", focus: "grammar", canDo: "I can ask 'what time' and 'how often'.", grammar: "what time / how often questions" },
      { id: "7.10", title: "Make plans", focus: "function", canDo: "I can make weekend plans with someone.", fn: "making plans" },
      { id: "7.11", title: "Describe your routine", focus: "skill", canDo: "I can describe my day from morning to night.", note: "Routine narration with times + prepositions." },
      { id: "7.12", title: "Unit 7 review", focus: "review", canDo: "I can talk about time, routines, and weekends.", note: "Mixed check of Unit 7 goals." },
    ],
  },
  {
    id: 8,
    slug: "special-occasions",
    title: "Special Occasions",
    summary: "Talk about months, holidays, festivals, and events.",
    lessons: [
      { id: "8.1", title: "Months & dates", focus: "vocabulary", canDo: "I can say months and dates.", vocab: ["January", "month", "year", "week"] },
      { id: "8.2", title: "Seasons & holidays", focus: "vocabulary", canDo: "I can name seasons and holidays.", vocab: ["winter", "summer", "holiday", "birthday"] },
      { id: "8.3", title: "in/on with dates", focus: "grammar", canDo: "I can use in/on with months and dates.", grammar: "prepositions with months/dates", note: "in January, on May 1st." },
      { id: "8.4", title: "Wh- Q with prepositions", focus: "grammar", canDo: "I can ask questions ending in prepositions.", grammar: "Wh- questions with prepositions", note: "When is it on? What season is it in?" },
      { id: "8.5", title: "Ordinal numbers", focus: "pronunciation", canDo: "I can say first, second, third...", grammar: "ordinal numbers" },
      { id: "8.6", title: "I know / I'm not sure", focus: "function", canDo: "I can say if I know something or not.", fn: "saying you know or don't know something" },
      { id: "8.7", title: "Festivals & events", focus: "vocabulary", canDo: "I can talk about festivals and events.", vocab: ["celebrate", "event", "take place", "parade"] },
      { id: "8.8", title: "Questions with 'when'", focus: "grammar", canDo: "I can ask when something happens.", grammar: "questions with when" },
      { id: "8.9", title: "Questions with 'how long'", focus: "grammar", canDo: "I can ask how long something lasts.", grammar: "questions with how long" },
      { id: "8.10", title: "Talk about a festival", focus: "function", canDo: "I can describe a holiday or festival.", fn: "describing a festival/holiday" },
      { id: "8.11", title: "Plan an event", focus: "skill", canDo: "I can plan a special event or trip.", note: "Plan-a-staycation style task." },
      { id: "8.12", title: "Unit 8 review", focus: "review", canDo: "I can talk about occasions, festivals, and dates.", note: "Mixed check of Unit 8 goals." },
    ],
  },
  {
    id: 9,
    slug: "together",
    title: "Together",
    summary: "Talk about chores, how often you do things, and friendship.",
    lessons: [
      { id: "9.1", title: "Chores & housework", focus: "vocabulary", canDo: "I can name household chores.", vocab: ["do the dishes", "take out the garbage", "clean"] },
      { id: "9.2", title: "More household tasks", focus: "vocabulary", canDo: "I can talk about more chores.", vocab: ["do the laundry", "make the bed", "cook", "vacuum"] },
      { id: "9.3", title: "Frequency adverbs", focus: "grammar", canDo: "I can say how often with always...never.", grammar: "frequency adverbs", note: "always, usually, often, sometimes, never." },
      { id: "9.4", title: "Adverb position", focus: "grammar", canDo: "I can put frequency adverbs in the right place.", grammar: "position of frequency adverbs", note: "before main verb, after be." },
      { id: "9.5", title: "Rhythm & stress", focus: "pronunciation", canDo: "I can say frequency sentences with good rhythm.", grammar: "frequency adverbs", note: "sentence stress." },
      { id: "9.6", title: "Apologizing", focus: "function", canDo: "I can apologize politely.", fn: "apologizing" },
      { id: "9.7", title: "Friendship", focus: "vocabulary", canDo: "I can talk about friends.", vocab: ["get along", "hang out", "good friends", "trust"] },
      { id: "9.8", title: "Review: be vs do", focus: "grammar", canDo: "I can choose be or do in questions.", grammar: "review of question forms", note: "Are you...? vs Do you...?" },
      { id: "9.9", title: "Review: Wh- vs yes/no", focus: "grammar", canDo: "I can form Wh- and yes/no questions correctly.", grammar: "review of question forms" },
      { id: "9.10", title: "How often do you...?", focus: "function", canDo: "I can talk about how often I do things.", fn: "talking about frequency" },
      { id: "9.11", title: "Ideal roommate", focus: "skill", canDo: "I can describe my ideal roommate or friend.", note: "Questionnaire-style task." },
      { id: "9.12", title: "Unit 9 review", focus: "review", canDo: "I can talk about chores, frequency, and friends.", note: "Mixed check of Unit 9 goals." },
    ],
  },
  {
    id: 10,
    slug: "home",
    title: "Home",
    summary: "Describe your home, rooms, and design.",
    lessons: [
      { id: "10.1", title: "Rooms in a house", focus: "vocabulary", canDo: "I can name rooms in a home.", vocab: ["kitchen", "living room", "bathroom", "bedroom"] },
      { id: "10.2", title: "Furniture & items", focus: "vocabulary", canDo: "I can name furniture and items.", vocab: ["bed", "chair", "table", "sofa"] },
      { id: "10.3", title: "there is / there are: +", focus: "grammar", canDo: "I can say what's in a place.", grammar: "there is / there are affirmative" },
      { id: "10.4", title: "there is/are: − / ?", focus: "grammar", canDo: "I can ask and deny what's in a place.", grammar: "there is / there are negative & questions", note: "Is there...? There aren't any..." },
      { id: "10.5", title: "Surprise intonation", focus: "pronunciation", canDo: "I can sound surprised.", note: "Rising intonation: 'Really?!'" },
      { id: "10.6", title: "Showing surprise", focus: "function", canDo: "I can react with surprise.", fn: "showing surprise", note: "Really? Wow! No way!" },
      { id: "10.7", title: "Colors & design", focus: "vocabulary", canDo: "I can describe colors and feelings of a space.", vocab: ["red", "yellow", "happy", "relaxed"] },
      { id: "10.8", title: "very", focus: "grammar", canDo: "I can intensify adjectives with very.", grammar: "very", note: "It's very small." },
      { id: "10.9", title: "too vs very", focus: "grammar", canDo: "I can use 'too' for a problem amount.", grammar: "too vs very", note: "too small = a problem." },
      { id: "10.10", title: "Describe your home", focus: "function", canDo: "I can describe my home.", fn: "describing your home" },
      { id: "10.11", title: "Describe a room", focus: "skill", canDo: "I can describe and compare rooms.", note: "Draw-and-describe style task." },
      { id: "10.12", title: "Unit 10 review", focus: "review", canDo: "I can describe my home and design.", note: "Mixed check of Unit 10 goals." },
    ],
  },
  {
    id: 11,
    slug: "clothing",
    title: "Clothing",
    summary: "Talk about clothes, shopping, prices, and style.",
    lessons: [
      { id: "11.1", title: "Clothing items", focus: "vocabulary", canDo: "I can name clothes.", vocab: ["jacket", "pants", "T-shirt", "shoes"] },
      { id: "11.2", title: "More clothes", focus: "vocabulary", canDo: "I can name more clothes and accessories.", vocab: ["dress", "hat", "scarf", "sweater"] },
      { id: "11.3", title: "want to", focus: "grammar", canDo: "I can say what I want to do.", grammar: "want to + verb" },
      { id: "11.4", title: "have to", focus: "grammar", canDo: "I can say what I have to do.", grammar: "have to + verb" },
      { id: "11.5", title: "wanna & hafta", focus: "pronunciation", canDo: "I can hear relaxed 'want to' and 'have to'.", grammar: "want to / have to", note: "connected speech." },
      { id: "11.6", title: "Asking prices", focus: "function", canDo: "I can ask for and give prices.", fn: "asking for and giving prices", note: "How much is/are...?" },
      { id: "11.7", title: "Describing clothes", focus: "vocabulary", canDo: "I can describe clothing style.", vocab: ["baggy", "casual", "dressy", "stylish"] },
      { id: "11.8", title: "Count nouns", focus: "grammar", canDo: "I can use a/an and plurals for count nouns.", grammar: "count nouns" },
      { id: "11.9", title: "Noncount nouns", focus: "grammar", canDo: "I can use some/much with noncount nouns.", grammar: "noncount nouns" },
      { id: "11.10", title: "What to wear", focus: "function", canDo: "I can say what I want and have to wear.", fn: "talking about what to wear" },
      { id: "11.11", title: "Describe a style", focus: "skill", canDo: "I can describe someone's style.", note: "Describe an outfit/person's style." },
      { id: "11.12", title: "Unit 11 review", focus: "review", canDo: "I can talk about clothes, prices, and style.", note: "Mixed check of Unit 11 goals." },
    ],
  },
  {
    id: 12,
    slug: "jobs",
    title: "Jobs",
    summary: "Talk about jobs, work goals, and what you can do.",
    lessons: [
      { id: "12.1", title: "Jobs", focus: "vocabulary", canDo: "I can name common jobs.", vocab: ["doctor", "teacher", "server", "nurse"] },
      { id: "12.2", title: "More jobs & workplaces", focus: "vocabulary", canDo: "I can name more jobs and where people work.", vocab: ["lawyer", "engineer", "office", "hospital"] },
      { id: "12.3", title: "Questions with 'like'", focus: "grammar", canDo: "I can ask what something or someone is like.", grammar: "questions with like", note: "What do you like? What's it like?" },
      { id: "12.4", title: "What do you do?", focus: "grammar", canDo: "I can ask and answer about jobs.", grammar: "What do you do?", note: "occupation, not current action." },
      { id: "12.5", title: "What do you...?", focus: "pronunciation", canDo: "I can say 'What do you...?' naturally.", note: "connected speech: 'whaddaya'." },
      { id: "12.6", title: "Talk about jobs", focus: "function", canDo: "I can ask and talk about jobs.", fn: "talking about jobs" },
      { id: "12.7", title: "Work goals", focus: "vocabulary", canDo: "I can talk about work goals.", vocab: ["do an internship", "get experience", "make money"] },
      { id: "12.8", title: "can / can't: ability", focus: "grammar", canDo: "I can say what I can and can't do.", grammar: "can / can't affirmative & negative" },
      { id: "12.9", title: "can / can't: ?", focus: "grammar", canDo: "I can ask about ability.", grammar: "can / can't questions & short answers" },
      { id: "12.10", title: "Talk about abilities", focus: "function", canDo: "I can talk about my skills and abilities.", fn: "talking about ability" },
      { id: "12.11", title: "Business introduction", focus: "skill", canDo: "I can introduce myself in a work context.", note: "Short professional self-introduction." },
      { id: "12.12", title: "Course review", focus: "review", canDo: "I can use everything from the A1 course in conversation.", note: "Wrap-up: mix goals from across all units." },
    ],
  },
];

export const TOTAL_LESSONS = CURRICULUM.reduce((n, t) => n + t.lessons.length, 0);

export function getTopic(id: number): Topic | undefined {
  return CURRICULUM.find((t) => t.id === id);
}

export function getLesson(topicId: number, lessonId: string): MicroLesson | undefined {
  return getTopic(topicId)?.lessons.find((l) => l.id === lessonId);
}

/** The lesson that comes after the given one (next in topic, then next topic). */
export function nextLesson(
  topicId: number,
  lessonId: string,
): { topicId: number; lessonId: string } | null {
  const topic = getTopic(topicId);
  if (!topic) return null;
  const idx = topic.lessons.findIndex((l) => l.id === lessonId);
  if (idx === -1) return null;
  if (idx + 1 < topic.lessons.length) {
    return { topicId, lessonId: topic.lessons[idx + 1]!.id };
  }
  const nextTopic = CURRICULUM.find((t) => t.id === topicId + 1);
  return nextTopic ? { topicId: nextTopic.id, lessonId: nextTopic.lessons[0]!.id } : null;
}
