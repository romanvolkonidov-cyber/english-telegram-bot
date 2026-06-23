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

/** CEFR levels the tutor offers. */
export type CEFRLevel = "A1" | "A2" | "B1";

/** The language a course teaches (its TARGET). */
export type TargetLanguage = "English" | "Portuguese";

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
  /** Which CEFR course this topic belongs to. */
  level: CEFRLevel;
  /** The language this course teaches. */
  target: TargetLanguage;
  slug: string;
  title: string;
  summary: string;
  lessons: MicroLesson[];
}

const A1_TOPICS: Omit<Topic, "level" | "target">[] = [
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

/**
 * A2 (elementary) curriculum. Twelve themed units, each with twelve adaptive
 * micro-lessons. The theme order and the grammar/vocabulary/function progression
 * follow a standard A2 elementary scope-and-sequence (the competencies an A2
 * learner needs, in a sensible order) — simple present → present continuous →
 * count/noncount → simple past (be, regular, irregular, questions) → future
 * (be going to / present continuous) → ability → connectors. As with A1, every
 * goal and note here is original and all lesson text is generated at runtime.
 */
const A2_TOPICS: Omit<Topic, "level" | "target">[] = [
  {
    id: 13,
    slug: "people",
    title: "People",
    summary: "Describe people and talk about what they do, using the simple present.",
    lessons: [
      { id: "13.1", title: "Personal information", focus: "vocabulary", canDo: "I can give and ask for personal information.", vocab: ["address", "email address", "phone number", "date of birth"] },
      { id: "13.2", title: "Physical descriptions", focus: "vocabulary", canDo: "I can describe how someone looks.", vocab: ["tall", "thin", "young", "blue eyes", "long hair"] },
      { id: "13.3", title: "Simple present: statements", focus: "grammar", canDo: "I can say what people do, using -s for he/she/it.", grammar: "simple present affirmative — ALL persons (I/you/we/they + base verb; he/she/it + verb-s)", note: "Teach the whole affirmative: I/you/we/they work, BUT he/she/it works. Cover the -s spelling: work→works, study→studies, watch→watches." },
      { id: "13.4", title: "Simple present: negative", focus: "grammar", canDo: "I can say what people don't do.", grammar: "simple present negative (don't / doesn't)", note: "I/you/we/they don't + base; he/she/it doesn't + base (He doesn't work)." },
      { id: "13.5", title: "be vs have to describe", focus: "grammar", canDo: "I can describe people with be and have.", grammar: "be / have for descriptions", note: "He is tall. He has blue eyes." },
      { id: "13.6", title: "Simple present: yes/no Q", focus: "grammar", canDo: "I can ask do/does questions about people.", grammar: "simple present yes/no questions", note: "Do you...? Does she...? + short answers." },
      { id: "13.7", title: "Wh- questions", focus: "grammar", canDo: "I can ask Wh- questions about people.", grammar: "simple present Wh- questions", note: "Where does he live? What do you do?" },
      { id: "13.8", title: "Question intonation", focus: "pronunciation", canDo: "I can use rising/falling intonation in questions.", note: "yes/no rise, Wh- fall." },
      { id: "13.9", title: "Introduce yourself & others", focus: "function", canDo: "I can introduce myself and someone else.", fn: "introducing yourself and others" },
      { id: "13.10", title: "Talk about people you know", focus: "function", canDo: "I can describe people I know.", fn: "describing people you know" },
      { id: "13.11", title: "Describe a person", focus: "skill", canDo: "I can describe a person's looks and routine.", note: "Combine be/have + simple present." },
      { id: "13.12", title: "Unit review", focus: "review", canDo: "I can describe people and their routines.", note: "Mixed check of Unit 1 (A2) goals." },
    ],
  },
  {
    id: 14,
    slug: "behavior",
    title: "Behavior",
    summary: "Talk about what people are doing now and how they feel.",
    lessons: [
      { id: "14.1", title: "Communication verbs", focus: "vocabulary", canDo: "I can talk about ways people communicate.", vocab: ["chat", "talk", "share", "shout", "smile"] },
      { id: "14.2", title: "Feelings", focus: "vocabulary", canDo: "I can name common feelings.", vocab: ["happy", "sad", "angry", "bored", "nervous"] },
      { id: "14.3", title: "Present continuous: +", focus: "grammar", canDo: "I can say what's happening now.", grammar: "present continuous affirmative (be + -ing)" },
      { id: "14.4", title: "Present continuous: −", focus: "grammar", canDo: "I can say what isn't happening now.", grammar: "present continuous negative" },
      { id: "14.5", title: "Present continuous: ?", focus: "grammar", canDo: "I can ask what someone is doing.", grammar: "present continuous questions", note: "What are you doing? Is he smiling?" },
      { id: "14.6", title: "Simple vs continuous", focus: "grammar", canDo: "I can choose simple present or present continuous.", grammar: "simple present vs present continuous", note: "every day vs right now." },
      { id: "14.7", title: "Subject & object pronouns", focus: "grammar", canDo: "I can use me/him/her/us/them.", grammar: "subject and object pronouns", note: "She likes him. They help us." },
      { id: "14.8", title: "Contractions", focus: "pronunciation", canDo: "I can say I'm, you're, he's naturally.", grammar: "contractions with be", note: "ear-training + production." },
      { id: "14.9", title: "How are you?", focus: "function", canDo: "I can greet people and ask how they feel.", fn: "greeting and asking how someone is" },
      { id: "14.10", title: "Talk about feelings", focus: "function", canDo: "I can say how I feel and why.", fn: "talking about feelings" },
      { id: "14.11", title: "Describe the scene", focus: "skill", canDo: "I can describe what people are doing and feeling.", note: "Picture scene: actions + feelings." },
      { id: "14.12", title: "Unit review", focus: "review", canDo: "I can describe actions now and feelings.", note: "Mixed check of Unit 2 (A2) goals." },
    ],
  },
  {
    id: 15,
    slug: "shopping",
    title: "Shopping",
    summary: "Talk about food and shopping with count and noncount nouns.",
    lessons: [
      { id: "15.1", title: "Food in the kitchen", focus: "vocabulary", canDo: "I can name foods at home.", vocab: ["cake", "chicken", "fish", "rice", "vegetables"] },
      { id: "15.2", title: "At the store", focus: "vocabulary", canDo: "I can talk about shopping actions.", vocab: ["buy", "pay", "sell", "try on", "cash"] },
      { id: "15.3", title: "Count vs noncount", focus: "grammar", canDo: "I can tell count and noncount nouns apart.", grammar: "count vs noncount nouns", note: "an apple vs (some) rice." },
      { id: "15.4", title: "a/an, some, any", focus: "grammar", canDo: "I can use a/an, some, and any.", grammar: "a/an, some, any", note: "some in +, any in − / ?" },
      { id: "15.5", title: "much / many / a lot of", focus: "grammar", canDo: "I can use quantifiers for amounts.", grammar: "much / many / a lot of" },
      { id: "15.6", title: "How much / How many", focus: "grammar", canDo: "I can ask about amounts and prices.", grammar: "How much / How many questions" },
      { id: "15.7", title: "Word stress", focus: "pronunciation", canDo: "I can stress the right syllable in food words.", note: "baNAna, VEgetables; clap the stress." },
      { id: "15.8", title: "Say what you need", focus: "function", canDo: "I can say what I need to buy.", fn: "talking about what you need" },
      { id: "15.9", title: "Shopping & prices", focus: "function", canDo: "I can ask prices and buy things.", fn: "shopping and asking prices" },
      { id: "15.10", title: "Returning an item", focus: "function", canDo: "I can return something at a store.", fn: "returning items" },
      { id: "15.11", title: "Plan a shopping trip", focus: "skill", canDo: "I can plan what to buy and describe a favorite store.", note: "Use count/noncount + quantifiers." },
      { id: "15.12", title: "Unit review", focus: "review", canDo: "I can talk about food and shopping.", note: "Mixed check of Unit 3 (A2) goals." },
    ],
  },
  {
    id: 16,
    slug: "vacation",
    title: "Vacation",
    summary: "Talk about weather and travel, and connect your ideas.",
    lessons: [
      { id: "16.1", title: "Weather", focus: "vocabulary", canDo: "I can describe the weather.", vocab: ["sunny", "cloudy", "windy", "rainy", "hot"] },
      { id: "16.2", title: "Travel", focus: "vocabulary", canDo: "I can talk about travel.", vocab: ["sightseeing", "ticket", "suitcase", "trip", "photos"] },
      { id: "16.3", title: "Connectors: and, but", focus: "grammar", canDo: "I can join ideas with and and but.", grammar: "connecting ideas: and, but" },
      { id: "16.4", title: "Connectors: or, so", focus: "grammar", canDo: "I can join ideas with or and so.", grammar: "connecting ideas: or, so" },
      { id: "16.5", title: "Possessive adjectives", focus: "grammar", canDo: "I can use my/your/his/her/our/their.", grammar: "possessive adjectives" },
      { id: "16.6", title: "Possessive pronouns", focus: "grammar", canDo: "I can use mine/yours/his/hers/ours/theirs.", grammar: "possessive pronouns", note: "It's mine. Whose is it?" },
      { id: "16.7", title: "Sentence stress", focus: "pronunciation", canDo: "I can stress the important words.", note: "content words stressed, function words weak." },
      { id: "16.8", title: "Give & take advice", focus: "function", canDo: "I can give and respond to travel advice.", fn: "giving and responding to advice" },
      { id: "16.9", title: "Talk about the weather", focus: "function", canDo: "I can talk about the weather.", fn: "talking about the weather" },
      { id: "16.10", title: "Plan a trip", focus: "function", canDo: "I can plan a trip with someone.", fn: "planning a trip" },
      { id: "16.11", title: "Describe a trip", focus: "skill", canDo: "I can describe a vacation and the weather.", note: "Connect ideas + possessives." },
      { id: "16.12", title: "Unit review", focus: "review", canDo: "I can talk about weather, travel, and belongings.", note: "Mixed check of Unit 4 (A2) goals." },
    ],
  },
  {
    id: 17,
    slug: "heroes",
    title: "Heroes",
    summary: "Talk about the past with be and regular verbs; describe people you admire.",
    lessons: [
      { id: "17.1", title: "People who help", focus: "vocabulary", canDo: "I can talk about people who help others.", vocab: ["hero", "explorer", "volunteer", "leader"] },
      { id: "17.2", title: "Good qualities", focus: "vocabulary", canDo: "I can describe good qualities.", vocab: ["brave", "caring", "generous", "helpful", "admire"] },
      { id: "17.3", title: "Past of be: +", focus: "grammar", canDo: "I can say where people/things were.", grammar: "simple past with be (was/were)" },
      { id: "17.4", title: "Past of be: − / ?", focus: "grammar", canDo: "I can ask and deny with was/were.", grammar: "was/were negative & questions", note: "Was he...? They weren't..." },
      { id: "17.5", title: "Simple past: regular +", focus: "grammar", canDo: "I can talk about finished actions.", grammar: "simple past regular (-ed)", note: "worked, helped, lived." },
      { id: "17.6", title: "Simple past: negative", focus: "grammar", canDo: "I can say what didn't happen.", grammar: "simple past negative (didn't + verb)" },
      { id: "17.7", title: "-ed endings", focus: "pronunciation", canDo: "I can hear /t/, /d/, /ɪd/ in -ed verbs.", grammar: "-ed endings", note: "worked /t/, lived /d/, wanted /ɪd/." },
      { id: "17.8", title: "Agree & disagree", focus: "function", canDo: "I can agree and disagree politely.", fn: "agreeing and disagreeing" },
      { id: "17.9", title: "Talk about the past", focus: "function", canDo: "I can talk about what I did.", fn: "talking about the past" },
      { id: "17.10", title: "Praise a hero", focus: "function", canDo: "I can say why someone is a hero.", fn: "describing why someone is admirable" },
      { id: "17.11", title: "Tell a short story", focus: "skill", canDo: "I can tell a short true story about someone.", note: "Past be + regular verbs in sequence." },
      { id: "17.12", title: "Unit review", focus: "review", canDo: "I can talk about the past and people I admire.", note: "Mixed check of Unit 5 (A2) goals." },
    ],
  },
  {
    id: 18,
    slug: "the-mind",
    title: "The Mind",
    summary: "Talk about memory and sleep using irregular past and past questions.",
    lessons: [
      { id: "18.1", title: "Memory", focus: "vocabulary", canDo: "I can talk about remembering and forgetting.", vocab: ["remember", "forget", "recognize", "memorize"] },
      { id: "18.2", title: "Sleep", focus: "vocabulary", canDo: "I can talk about sleep.", vocab: ["dream", "fall asleep", "wake up", "tired"] },
      { id: "18.3", title: "Irregular past: +", focus: "grammar", canDo: "I can use common irregular past verbs.", grammar: "simple past irregular verbs", note: "go→went, have→had, see→saw." },
      { id: "18.4", title: "More irregular verbs", focus: "grammar", canDo: "I can use more irregular past verbs.", grammar: "simple past irregular verbs (more)", note: "make→made, take→took, get→got." },
      { id: "18.5", title: "Past negative", focus: "grammar", canDo: "I can make negatives with irregular verbs.", grammar: "simple past negative (didn't + base)", note: "didn't go (not didn't went)." },
      { id: "18.6", title: "Past yes/no questions", focus: "grammar", canDo: "I can ask did-questions.", grammar: "simple past yes/no questions", note: "Did you...? Yes, I did." },
      { id: "18.7", title: "Past Wh- questions", focus: "grammar", canDo: "I can ask Wh- questions about the past.", grammar: "simple past Wh- questions", note: "What did you do? Where did she go?" },
      { id: "18.8", title: "Past verb sounds", focus: "pronunciation", canDo: "I can say irregular past verbs clearly.", note: "went, saw, bought; linking with did you." },
      { id: "18.9", title: "Express certainty", focus: "function", canDo: "I can say how sure I am.", fn: "expressing certainty", note: "Maybe / I think / I'm sure." },
      { id: "18.10", title: "Past experiences", focus: "function", canDo: "I can talk about a past experience.", fn: "talking about a past experience" },
      { id: "18.11", title: "Tell about last night", focus: "skill", canDo: "I can tell a story about a memory or last night.", note: "Irregular past + past questions." },
      { id: "18.12", title: "Unit review", focus: "review", canDo: "I can talk about memory, sleep, and the past.", note: "Mixed check of Unit 6 (A2) goals." },
    ],
  },
  {
    id: 19,
    slug: "city-life",
    title: "City Life",
    summary: "Describe your neighborhood and give directions around a city.",
    lessons: [
      { id: "19.1", title: "Places in town", focus: "vocabulary", canDo: "I can name places in a neighborhood.", vocab: ["bus station", "department store", "gas station", "bank", "park"] },
      { id: "19.2", title: "In the city", focus: "vocabulary", canDo: "I can describe city life.", vocab: ["traffic", "journey", "crowded", "delay", "downtown"] },
      { id: "19.3", title: "at / on / in (place)", focus: "grammar", canDo: "I can say where places are.", grammar: "prepositions of place: at, on, in", note: "at the corner, on Main St, in the city." },
      { id: "19.4", title: "Prepositions of movement", focus: "grammar", canDo: "I can describe movement around town.", grammar: "prepositions of movement", note: "go to, come from, across, along, past." },
      { id: "19.5", title: "there is / there are", focus: "grammar", canDo: "I can say what's in my area.", grammar: "there is / there are (+ amounts)", note: "There's a bank. There are two parks." },
      { id: "19.6", title: "How much / How many", focus: "grammar", canDo: "I can ask about places and amounts in a city.", grammar: "How much / How many" },
      { id: "19.7", title: "Compound noun stress", focus: "pronunciation", canDo: "I can stress compound nouns correctly.", note: "BUS station, GAS station." },
      { id: "19.8", title: "Ask & give directions", focus: "function", canDo: "I can ask for and give directions.", fn: "asking for and giving directions" },
      { id: "19.9", title: "Describe your area", focus: "function", canDo: "I can describe my neighborhood.", fn: "describing your neighborhood" },
      { id: "19.10", title: "Things to do in a city", focus: "function", canDo: "I can suggest things to do in a city.", fn: "suggesting things to do" },
      { id: "19.11", title: "Make a city guide", focus: "skill", canDo: "I can give a short guide to my city.", note: "Places + there is/are + directions." },
      { id: "19.12", title: "Unit review", focus: "review", canDo: "I can describe a city and give directions.", note: "Mixed check of Unit 7 (A2) goals." },
    ],
  },
  {
    id: 20,
    slug: "all-about-you",
    title: "All About You",
    summary: "Talk about free-time activities, interests, and personality.",
    lessons: [
      { id: "20.1", title: "Sports & activities", focus: "vocabulary", canDo: "I can name free-time activities.", vocab: ["surfing", "swimming", "tennis", "cycling", "hiking"] },
      { id: "20.2", title: "Personality traits", focus: "vocabulary", canDo: "I can describe personality.", vocab: ["ambitious", "careful", "shy", "friendly", "confident"] },
      { id: "20.3", title: "Verb + infinitive", focus: "grammar", canDo: "I can use want/need/decide + to.", grammar: "verb + infinitive", note: "I want to play. She needs to go." },
      { id: "20.4", title: "Verb + -ing", focus: "grammar", canDo: "I can use enjoy/finish + -ing.", grammar: "verb + -ing", note: "I enjoy swimming." },
      { id: "20.5", title: "like/love/hate + -ing", focus: "grammar", canDo: "I can say what I like and dislike doing.", grammar: "like/love/hate + -ing" },
      { id: "20.6", title: "How often", focus: "grammar", canDo: "I can ask and say how often.", grammar: "how often + frequency expressions", note: "once a week, twice a month." },
      { id: "20.7", title: "Reduced 'to'", focus: "pronunciation", canDo: "I can say 'want to' as 'wanna' naturally.", grammar: "want to / going to", note: "connected speech." },
      { id: "20.8", title: "Invite someone", focus: "function", canDo: "I can invite someone to do something.", fn: "inviting others", note: "Do you want to...? Let's..." },
      { id: "20.9", title: "Talk about hobbies", focus: "function", canDo: "I can talk about my hobbies.", fn: "talking about hobbies and interests" },
      { id: "20.10", title: "Describe your personality", focus: "function", canDo: "I can describe my personality.", fn: "describing personality" },
      { id: "20.11", title: "Interview a partner", focus: "skill", canDo: "I can interview someone about their interests.", note: "Verb patterns + how often." },
      { id: "20.12", title: "Unit review", focus: "review", canDo: "I can talk about interests and personality.", note: "Mixed check of Unit 8 (A2) goals." },
    ],
  },
  {
    id: 21,
    slug: "change",
    title: "Change",
    summary: "Talk about habits and future plans with be going to.",
    lessons: [
      { id: "21.1", title: "Habits", focus: "vocabulary", canDo: "I can talk about good and bad habits.", vocab: ["exercise", "recycle", "waste", "save", "quit"] },
      { id: "21.2", title: "Issues & environment", focus: "vocabulary", canDo: "I can talk about everyday social/eco issues.", vocab: ["plastic", "pollution", "goal", "support", "reuse"] },
      { id: "21.3", title: "like to / would like to", focus: "grammar", canDo: "I can say what I like and would like to do.", grammar: "like to / would like to", note: "general vs a specific wish." },
      { id: "21.4", title: "would like (offers)", focus: "grammar", canDo: "I can make polite offers and requests.", grammar: "would like for offers/requests", note: "Would you like...? I'd like..." },
      { id: "21.5", title: "be going to: + / −", focus: "grammar", canDo: "I can talk about plans and intentions.", grammar: "be going to affirmative & negative" },
      { id: "21.6", title: "be going to: ?", focus: "grammar", canDo: "I can ask about plans.", grammar: "be going to questions", note: "What are you going to do?" },
      { id: "21.7", title: "Contracted 'would'", focus: "pronunciation", canDo: "I can say I'd, you'd, he'd naturally.", grammar: "contracted would ('d)" },
      { id: "21.8", title: "Make & answer requests", focus: "function", canDo: "I can make and respond to requests.", fn: "making and responding to requests" },
      { id: "21.9", title: "Talk about plans", focus: "function", canDo: "I can talk about my future plans.", fn: "talking about plans" },
      { id: "21.10", title: "A habit to change", focus: "function", canDo: "I can talk about a habit I want to change.", fn: "talking about changing a habit" },
      { id: "21.11", title: "Set a goal", focus: "skill", canDo: "I can plan a change and set a goal.", note: "be going to + would like to." },
      { id: "21.12", title: "Unit review", focus: "review", canDo: "I can talk about habits and future plans.", note: "Mixed check of Unit 9 (A2) goals." },
    ],
  },
  {
    id: 22,
    slug: "health",
    title: "Health",
    summary: "Talk about the body and health, and give advice.",
    lessons: [
      { id: "22.1", title: "The body", focus: "vocabulary", canDo: "I can name parts of the body.", vocab: ["arm", "back", "head", "shoulder", "stomach"] },
      { id: "22.2", title: "Health & stress", focus: "vocabulary", canDo: "I can talk about health and stress.", vocab: ["anxiety", "focus", "energy", "relax", "rest"] },
      { id: "22.3", title: "Imperatives", focus: "grammar", canDo: "I can give instructions and warnings.", grammar: "imperatives (affirmative & negative)", note: "Drink water. Don't skip meals." },
      { id: "22.4", title: "should / shouldn't", focus: "grammar", canDo: "I can give advice with should.", grammar: "should / shouldn't" },
      { id: "22.5", title: "have to / don't have to", focus: "grammar", canDo: "I can talk about what's necessary.", grammar: "have to / don't have to" },
      { id: "22.6", title: "When clauses", focus: "grammar", canDo: "I can use 'when' to link situations.", grammar: "when clauses", note: "When I'm tired, I rest." },
      { id: "22.7", title: "Vowel length", focus: "pronunciation", canDo: "I can hear short vs long vowels.", note: "ship/sheep; final /t/ vs /d/." },
      { id: "22.8", title: "Health problems", focus: "function", canDo: "I can talk about a health problem.", fn: "talking about health problems", note: "I have a headache. My back hurts." },
      { id: "22.9", title: "Give health advice", focus: "function", canDo: "I can give simple health advice.", fn: "giving advice" },
      { id: "22.10", title: "At the doctor", focus: "function", canDo: "I can describe symptoms to a doctor.", fn: "describing symptoms" },
      { id: "22.11", title: "Make a health plan", focus: "skill", canDo: "I can make a simple wellbeing plan.", note: "Imperatives + should + when clauses." },
      { id: "22.12", title: "Unit review", focus: "review", canDo: "I can talk about health and give advice.", note: "Mixed check of Unit 10 (A2) goals." },
    ],
  },
  {
    id: 23,
    slug: "achievement",
    title: "Achievement",
    summary: "Talk about abilities, past ability, and reasons with because/so.",
    lessons: [
      { id: "23.1", title: "Abilities & talents", focus: "vocabulary", canDo: "I can talk about skills and talents.", vocab: ["good at", "practice", "talented", "skill", "improve"] },
      { id: "23.2", title: "Risk-takers", focus: "vocabulary", canDo: "I can describe bold people and actions.", vocab: ["brave", "curious", "dangerous", "challenge", "risk"] },
      { id: "23.3", title: "can / can't", focus: "grammar", canDo: "I can say what I can and can't do.", grammar: "can / can't for ability" },
      { id: "23.4", title: "could / couldn't", focus: "grammar", canDo: "I can talk about past ability.", grammar: "could / couldn't (past ability)" },
      { id: "23.5", title: "good at + -ing", focus: "grammar", canDo: "I can say what I'm good at.", grammar: "be good at + -ing" },
      { id: "23.6", title: "because & so", focus: "grammar", canDo: "I can give reasons and results.", grammar: "connecting ideas: because, so", note: "reason vs result." },
      { id: "23.7", title: "can/can't, could/couldn't", focus: "pronunciation", canDo: "I can hear can vs can't, could vs couldn't.", note: "weak 'can' /kən/ vs strong 'can't'." },
      { id: "23.8", title: "Compliment someone", focus: "function", canDo: "I can compliment someone's ability.", fn: "complimenting someone" },
      { id: "23.9", title: "Talk about abilities", focus: "function", canDo: "I can talk about what I can do.", fn: "talking about ability" },
      { id: "23.10", title: "Hopes for the future", focus: "function", canDo: "I can talk about hopes and dreams.", fn: "talking about hopes for the future" },
      { id: "23.11", title: "Your talents", focus: "skill", canDo: "I can talk about my talents and a bucket list.", note: "can/could + because/so." },
      { id: "23.12", title: "Unit review", focus: "review", canDo: "I can talk about ability and give reasons.", note: "Mixed check of Unit 11 (A2) goals." },
    ],
  },
  {
    id: 24,
    slug: "at-the-movies",
    title: "At the Movies",
    summary: "Talk about movies and the future, and wrap up the A2 course.",
    lessons: [
      { id: "24.1", title: "Types of movies", focus: "vocabulary", canDo: "I can name kinds of movies.", vocab: ["action", "drama", "horror", "comedy", "documentary"] },
      { id: "24.2", title: "Describing movies", focus: "vocabulary", canDo: "I can describe a movie.", vocab: ["boring", "entertaining", "funny", "original", "scary"] },
      { id: "24.3", title: "Present continuous as future", focus: "grammar", canDo: "I can talk about fixed future plans.", grammar: "present continuous as future", note: "I'm meeting them at 7 tonight." },
      { id: "24.4", title: "going to vs continuous", focus: "grammar", canDo: "I can choose 'be going to' or present continuous.", grammar: "be going to vs present continuous (future)" },
      { id: "24.5", title: "-ed / -ing adjectives", focus: "grammar", canDo: "I can use bored vs boring correctly.", grammar: "-ed / -ing adjectives", note: "I'm bored. The movie is boring." },
      { id: "24.6", title: "Past / present / future", focus: "grammar", canDo: "I can choose the right tense to talk about time.", grammar: "review: past, present, future" },
      { id: "24.7", title: "Sentence stress", focus: "pronunciation", canDo: "I can stress key words in a sentence.", note: "highlight the important word." },
      { id: "24.8", title: "On the phone", focus: "function", canDo: "I can have a short phone conversation.", fn: "talking on the phone" },
      { id: "24.9", title: "Make plans to go out", focus: "function", canDo: "I can make plans to go out.", fn: "making plans" },
      { id: "24.10", title: "Review a movie", focus: "function", canDo: "I can give my opinion about a movie.", fn: "giving an opinion / reviewing" },
      { id: "24.11", title: "Recommend a movie", focus: "skill", canDo: "I can describe and recommend a movie.", note: "-ed/-ing adjectives + opinions." },
      { id: "24.12", title: "Course review", focus: "review", canDo: "I can use everything from the A2 course in conversation.", note: "Wrap-up: mix goals from across all A2 units." },
    ],
  },
];

/**
 * Portuguese (Brazilian) A1 curriculum — a REAL Portuguese scope & sequence, not
 * the English course relabeled. It follows how Portuguese is actually taught to
 * beginners: noun gender and articles come early; the two "to be" verbs (ser vs
 * estar) and ter (have) are central; regular verbs are grouped by -ar/-er/-ir;
 * and Portuguese-specific points appear in order — estar com for states, gostar
 * de, de/em/a contractions (do, na, ao), ter for age, ir + infinitive for the
 * near future, the gerund (estar + -ando/-endo/-indo), adjective/possessive
 * agreement, and the sounds that trip learners up (nasal ã/ão/õe, lh/nh, the two
 * r's, ç, x). Vocabulary anchors are Portuguese words; grammar targets name the
 * Portuguese forms. As elsewhere, the can-do goals are written for the learner
 * and all lesson text/examples are generated fresh at runtime.
 *
 * Standardized on Brazilian Portuguese (você as default "you"; tem for "there
 * is/are"; estar + gerúndio for the continuous), with European variants flagged
 * in notes where useful.
 */
const PT_A1_TOPICS: Omit<Topic, "level" | "target">[] = [
  {
    id: 1,
    slug: "encontros",
    title: "Meeting People",
    summary: "Meet people, introduce yourself, and say who you are — in Portuguese.",
    lessons: [
      { id: "1.1", title: "Greetings", focus: "vocabulary", canDo: "I can greet people at different times of day.", vocab: ["olá", "oi", "bom dia", "boa tarde", "boa noite", "tchau"], note: "oi/olá (informal), bom dia/boa tarde/boa noite by time of day; tchau, até logo. Informal vs formal." },
      { id: "1.2", title: "Names", focus: "function", canDo: "I can say my name and ask someone's name.", fn: "Como você se chama? / Qual é o seu nome? — Meu nome é… / Eu me chamo… / Muito prazer." },
      { id: "1.3", title: "You, he, she: the pronouns", focus: "grammar", canDo: "I can use the Portuguese subject pronouns.", grammar: "subject pronouns: eu, você, ele, ela, nós, vocês, eles, elas", note: "Brazilian default: você for 'you' (takes 3rd-person verb forms). Mention tu/vós only as a side note." },
      { id: "1.4", title: "Say who you are with ser", focus: "grammar", canDo: "I can say who I am and where I'm from with ser.", grammar: "verb ser (to be), present: eu sou, você/ele/ela é, nós somos, vocês/eles/elas são", note: "ser for identity, origin, profession: Eu sou Ana. Eu sou do Brasil. Teach ALL persons." },
      { id: "1.5", title: "Portuguese sounds", focus: "pronunciation", canDo: "I can recognize the key Portuguese sounds.", note: "Awareness of nasal vowels ã/ão, the digraphs lh/nh, and ç: não, mãe, filho, senhor, coração." },
      { id: "1.6", title: "Introduce yourself", focus: "function", canDo: "I can introduce myself and ask where someone is from.", fn: "introducing yourself; De onde você é? — Eu sou de…" },
      { id: "1.7", title: "Numbers 0–10", focus: "vocabulary", canDo: "I can count from 0 to 10.", vocab: ["zero", "um", "dois", "três", "quatro", "cinco", "seis", "sete", "oito", "nove", "dez"], note: "Note gender: um/uma, dois/duas." },
      { id: "1.8", title: "Countries & nationalities", focus: "vocabulary", canDo: "I can say nationalities with the right gender.", vocab: ["Brasil", "Portugal", "brasileiro", "brasileira", "português", "portuguesa"], grammar: "nationality adjectives agree in gender: brasileiro/brasileira", note: "Country vs nationality; gender agreement." },
      { id: "1.9", title: "Ask and answer about identity", focus: "grammar", canDo: "I can ask and answer questions with ser.", grammar: "questions with ser: Você é…? Quem é…?", note: "Você é estudante? Sim, sou. / Quem é ele? Intonation marks the question." },
      { id: "1.10", title: "Personal information", focus: "function", canDo: "I can give my phone number and email.", fn: "exchanging phone/email; números + arroba (@)", note: "telefone, e-mail, arroba." },
      { id: "1.11", title: "A first conversation", focus: "skill", canDo: "I can have a short first conversation.", note: "Combine greeting + name + origin with ser." },
      { id: "1.12", title: "Unit 1 review", focus: "review", canDo: "I can introduce myself and say who I am.", note: "Mixed check of Unit 1 goals." },
    ],
  },
  {
    id: 2,
    slug: "objetos",
    title: "Things Around You",
    summary: "Name the objects around you, point them out, and describe them — picking up articles and gender naturally as you go.",
    lessons: [
      { id: "2.1", title: "Every word is o or a — learn both from day one", focus: "grammar", canDo: "I can tell if a noun is masculine or feminine.", grammar: "grammatical gender of nouns (masculine / feminine)", note: "Usually -o = masc, -a = fem, but flag common exceptions: o problema, o dia, a mão. Gender drives everything else." },
      { id: "2.2", title: "The book, the house: using the article", focus: "grammar", canDo: "I can use o, a, os, as.", grammar: "definite articles: o, a, os, as", note: "o livro, a casa, os livros, as casas — the article agrees with the noun." },
      { id: "2.3", title: "A bag, an apartment: indefinite articles", focus: "grammar", canDo: "I can use um, uma, uns, umas.", grammar: "indefinite articles: um, uma, uns, umas", note: "um carro, uma casa, uns carros, umas casas." },
      { id: "2.4", title: "One book, two books: making plurals", focus: "grammar", canDo: "I can make Portuguese plurals.", grammar: "plural of nouns: -s, -es (after consonant), -m → -ns", note: "livro→livros, flor→flores, homem→homens. (Leave -ão and -l plurals for later — just mention them.)" },
      { id: "2.5", title: "Open & closed vowels", focus: "pronunciation", canDo: "I can hear open vs closed vowels.", note: "avó (open ó) vs avô (closed ô); é vs ê. These change meaning." },
      { id: "2.6", title: "This, that, that over there", focus: "grammar", canDo: "I can point things out by distance.", grammar: "demonstratives: este/esta, esse/essa, aquele/aquela (gender + distance)", note: "este = near me, esse = near you, aquele = far from both; agree in gender/number." },
      { id: "2.7", title: "Everyday objects", focus: "vocabulary", canDo: "I can name everyday objects with their article.", vocab: ["telefone", "chave", "bolsa", "mochila", "caneta", "livro"], note: "Always learn the noun WITH its article (o/a)." },
      { id: "2.8", title: "A big red bag: making descriptions agree", focus: "grammar", canDo: "I can make article, noun and adjective agree.", grammar: "agreement: article + noun + adjective", note: "o carro vermelho, a casa branca, as casas brancas." },
      { id: "2.9", title: "Colors", focus: "vocabulary", canDo: "I can name colors with agreement.", vocab: ["vermelho", "azul", "verde", "amarelo", "branco", "preto"], grammar: "color adjectives agree: vermelho/vermelha; azul/verde invariable in gender", note: "Adjectives in -o change for gender; those in -e/-l usually don't." },
      { id: "2.10", title: "What is this?", focus: "function", canDo: "I can ask what something is and point it out.", fn: "O que é isto/isso/aquilo? — É um/uma…" },
      { id: "2.11", title: "Describe objects around you", focus: "skill", canDo: "I can describe objects around me.", note: "demonstratives + article + noun + adjective agreement." },
      { id: "2.12", title: "Unit 2 review", focus: "review", canDo: "I can name, point out and describe things around me.", note: "Mixed check of Unit 2 goals." },
    ],
  },
  {
    id: 3,
    slug: "pessoas",
    title: "People & Feelings",
    summary: "Describe how people look and feel — and learn the crucial difference between ser and estar.",
    lessons: [
      { id: "3.1", title: "Say how you feel and where things are", focus: "grammar", canDo: "I can say how I am and where things are with estar.", grammar: "verb estar (to be), present: estou, está, estamos, estão", note: "estar for states & location: Eu estou bem. O livro está na mesa. Teach all persons." },
      { id: "3.2", title: "Two ways to say 'to be': the key to Portuguese", focus: "grammar", canDo: "I can choose ser or estar.", grammar: "ser (permanent: identity/origin/traits) vs estar (temporary: state/location/mood)", note: "Ele é alto (permanent) vs Ele está cansado (temporary). The key A1 contrast — practice a lot." },
      { id: "3.3", title: "Feelings & states", focus: "vocabulary", canDo: "I can say how I feel.", vocab: ["feliz", "triste", "cansado", "doente", "animado", "preocupado"], note: "Used mostly with estar: estou feliz, está triste (agreement: cansado/cansada)." },
      { id: "3.4", title: "Hungry, tired, cold: estar com", focus: "grammar", canDo: "I can say I'm hungry, thirsty, sleepy, etc.", grammar: "estar com + noun for states: estar com fome / sede / sono / medo / pressa / frio / calor", note: "Portuguese does NOT use 'to be + adjective' here — it uses estar com + noun: Estou com fome = I'm hungry." },
      { id: "3.5", title: "Nasal vowels", focus: "pronunciation", canDo: "I can produce the nasal vowels.", note: "ã, ão, õe: mãe, não, pão, põe, irmã, coração." },
      { id: "3.6", title: "How are you?", focus: "function", canDo: "I can greet someone and ask how they are.", fn: "Tudo bem? / Como vai? / Como você está? — Tudo bem, e você?" },
      { id: "3.7", title: "Describing people", focus: "vocabulary", canDo: "I can say what people are like.", vocab: ["alto", "baixo", "magro", "jovem", "simpático", "bonito"], note: "Traits use ser (Ela é simpática); agreement applies." },
      { id: "3.8", title: "She's tall, they're kind: adjective agreement", focus: "grammar", canDo: "I can make adjectives agree in gender and number.", grammar: "adjective agreement (gender + number)", note: "simpático/simpática/simpáticos/simpáticas; adjectives in -e are invariable for gender (inteligente)." },
      { id: "3.9", title: "Very tired, lots of friends: using muito", focus: "grammar", canDo: "I can use muito correctly.", grammar: "muito as adverb (invariable: very) vs muito/muita/muitos/muitas (quantity)", note: "muito alto (very — no change) vs muita gente / muitos livros (quantity — agrees)." },
      { id: "3.10", title: "Describe how someone is", focus: "function", canDo: "I can describe how someone is and looks.", fn: "describing people with ser + estar" },
      { id: "3.11", title: "Describe a person", focus: "skill", canDo: "I can describe a person fully.", note: "ser for traits + estar for mood + agreement." },
      { id: "3.12", title: "Unit 3 review", focus: "review", canDo: "I can describe people and talk about feelings.", note: "Mixed check of Unit 3 goals." },
    ],
  },
  {
    id: 4,
    slug: "familia",
    title: "Family & What You Have",
    summary: "Talk about your family, your age, and your belongings.",
    lessons: [
      { id: "4.1", title: "Family members", focus: "vocabulary", canDo: "I can name close family members.", vocab: ["pai", "mãe", "irmão", "irmã", "filho", "filha"] },
      { id: "4.2", title: "Extended family", focus: "vocabulary", canDo: "I can name more relatives.", vocab: ["avô", "avó", "tio", "tia", "primo", "prima"], note: "avô (grandfather, closed ô) vs avó (grandmother, open ó)." },
      { id: "4.3", title: "I have a brother: the verb ter", focus: "grammar", canDo: "I can say what I have with ter.", grammar: "verb ter (to have), present: tenho, tem, temos, têm", note: "Eu tenho dois irmãos. Teach all persons; têm (they) takes a circumflex." },
      { id: "4.4", title: "My house, her car: possessives", focus: "grammar", canDo: "I can say my/your with agreement.", grammar: "possessives meu/minha, seu/sua, dele/dela (agree with the thing owned)", note: "meu carro, minha casa; seu/sua = your (você). Use dele/dela to avoid ambiguity (a casa dele)." },
      { id: "4.5", title: "Our family, their home: more possessives", focus: "grammar", canDo: "I can use plural possessives.", grammar: "possessives plural: meus/minhas, seus/suas, nossos/nossas", note: "meus livros, minhas chaves, nossa família, nossos amigos." },
      { id: "4.6", title: "Diphthongs", focus: "pronunciation", canDo: "I can say Portuguese diphthongs.", note: "pai, mãe, céu, pão, dois, muito." },
      { id: "4.7", title: "How old are you?", focus: "grammar", canDo: "I can ask and say how old someone is.", grammar: "ter for age: Quantos anos você tem? — Tenho 20 anos.", note: "Portuguese uses TER for age, never ser: Eu tenho 20 anos (NOT 'sou 20')." },
      { id: "4.8", title: "The café in Rio: de + article (do, da)", focus: "grammar", canDo: "I can show possession and origin with de.", grammar: "contraction de + article: do, da, dos, das", note: "o carro do João, a casa da Maria, sou do Brasil, a capa dos livros." },
      { id: "4.9", title: "Talk about your family", focus: "function", canDo: "I can talk about my family.", fn: "describing your family (ter + possessives)" },
      { id: "4.10", title: "Relationship status", focus: "vocabulary", canDo: "I can talk about relationship status.", vocab: ["casado", "solteiro", "namorado", "namorada", "esposa", "marido"] },
      { id: "4.11", title: "Describe your family", focus: "skill", canDo: "I can describe my family.", note: "ter + possessives + de-contractions." },
      { id: "4.12", title: "Unit 4 review", focus: "review", canDo: "I can talk about family, age and belongings.", note: "Mixed check of Unit 4 goals." },
    ],
  },
  {
    id: 5,
    slug: "rotina",
    title: "My Daily Life",
    summary: "Describe what you do every day — learning verbs through the activities of real life.",
    lessons: [
      { id: "5.1", title: "Talk, work, study: -ar verbs", focus: "grammar", canDo: "I can conjugate regular -ar verbs.", grammar: "regular -ar verbs, present (falar): falo, fala, falamos, falam", note: "falar, morar, trabalhar, estudar, gostar. Eu falo, você fala, nós falamos, eles falam." },
      { id: "5.2", title: "Eat, drink, live: -er verbs", focus: "grammar", canDo: "I can conjugate regular -er verbs.", grammar: "regular -er verbs, present (comer): como, come, comemos, comem", note: "comer, beber, viver, aprender, escrever." },
      { id: "5.3", title: "Leave, open, decide: -ir verbs", focus: "grammar", canDo: "I can conjugate regular -ir verbs.", grammar: "regular -ir verbs, present (abrir): abro, abre, abrimos, abrem", note: "abrir, partir, assistir, decidir." },
      { id: "5.4", title: "Daily routine", focus: "vocabulary", canDo: "I can describe my daily routine.", vocab: ["acordar", "tomar café", "trabalhar", "almoçar", "voltar", "dormir"] },
      { id: "5.5", title: "The R sounds", focus: "pronunciation", canDo: "I can tell the two R sounds apart.", note: "soft tap in caro vs strong R in carro; word-initial r- is strong (rato, rua)." },
      { id: "5.6", title: "Where are you going? Ir", focus: "grammar", canDo: "I can say where I go.", grammar: "irregular verb ir (to go), present: vou, vai, vamos, vão", note: "ir + a (+ contraction): vou ao trabalho, vou à escola." },
      { id: "5.7", title: "Do, want, can: must-know verbs", focus: "grammar", canDo: "I can use a few high-frequency irregular verbs.", grammar: "irregular fazer, querer, poder (present, main forms): faço/faz, quero/quer, posso/pode", note: "Introduce the most useful forms; full poder/saber come in Unit 12." },
      { id: "5.8", title: "Say what you don't do", focus: "grammar", canDo: "I can make negative sentences.", grammar: "negation: não before the verb; double negative (não … nada/ninguém/nunca)", note: "Eu não falo francês. Não tenho carro. Double negatives are normal and correct: Não vejo ninguém." },
      { id: "5.9", title: "Talk about your routine", focus: "function", canDo: "I can talk about my routine.", fn: "talking about your daily routine" },
      { id: "5.10", title: "How often? Always, sometimes, never", focus: "grammar", canDo: "I can say how often I do things.", grammar: "frequency: sempre, geralmente, às vezes, raramente, nunca", note: "Usually before the main verb or at the start of the sentence." },
      { id: "5.11", title: "Describe your day", focus: "skill", canDo: "I can describe my whole day.", note: "regular verbs + ir + frequency adverbs." },
      { id: "5.12", title: "Unit 5 review", focus: "review", canDo: "I can describe my daily life and routine.", note: "Mixed check of Unit 5 goals." },
    ],
  },
  {
    id: 6,
    slug: "horarios",
    title: "Time, Schedules & Plans",
    summary: "Tell the time, talk about your week, and make plans with someone.",
    lessons: [
      { id: "6.1", title: "Telling the time", focus: "function", canDo: "I can tell the time.", grammar: "telling time: É uma hora; São duas horas; meio-dia / meia-noite; e / para minutes", note: "É (singular: uma, meio-dia, meia-noite) vs São (plural: duas+). São três e quinze. São dez para as oito." },
      { id: "6.2", title: "Days of the week", focus: "vocabulary", canDo: "I can name the days of the week.", vocab: ["segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado", "domingo"], note: "Weekdays are 'feira' days; often shortened (segunda)." },
      { id: "6.3", title: "Months & dates", focus: "vocabulary", canDo: "I can say months and dates.", vocab: ["janeiro", "fevereiro", "março", "abril", "maio", "mês"], note: "Dates: (dia) + de + month: 5 de maio. Months are lowercase." },
      { id: "6.4", title: "At, in, on: talking about time", focus: "grammar", canDo: "I can use prepositions of time.", grammar: "prepositions of time: às (hours), de (manhã/tarde/noite), em (months)", note: "às 8 horas, de manhã, à noite, em janeiro." },
      { id: "6.5", title: "Nasal numbers", focus: "pronunciation", canDo: "I can pronounce the nasal numbers.", note: "cinco, cinquenta, cem, cento, vinte — watch the nasal endings." },
      { id: "6.6", title: "Numbers 11–100", focus: "vocabulary", canDo: "I can count to 100.", vocab: ["onze", "doze", "vinte", "trinta", "cinquenta", "cem"], note: "vinte e um, trinta e dois … ; 100 = cem (cento e um for 101)." },
      { id: "6.7", title: "In the park, on Monday: using no and na", focus: "grammar", canDo: "I can use no/na for places and days.", grammar: "contraction em + article: no, na, nos, nas", note: "no sábado, na segunda, no Brasil, na escola." },
      { id: "6.8", title: "Making plans", focus: "function", canDo: "I can make a plan with someone.", fn: "making plans; Vamos…? Que tal…? A que horas?" },
      { id: "6.9", title: "When? Asking about times", focus: "grammar", canDo: "I can ask when something happens.", grammar: "questions with quando, que horas, que dia", note: "Quando é? Que horas são? Que dia é hoje?" },
      { id: "6.10", title: "Talk about schedules", focus: "function", canDo: "I can talk about times and schedules.", fn: "talking about schedules" },
      { id: "6.11", title: "Describe your week", focus: "skill", canDo: "I can describe my week.", note: "days + times + em/de contractions." },
      { id: "6.12", title: "Unit 6 review", focus: "review", canDo: "I can tell the time, talk about my week and make plans.", note: "Mixed check of Unit 6 goals." },
    ],
  },
  {
    id: 7,
    slug: "comida",
    title: "Food & Eating Out",
    summary: "Talk about food, say what you like, and order at a restaurant.",
    lessons: [
      { id: "7.1", title: "Foods", focus: "vocabulary", canDo: "I can name common foods.", vocab: ["arroz", "feijão", "pão", "carne", "peixe", "fruta"] },
      { id: "7.2", title: "Drinks & meals", focus: "vocabulary", canDo: "I can name drinks and meals.", vocab: ["água", "café", "suco", "café da manhã", "almoço", "jantar"], note: "café da manhã (BR) = breakfast (PT: pequeno-almoço)." },
      { id: "7.3", title: "I love coffee, I hate fish: gostar de", focus: "grammar", canDo: "I can say what I like.", grammar: "gostar DE + noun/infinitive (with de-contractions): gosto de café, gosto do bolo, gosto de cozinhar", note: "gostar is ALWAYS followed by de. de+o=do (gosto do peixe). gostar de + infinitive for activities." },
      { id: "7.4", title: "I want, you want: ordering and asking", focus: "grammar", canDo: "I can say what I want.", grammar: "querer (to want), present: quero, quer, queremos, querem", note: "Eu quero um café, por favor. Used to order and request." },
      { id: "7.5", title: "C, Ç and S", focus: "pronunciation", canDo: "I can pronounce c, ç and s.", note: "ça/ço/çu = /s/ (almoço, açúcar); ce/ci = /s/; ca/co/cu = /k/ (casa)." },
      { id: "7.6", title: "At the restaurant", focus: "function", canDo: "I can order food at a restaurant.", fn: "ordering food; Eu queria… / Para mim… / Por favor" },
      { id: "7.7", title: "Quantities", focus: "grammar", canDo: "I can talk about amounts of food.", grammar: "quantities: muito/pouco, um pouco de, bastante", note: "muita comida, um pouco de arroz." },
      { id: "7.8", title: "Preferences", focus: "grammar", canDo: "I can say what I prefer.", grammar: "preferir: prefiro … a …; gostar mais de", note: "Prefiro chá a café. Gosto mais de suco." },
      { id: "7.9", title: "Likes & dislikes", focus: "function", canDo: "I can talk about likes and dislikes.", fn: "talking about likes/dislikes; Não gosto de…" },
      { id: "7.10", title: "The bill", focus: "function", canDo: "I can ask for and pay the bill.", fn: "A conta, por favor; Quanto é? Aceita cartão?" },
      { id: "7.11", title: "Plan a meal", focus: "skill", canDo: "I can plan a simple meal.", note: "food vocab + gostar de + quantities." },
      { id: "7.12", title: "Unit 7 review", focus: "review", canDo: "I can talk about food, likes and ordering.", note: "Mixed check of Unit 7 goals." },
    ],
  },
  {
    id: 8,
    slug: "cidade",
    title: "The City & Getting Around",
    summary: "Describe your city, find out what there is, and get where you need to go.",
    lessons: [
      { id: "8.1", title: "Places in town", focus: "vocabulary", canDo: "I can name places in town.", vocab: ["banco", "mercado", "farmácia", "praça", "escola", "hospital"] },
      { id: "8.2", title: "Is there a bank nearby? Tem / há", focus: "grammar", canDo: "I can say what there is in a place.", grammar: "there is/are: tem (BR, common) / há (more formal) — both invariable", note: "Tem um banco aqui? = Há um banco aqui? Same for singular and plural: Tem dois parques." },
      { id: "8.3", title: "Prepositions of place", focus: "grammar", canDo: "I can say where places are.", grammar: "prepositions of place: em, ao lado de, perto de, longe de, entre, atrás de, na frente de", note: "perto de takes de-contractions: perto do mercado, ao lado da praça." },
      { id: "8.4", title: "Going to the bank, to the square: ao, à", focus: "grammar", canDo: "I can use ao/à and review contractions.", grammar: "contraction a + article: ao, à, aos, às (movement/direction)", note: "vou ao banco, vou à praça. Quick review of do/da and no/na too." },
      { id: "8.5", title: "LH and NH", focus: "pronunciation", canDo: "I can pronounce lh and nh.", note: "filho, mulher, trabalho (lh); banho, dinheiro, senhora (nh)." },
      { id: "8.6", title: "Where is…?", focus: "function", canDo: "I can ask where something is.", fn: "Onde fica…? / Onde é…?" },
      { id: "8.7", title: "Directions", focus: "function", canDo: "I can give simple directions.", grammar: "directions: vire à direita/esquerda, siga em frente, vá até", note: "Imperative-style direction phrases; keep them set/fixed at A1." },
      { id: "8.8", title: "Transport", focus: "vocabulary", canDo: "I can say how I get around.", vocab: ["ônibus", "carro", "metrô", "bicicleta", "a pé"], note: "de ônibus / de carro / de metrô, BUT a pé (on foot)." },
      { id: "8.9", title: "Ask & give directions", focus: "function", canDo: "I can ask for and give directions.", fn: "asking for and giving directions" },
      { id: "8.10", title: "Describe your area", focus: "function", canDo: "I can describe my neighborhood.", fn: "describing your neighborhood" },
      { id: "8.11", title: "A city guide", focus: "skill", canDo: "I can give a short guide to my city.", note: "places + tem/há + prepositions + directions." },
      { id: "8.12", title: "Unit 8 review", focus: "review", canDo: "I can describe a city and give directions.", note: "Mixed check of Unit 8 goals." },
    ],
  },
  {
    id: 9,
    slug: "presente-continuo",
    title: "At Home & Right Now",
    summary: "Describe your home and say what's happening right now.",
    lessons: [
      { id: "9.1", title: "Activities", focus: "vocabulary", canDo: "I can name everyday activities.", vocab: ["estudar", "cozinhar", "ler", "escrever", "ouvir música"] },
      { id: "9.2", title: "What are you doing right now?", focus: "grammar", canDo: "I can say what's happening now.", grammar: "present continuous: estar + gerúndio (estou falando, está comendo)", note: "BR uses estar + gerúndio. Flag the European form (estar a + infinitivo: estou a falar) as a note." },
      { id: "9.3", title: "Working, eating, leaving: the gerund", focus: "grammar", canDo: "I can form the gerund of all three groups.", grammar: "gerund: -ar→-ando, -er→-endo, -ir→-indo", note: "falando, comendo, partindo." },
      { id: "9.4", title: "Not right now! Questions about what's happening", focus: "grammar", canDo: "I can ask and deny what's happening now.", grammar: "present continuous negative & questions", note: "Você está estudando? Não estou trabalhando agora." },
      { id: "9.5", title: "Every day vs right now: choosing the tense", focus: "grammar", canDo: "I can choose simple present or present continuous.", grammar: "simple present (habits) vs present continuous (right now)", note: "Eu como às 12h (habit) vs Estou comendo agora (now)." },
      { id: "9.6", title: "Rhythm & stress", focus: "pronunciation", canDo: "I can use natural rhythm and stress.", note: "Stressed syllables and written accents (á, ê, ó) guide the stress." },
      { id: "9.7", title: "Rooms at home", focus: "vocabulary", canDo: "I can name rooms in a home.", vocab: ["cozinha", "sala", "quarto", "banheiro", "varanda"], note: "banheiro (BR) = bathroom (PT: casa de banho)." },
      { id: "9.8", title: "Furniture", focus: "vocabulary", canDo: "I can name furniture.", vocab: ["cama", "mesa", "cadeira", "sofá", "armário"] },
      { id: "9.9", title: "What are you doing?", focus: "function", canDo: "I can say what I'm doing now.", fn: "talking about current actions; O que você está fazendo?" },
      { id: "9.10", title: "Describe a scene", focus: "function", canDo: "I can describe what people are doing.", fn: "describing a scene" },
      { id: "9.11", title: "Describe the picture", focus: "skill", canDo: "I can describe what everyone in a picture is doing.", note: "present continuous + rooms/furniture vocabulary." },
      { id: "9.12", title: "Unit 9 review", focus: "review", canDo: "I can describe what's happening now and my home.", note: "Mixed check of Unit 9 goals." },
    ],
  },
  {
    id: 10,
    slug: "roupas-compras",
    title: "Clothes, Shopping & Prices",
    summary: "Talk about clothes, go shopping, and ask prices.",
    lessons: [
      { id: "10.1", title: "Clothes", focus: "vocabulary", canDo: "I can name clothes.", vocab: ["camisa", "calça", "vestido", "sapatos", "blusa"] },
      { id: "10.2", title: "More clothes", focus: "vocabulary", canDo: "I can name more clothes and accessories.", vocab: ["casaco", "chapéu", "óculos", "meias", "cinto"] },
      { id: "10.3", title: "Colors with clothes", focus: "grammar", canDo: "I can describe clothes with colors.", grammar: "adjective/color agreement with clothes", note: "uma camisa azul, sapatos pretos, uma blusa branca — agreement." },
      { id: "10.4", title: "Demonstratives shopping", focus: "grammar", canDo: "I can point out items while shopping.", grammar: "demonstratives in context: este/esse/aquele + agreement", note: "Quero esta camisa, não aquela. Quanto custa esse casaco?" },
      { id: "10.5", title: "How much is it?", focus: "function", canDo: "I can ask prices.", grammar: "prices: Quanto custa? / Quanto custam? / Quanto é?", note: "custa (singular) vs custam (plural)." },
      { id: "10.6", title: "Money & big numbers", focus: "vocabulary", canDo: "I can talk about money and bigger numbers.", vocab: ["real", "reais", "centavos", "cem", "mil"], note: "Prices in reais; números maiores (duzentos, mil)." },
      { id: "10.7", title: "The letter X", focus: "pronunciation", canDo: "I can handle the letter x.", note: "x has several sounds: peixe (sh), táxi (ks), exame (z), próximo (s)." },
      { id: "10.8", title: "Going shopping", focus: "function", canDo: "I can go shopping and ask for help.", fn: "shopping; Posso ajudar? Estou só olhando; Posso experimentar?" },
      { id: "10.9", title: "I want it, I need it: querer and precisar de", focus: "grammar", canDo: "I can say what I want and need.", grammar: "querer + noun/infinitive; precisar DE + noun", note: "Preciso de uma blusa. Quero experimentar este vestido. (precisar takes de)." },
      { id: "10.10", title: "What to wear", focus: "function", canDo: "I can talk about what to wear.", fn: "talking about what to wear" },
      { id: "10.11", title: "Describe a style", focus: "skill", canDo: "I can describe someone's outfit and style.", note: "clothes + colors + agreement + demonstratives." },
      { id: "10.12", title: "Unit 10 review", focus: "review", canDo: "I can talk about clothes, shopping and prices.", note: "Mixed check of Unit 10 goals." },
    ],
  },
  {
    id: 11,
    slug: "futuro-ir",
    title: "Plans, Invitations & Travel",
    summary: "Make plans, invite people out, and talk about upcoming trips.",
    lessons: [
      { id: "11.1", title: "I'm going to travel tomorrow: ir + infinitive", focus: "grammar", canDo: "I can talk about future plans.", grammar: "near future: ir (present) + infinitive (vou viajar, vamos comer)", note: "Eu vou estudar amanhã. vou/vai/vamos/vão + infinitive — the everyday way to talk about the future." },
      { id: "11.2", title: "Future expressions", focus: "vocabulary", canDo: "I can use future time expressions.", vocab: ["amanhã", "depois", "mais tarde", "na próxima semana", "no próximo mês"] },
      { id: "11.3", title: "Talk about plans", focus: "function", canDo: "I can talk about my plans.", fn: "talking about plans (vou + infinitive)" },
      { id: "11.4", title: "I'd love a table for two: polite requests", focus: "grammar", canDo: "I can make polite requests and wishes.", grammar: "polite wishes: gostaria de / queria + noun/infinitive", note: "Eu gostaria de um café. Queria reservar uma mesa. Softer/more polite than quero." },
      { id: "11.5", title: "Invitations", focus: "function", canDo: "I can invite someone to do something.", fn: "inviting; Você quer…? Vamos…? Que tal…?" },
      { id: "11.6", title: "Spoken contractions", focus: "pronunciation", canDo: "I can understand fast, casual speech.", note: "Informal speech: para → pra, você → cê, está → tá. Understand them; you don't have to use them." },
      { id: "11.7", title: "The weather", focus: "vocabulary", canDo: "I can describe the weather.", vocab: ["sol", "chuva", "frio", "calor", "vento", "nublado"], note: "Está fazendo sol/calor; Está chovendo; Está frio." },
      { id: "11.8", title: "Travel", focus: "vocabulary", canDo: "I can talk about travel.", vocab: ["viagem", "mala", "passagem", "hotel", "praia"] },
      { id: "11.9", title: "Plan a trip", focus: "function", canDo: "I can plan a trip with someone.", fn: "planning a trip (vou/vamos + infinitive)" },
      { id: "11.10", title: "Accept & refuse", focus: "function", canDo: "I can accept and politely refuse.", fn: "accepting and refusing invitations; Aceito! / Desculpe, não posso." },
      { id: "11.11", title: "Plan your weekend", focus: "skill", canDo: "I can plan my weekend.", note: "ir + infinitive + invitations + weather." },
      { id: "11.12", title: "Unit 11 review", focus: "review", canDo: "I can talk about plans, invitations and travel.", note: "Mixed check of Unit 11 goals." },
    ],
  },
  {
    id: 12,
    slug: "poder-saber-trabalho",
    title: "Jobs & What You Can Do",
    summary: "Talk about work and say what you can and know how to do — plus a full course wrap-up.",
    lessons: [
      { id: "12.1", title: "Jobs", focus: "vocabulary", canDo: "I can name common jobs with the right gender.", vocab: ["médico", "médica", "professor", "professora", "engenheiro", "vendedor"], note: "Gender pairs: professor/professora, vendedor/vendedora." },
      { id: "12.2", title: "Workplaces", focus: "vocabulary", canDo: "I can say where people work.", vocab: ["escritório", "hospital", "loja", "escola", "fábrica"] },
      { id: "12.3", title: "Can I come in? Can you help me?: poder", focus: "grammar", canDo: "I can say what I can or may do.", grammar: "poder (can: possibility/permission), present: posso, pode, podemos, podem", note: "Posso entrar? Você pode me ajudar? Não posso ir hoje." },
      { id: "12.4", title: "I know how to swim vs I'm allowed to swim: saber vs poder", focus: "grammar", canDo: "I can tell saber from poder.", grammar: "saber (know how to) vs poder (be able/allowed to)", note: "Eu sei nadar (have the skill) vs Eu posso nadar hoje (possibility/permission). English 'can' covers both." },
      { id: "12.5", title: "I know how to cook, drive, speak: using saber", focus: "grammar", canDo: "I can say what I know how to do.", grammar: "saber + infinitive for skills: sei falar inglês", note: "saber present: sei, sabe, sabemos, sabem. Eu sei cozinhar / dirigir." },
      { id: "12.6", title: "Sounds review", focus: "pronunciation", canDo: "I can pronounce the tricky sounds together.", note: "Mixed drill: nasals (ã/ão/õe), lh/nh, the two r's, ç, x." },
      { id: "12.7", title: "Talk about abilities", focus: "function", canDo: "I can talk about my abilities.", fn: "talking about abilities (saber / poder)" },
      { id: "12.8", title: "What do you do?", focus: "function", canDo: "I can say what I do for work.", grammar: "talking about your job: O que você faz? — Eu sou… / Eu trabalho como…", note: "After ser, a profession usually drops the article: Ele é médico. Sou professora." },
      { id: "12.9", title: "Talk about your work", focus: "function", canDo: "I can talk about my work.", fn: "talking about your work" },
      { id: "12.10", title: "Professional intro", focus: "function", canDo: "I can introduce myself professionally.", fn: "a short professional self-introduction" },
      { id: "12.11", title: "Introduce yourself at work", focus: "skill", canDo: "I can introduce myself in a work setting.", note: "jobs + saber/poder + ser." },
      { id: "12.12", title: "Course review", focus: "review", canDo: "I can use everything from the Portuguese A1 course in conversation.", note: "Wrap-up: mix goals from across all A1 (Portuguese) units." },
    ],
  },
];

/**
 * B1 (intermediate) English curriculum. Twelve themed units following the
 * World Link 2 (4th ed.) scope — My Life, Let's Eat!, Mysteries, Trends, My
 * Neighborhood, Goals, Celebrations, Once Upon a Time, Work, Stay in Touch,
 * Technology, Travel — set to a standard B1 grammar progression: the present
 * perfect, future forms, modals of possibility/obligation, relative clauses,
 * gerund vs infinitive, past narrative (used to / past continuous), the passive,
 * reported speech and the first conditional. Topics 37–48.
 */
const B1_TOPICS: Omit<Topic, "level" | "target">[] = [
  {
    id: 37,
    slug: "my-life",
    title: "My Life",
    summary: "Talk about people you know and your routines vs. what's happening now.",
    lessons: [
      { id: "37.1", title: "People in my life", focus: "vocabulary", canDo: "I can describe my relationships.", vocab: ["classmate", "coworker", "neighbor", "relative", "close friend"] },
      { id: "37.2", title: "Personality adjectives", focus: "vocabulary", canDo: "I can describe what people are like.", vocab: ["outgoing", "generous", "reliable", "ambitious", "easygoing"] },
      { id: "37.3", title: "Present simple vs continuous", focus: "grammar", canDo: "I can contrast routines with actions happening now.", grammar: "present simple vs present continuous", note: "Habits/facts (every day) vs now/temporary (right now, these days)." },
      { id: "37.4", title: "Stative verbs", focus: "grammar", canDo: "I can use verbs that aren't usually continuous.", grammar: "stative verbs (know, like, want, believe, belong)", note: "I know him (NOT I'm knowing). Contrast with action verbs." },
      { id: "37.5", title: "Review: simple past", focus: "grammar", canDo: "I can tell what happened, with regular and irregular verbs.", grammar: "simple past (regular + common irregular)", note: "Affirmative, negative (didn't), questions (did). Recycle key irregulars." },
      { id: "37.6", title: "Adverbs of frequency", focus: "grammar", canDo: "I can say how often I do things precisely.", grammar: "frequency adverbs & expressions", note: "usually/hardly ever/once a week; word order with be vs other verbs." },
      { id: "37.7", title: "-ed / -ing endings", focus: "pronunciation", canDo: "I can pronounce past -ed and -ing naturally.", note: "/t/ /d/ /ɪd/ for -ed; clear -ing without a hard g." },
      { id: "37.8", title: "Describe someone you know", focus: "function", canDo: "I can describe a person and our relationship.", fn: "describing people and relationships" },
      { id: "37.9", title: "Small talk about routines", focus: "function", canDo: "I can make small talk about daily life.", fn: "small talk about routines and current activities" },
      { id: "37.10", title: "Talk about your week", focus: "skill", canDo: "I can compare my usual week with this week.", note: "Mix present simple + continuous + past in one short talk." },
      { id: "37.11", title: "Listening: an interview", focus: "skill", canDo: "I can follow someone describing their life.", note: "Gist + detail; catch tense contrasts." },
      { id: "37.12", title: "Unit review", focus: "review", canDo: "I can talk about people, routines, and the recent past.", note: "Mixed check of Unit 1 (B1) goals." },
    ],
  },
  {
    id: 38,
    slug: "lets-eat",
    title: "Let's Eat!",
    summary: "Describe food and meals, and compare them with comparatives and superlatives.",
    lessons: [
      { id: "38.1", title: "Describing food", focus: "vocabulary", canDo: "I can describe taste and texture.", vocab: ["spicy", "salty", "fresh", "crispy", "rich"] },
      { id: "38.2", title: "Cooking & dishes", focus: "vocabulary", canDo: "I can talk about dishes and cooking.", vocab: ["grilled", "fried", "baked", "boiled", "raw"] },
      { id: "38.3", title: "Count & noncount nouns", focus: "grammar", canDo: "I can tell countable from uncountable food.", grammar: "count vs noncount nouns", note: "an apple / some rice; a/an only with count nouns." },
      { id: "38.4", title: "Quantifiers", focus: "grammar", canDo: "I can say how much/many with food.", grammar: "some, any, much, many, a lot of, a little, a few", note: "much/little + noncount; many/few + count; a lot of + both." },
      { id: "38.5", title: "too much / not enough", focus: "grammar", canDo: "I can say there's too much or not enough.", grammar: "too much / too many / (not) enough", note: "too much salt, too many people, not enough time." },
      { id: "38.6", title: "Comparatives", focus: "grammar", canDo: "I can compare two foods.", grammar: "comparative adjectives (-er / more)", note: "spicier than, more delicious than; as … as." },
      { id: "38.7", title: "Superlatives", focus: "grammar", canDo: "I can say which is the best/worst.", grammar: "superlative adjectives (-est / most)", note: "the spiciest, the most popular; the best/worst." },
      { id: "38.8", title: "Word stress in food words", focus: "pronunciation", canDo: "I can stress longer food words correctly.", note: "deLIcious, vegeTARian, inGREdients." },
      { id: "38.9", title: "Ordering at a restaurant", focus: "function", canDo: "I can order a meal and ask about dishes.", fn: "ordering food and asking about dishes" },
      { id: "38.10", title: "Make & respond to offers", focus: "function", canDo: "I can offer food and accept/decline politely.", fn: "offering food; accepting and declining" },
      { id: "38.11", title: "Recommend a dish", focus: "skill", canDo: "I can recommend and compare dishes.", note: "Use comparatives/superlatives to recommend." },
      { id: "38.12", title: "Unit review", focus: "review", canDo: "I can describe and compare food and meals.", note: "Mixed check of Unit 2 (B1) goals." },
    ],
  },
  {
    id: 39,
    slug: "mysteries",
    title: "Mysteries",
    summary: "Speculate about puzzling situations and talk about life experiences.",
    lessons: [
      { id: "39.1", title: "Mystery vocabulary", focus: "vocabulary", canDo: "I can talk about strange events and clues.", vocab: ["clue", "evidence", "suspect", "solve", "disappear"] },
      { id: "39.2", title: "Adjectives of certainty", focus: "vocabulary", canDo: "I can say how sure I am.", vocab: ["certain", "likely", "possible", "unlikely", "impossible"] },
      { id: "39.3", title: "Modals of possibility", focus: "grammar", canDo: "I can guess using might, could, may.", grammar: "modals of present possibility (might / may / could)", note: "It might be true. They could be lost. Less than certain." },
      { id: "39.4", title: "must / can't for deduction", focus: "grammar", canDo: "I can make confident deductions.", grammar: "must / can't for logical deduction", note: "He must be tired. That can't be right. (near-certainty)." },
      { id: "39.5", title: "Present perfect: experience", focus: "grammar", canDo: "I can talk about life experiences.", grammar: "present perfect for experience (ever / never)", note: "Have you ever…? I've never seen… Unspecified past time." },
      { id: "39.6", title: "Present perfect vs simple past", focus: "grammar", canDo: "I can choose perfect or past correctly.", grammar: "present perfect vs simple past", note: "I've been there (experience) vs I went last year (finished time)." },
      { id: "39.7", title: "Contractions: 've / 's", focus: "pronunciation", canDo: "I can say I've, he's, they've naturally.", note: "Weak forms of have/has in connected speech." },
      { id: "39.8", title: "Speculate about a picture", focus: "function", canDo: "I can speculate about what's happening.", fn: "speculating with modals about a scene" },
      { id: "39.9", title: "Ask about experiences", focus: "function", canDo: "I can ask and answer about experiences.", fn: "asking about life experiences" },
      { id: "39.10", title: "Solve a mystery", focus: "skill", canDo: "I can reason aloud to explain a mystery.", note: "Chain modals of deduction to a conclusion." },
      { id: "39.11", title: "Listening: an unsolved case", focus: "skill", canDo: "I can follow a story and weigh possibilities.", note: "Catch certainty language and evidence." },
      { id: "39.12", title: "Unit review", focus: "review", canDo: "I can speculate and talk about experiences.", note: "Mixed check of Unit 3 (B1) goals." },
    ],
  },
  {
    id: 40,
    slug: "trends",
    title: "Trends",
    summary: "Talk about trends and make predictions about the future.",
    lessons: [
      { id: "40.1", title: "Trends & change", focus: "vocabulary", canDo: "I can describe how things are changing.", vocab: ["increase", "decrease", "popular", "fashion", "trend"] },
      { id: "40.2", title: "Technology & society", focus: "vocabulary", canDo: "I can talk about modern habits.", vocab: ["online", "device", "social media", "screen time", "go viral"] },
      { id: "40.3", title: "be going to", focus: "grammar", canDo: "I can talk about plans and evidence-based predictions.", grammar: "be going to (plans / predictions from evidence)", note: "Look at those clouds — it's going to rain." },
      { id: "40.4", title: "will for predictions", focus: "grammar", canDo: "I can predict the future with will.", grammar: "will / won't for predictions and beliefs", note: "I think it'll change. People won't use cash." },
      { id: "40.5", title: "will vs be going to", focus: "grammar", canDo: "I can choose will or going to.", grammar: "will vs be going to", note: "Decision now (I'll help) vs prior plan/evidence (going to)." },
      { id: "40.6", title: "Future time clauses", focus: "grammar", canDo: "I can link future ideas with when/if.", grammar: "present simple after when/if for the future", note: "When it gets cheaper, I'll buy one. (NOT will get)." },
      { id: "40.7", title: "Contraction 'll & weak 'to'", focus: "pronunciation", canDo: "I can say I'll, it'll, gonna naturally.", note: "'ll reductions; gonna in casual speech." },
      { id: "40.8", title: "Make predictions", focus: "function", canDo: "I can predict and give reasons.", fn: "making predictions and giving reasons" },
      { id: "40.9", title: "Agree & disagree", focus: "function", canDo: "I can agree or disagree about a trend.", fn: "agreeing and disagreeing politely" },
      { id: "40.10", title: "Talk about a trend", focus: "skill", canDo: "I can describe a trend and predict its future.", note: "Combine change verbs + future forms." },
      { id: "40.11", title: "Listening: future of food", focus: "skill", canDo: "I can follow predictions and opinions.", note: "Distinguish facts, plans, and guesses." },
      { id: "40.12", title: "Unit review", focus: "review", canDo: "I can discuss trends and predict the future.", note: "Mixed check of Unit 4 (B1) goals." },
    ],
  },
  {
    id: 41,
    slug: "my-neighborhood",
    title: "My Neighborhood",
    summary: "Describe places around you using relative clauses and quantity.",
    lessons: [
      { id: "41.1", title: "Places in town", focus: "vocabulary", canDo: "I can name places and facilities.", vocab: ["pharmacy", "bakery", "library", "crosswalk", "parking lot"] },
      { id: "41.2", title: "Describing a neighborhood", focus: "vocabulary", canDo: "I can describe what an area is like.", vocab: ["crowded", "quiet", "convenient", "lively", "safe"] },
      { id: "41.3", title: "Relative clauses: who/that", focus: "grammar", canDo: "I can describe people and things with who/that.", grammar: "subject relative clauses (who, that)", note: "a person who…, a place that… — defining clauses." },
      { id: "41.4", title: "Relative clauses: which/where", focus: "grammar", canDo: "I can add where/which to describe places.", grammar: "relative clauses with which, where", note: "the café where we met; a shop which sells…" },
      { id: "41.5", title: "There is / there are + quantity", focus: "grammar", canDo: "I can say what's in an area and how much.", grammar: "there is/are + quantifiers", note: "There are a few cafés; there isn't much traffic." },
      { id: "41.6", title: "Prepositions of place", focus: "grammar", canDo: "I can say exactly where things are.", grammar: "prepositions/phrases of place", note: "across from, next to, on the corner of, between." },
      { id: "41.7", title: "Sentence stress & rhythm", focus: "pronunciation", canDo: "I can stress content words in long sentences.", note: "Keep relative clauses fluent, not choppy." },
      { id: "41.8", title: "Ask for & give directions", focus: "function", canDo: "I can ask for and give directions.", fn: "asking for and giving directions" },
      { id: "41.9", title: "Describe where you live", focus: "function", canDo: "I can describe my neighborhood.", fn: "describing your area" },
      { id: "41.10", title: "Recommend a place", focus: "skill", canDo: "I can recommend a place using relative clauses.", note: "It's a place that… / where you can…" },
      { id: "41.11", title: "Listening: city vs town", focus: "skill", canDo: "I can compare two places I hear about.", note: "Catch descriptions and quantity." },
      { id: "41.12", title: "Unit review", focus: "review", canDo: "I can describe places with relative clauses.", note: "Mixed check of Unit 5 (B1) goals." },
    ],
  },
  {
    id: 42,
    slug: "goals",
    title: "Goals",
    summary: "Talk about plans, ambitions, and what you want and hope to do.",
    lessons: [
      { id: "42.1", title: "Goals & ambitions", focus: "vocabulary", canDo: "I can talk about goals.", vocab: ["achieve", "aim", "dream", "improve", "succeed"] },
      { id: "42.2", title: "Life & career steps", focus: "vocabulary", canDo: "I can describe plans and milestones.", vocab: ["save money", "get a degree", "start a business", "get fit", "learn a skill"] },
      { id: "42.3", title: "Future plans review", focus: "grammar", canDo: "I can talk about plans with going to / present continuous.", grammar: "be going to vs present continuous for plans", note: "going to (intention) vs present continuous (arranged plan)." },
      { id: "42.4", title: "Verb + infinitive", focus: "grammar", canDo: "I can say what I want/hope/plan to do.", grammar: "verb + infinitive (want/hope/plan/decide to)", note: "I want to travel. I'm planning to study." },
      { id: "42.5", title: "would like to", focus: "grammar", canDo: "I can talk about wishes politely.", grammar: "would like / 'd like to", note: "I'd like to learn… Softer than 'want'." },
      { id: "42.6", title: "so that / in order to", focus: "grammar", canDo: "I can express purpose.", grammar: "purpose: to / in order to / so that", note: "I'm saving so that I can travel." },
      { id: "42.7", title: "Stress in two-word verbs", focus: "pronunciation", canDo: "I can stress infinitive phrases naturally.", note: "want to → 'wanna'; hope to, plan to rhythm." },
      { id: "42.8", title: "Talk about your goals", focus: "function", canDo: "I can share goals and reasons.", fn: "talking about goals and motivations" },
      { id: "42.9", title: "Encourage someone", focus: "function", canDo: "I can encourage and give support.", fn: "encouraging and motivating someone" },
      { id: "42.10", title: "Make a plan", focus: "skill", canDo: "I can lay out a plan with steps and purpose.", note: "Chain infinitives + purpose clauses." },
      { id: "42.11", title: "Listening: a personal goal", focus: "skill", canDo: "I can follow someone describing a goal.", note: "Catch plans vs wishes vs purpose." },
      { id: "42.12", title: "Unit review", focus: "review", canDo: "I can talk about plans, goals, and purpose.", note: "Mixed check of Unit 6 (B1) goals." },
    ],
  },
  {
    id: 43,
    slug: "celebrations",
    title: "Celebrations",
    summary: "Talk about holidays and experiences using the present perfect.",
    lessons: [
      { id: "43.1", title: "Celebrations & holidays", focus: "vocabulary", canDo: "I can talk about festivals and customs.", vocab: ["celebrate", "anniversary", "tradition", "decorate", "fireworks"] },
      { id: "43.2", title: "Party & event words", focus: "vocabulary", canDo: "I can describe parties and events.", vocab: ["invite", "guest", "host", "gift", "occasion"] },
      { id: "43.3", title: "Present perfect: for / since", focus: "grammar", canDo: "I can say how long something has been true.", grammar: "present perfect with for and since", note: "I've known them for years / since 2019. Unfinished time." },
      { id: "43.4", title: "already / yet / just", focus: "grammar", canDo: "I can use already, yet, and just.", grammar: "present perfect with already / yet / just", note: "I've just arrived. Have you eaten yet? I've already finished." },
      { id: "43.5", title: "been vs gone", focus: "grammar", canDo: "I can tell 'has been' from 'has gone'.", grammar: "have been to vs have gone to", note: "She's been to Italy (and back) vs she's gone to Italy (still there)." },
      { id: "43.6", title: "How long…? questions", focus: "grammar", canDo: "I can ask how long with the present perfect.", grammar: "How long have you…?", note: "Pair with for/since answers." },
      { id: "43.7", title: "Linking in connected speech", focus: "pronunciation", canDo: "I can link words for fluent perfect forms.", note: "have you → 'have ya'; been_in, gone_on linking." },
      { id: "43.8", title: "Invite & make plans", focus: "function", canDo: "I can invite someone and respond.", fn: "inviting and arranging to meet" },
      { id: "43.9", title: "Describe a celebration", focus: "function", canDo: "I can describe a holiday I celebrate.", fn: "describing a celebration and traditions" },
      { id: "43.10", title: "Talk about a memorable event", focus: "skill", canDo: "I can describe a recent special event.", note: "Mix present perfect + simple past for detail." },
      { id: "43.11", title: "Listening: a festival", focus: "skill", canDo: "I can follow a description of a celebration.", note: "Catch time expressions with the perfect." },
      { id: "43.12", title: "Unit review", focus: "review", canDo: "I can talk about celebrations and experiences.", note: "Mixed check of Unit 7 (B1) goals." },
    ],
  },
  {
    id: 44,
    slug: "once-upon-a-time",
    title: "Once Upon a Time",
    summary: "Tell stories about the past using narrative tenses and used to.",
    lessons: [
      { id: "44.1", title: "Storytelling words", focus: "vocabulary", canDo: "I can use words to tell a story.", vocab: ["suddenly", "fortunately", "in the end", "at first", "later"] },
      { id: "44.2", title: "Life events", focus: "vocabulary", canDo: "I can talk about important life events.", vocab: ["grow up", "move", "graduate", "fall in love", "retire"] },
      { id: "44.3", title: "Past continuous", focus: "grammar", canDo: "I can describe an action in progress in the past.", grammar: "past continuous (was/were + -ing)", note: "I was cooking at 8 p.m. Background action." },
      { id: "44.4", title: "Past simple vs continuous", focus: "grammar", canDo: "I can combine background and main events.", grammar: "past continuous vs simple past (when / while)", note: "While I was walking, I saw… interrupted action." },
      { id: "44.5", title: "used to", focus: "grammar", canDo: "I can talk about past habits and states.", grammar: "used to + base verb", note: "I used to play… (not anymore). Affirmative, negative, questions." },
      { id: "44.6", title: "Time linkers in narrative", focus: "grammar", canDo: "I can sequence a story clearly.", grammar: "sequencing: first, then, after that, finally", note: "Order events in a short story." },
      { id: "44.7", title: "used to /ˈjuːstə/", focus: "pronunciation", canDo: "I can pronounce 'used to' naturally.", note: "Reduced 'useta'; was/were weak forms." },
      { id: "44.8", title: "Tell a short story", focus: "function", canDo: "I can tell a simple personal story.", fn: "telling a story about the past" },
      { id: "44.9", title: "React to a story", focus: "function", canDo: "I can react and ask follow-up questions.", fn: "reacting to and continuing a story" },
      { id: "44.10", title: "Then and now", focus: "skill", canDo: "I can contrast how life used to be with now.", note: "used to + present simple contrast." },
      { id: "44.11", title: "Listening: a childhood memory", focus: "skill", canDo: "I can follow a narrative in past tenses.", note: "Track sequence and interrupted actions." },
      { id: "44.12", title: "Unit review", focus: "review", canDo: "I can tell a past story with narrative tenses.", note: "Mixed check of Unit 8 (B1) goals." },
    ],
  },
  {
    id: 45,
    slug: "work",
    title: "Work",
    summary: "Talk about jobs and responsibilities using gerunds, infinitives, and modals.",
    lessons: [
      { id: "45.1", title: "Jobs & workplaces", focus: "vocabulary", canDo: "I can talk about jobs and where people work.", vocab: ["manager", "employee", "shift", "salary", "deadline"] },
      { id: "45.2", title: "Job qualities & duties", focus: "vocabulary", canDo: "I can describe job duties and skills.", vocab: ["deal with", "be in charge of", "responsible", "organized", "hardworking"] },
      { id: "45.3", title: "Verb + gerund", focus: "grammar", canDo: "I can use -ing after certain verbs.", grammar: "verb + gerund (enjoy, avoid, finish, mind)", note: "I enjoy working with people. I don't mind staying late." },
      { id: "45.4", title: "Verb + infinitive", focus: "grammar", canDo: "I can use to-infinitive after certain verbs.", grammar: "verb + infinitive (need, decide, agree, manage)", note: "I need to finish this. We agreed to help." },
      { id: "45.5", title: "Gerund vs infinitive", focus: "grammar", canDo: "I can choose -ing or to- correctly.", grammar: "gerund vs infinitive", note: "Common verb lists; like/start (both); stop doing vs stop to do (intro)." },
      { id: "45.6", title: "Modals of obligation", focus: "grammar", canDo: "I can talk about rules and duties.", grammar: "have to / must / should / don't have to", note: "obligation, prohibition (mustn't) vs no obligation (don't have to)." },
      { id: "45.7", title: "Stress for emphasis", focus: "pronunciation", canDo: "I can stress modals to show importance.", note: "You MUST… you should… contrastive stress." },
      { id: "45.8", title: "A job interview", focus: "function", canDo: "I can answer common interview questions.", fn: "talking about yourself in an interview" },
      { id: "45.9", title: "Talk about your job", focus: "function", canDo: "I can describe what I do and like about work.", fn: "describing a job and responsibilities" },
      { id: "45.10", title: "Describe an ideal job", focus: "skill", canDo: "I can describe my ideal job and why.", note: "Combine gerunds/infinitives + reasons." },
      { id: "45.11", title: "Listening: a workday", focus: "skill", canDo: "I can follow someone describe their job.", note: "Catch duties, obligations, preferences." },
      { id: "45.12", title: "Unit review", focus: "review", canDo: "I can talk about work with gerunds, infinitives, and modals.", note: "Mixed check of Unit 9 (B1) goals." },
    ],
  },
  {
    id: 46,
    slug: "stay-in-touch",
    title: "Stay in Touch",
    summary: "Communicate, report what others said, and handle messages.",
    lessons: [
      { id: "46.1", title: "Communication verbs", focus: "vocabulary", canDo: "I can talk about ways to keep in touch.", vocab: ["text", "call back", "reply", "keep in touch", "get in touch"] },
      { id: "46.2", title: "Phones & messages", focus: "vocabulary", canDo: "I can handle phone and message situations.", vocab: ["voicemail", "missed call", "hang up", "leave a message", "on mute"] },
      { id: "46.3", title: "Reported statements", focus: "grammar", canDo: "I can report what someone said.", grammar: "reported speech: statements (say / tell)", note: "He said (that) he was busy. Basic backshift present→past." },
      { id: "46.4", title: "Reported questions", focus: "grammar", canDo: "I can report a question.", grammar: "reported questions (asked if / wh-)", note: "She asked if I was free. He asked where I lived (statement word order)." },
      { id: "46.5", title: "say vs tell", focus: "grammar", canDo: "I can use say and tell correctly.", grammar: "say vs tell", note: "tell + person (tell me); say (no person): say something to me." },
      { id: "46.6", title: "will for offers & promises", focus: "grammar", canDo: "I can make instant offers and promises.", grammar: "will for offers/promises/decisions", note: "I'll call you back. I'll help. Decision at the moment." },
      { id: "46.7", title: "Intonation: polite requests", focus: "pronunciation", canDo: "I can sound polite on the phone.", note: "Rising/wide intonation for politeness." },
      { id: "46.8", title: "Make a phone call", focus: "function", canDo: "I can start, manage, and end a call.", fn: "telephoning: opening, messages, closing" },
      { id: "46.9", title: "Pass on a message", focus: "function", canDo: "I can relay what someone told me.", fn: "relaying messages with reported speech" },
      { id: "46.10", title: "Handle a misunderstanding", focus: "skill", canDo: "I can clarify and confirm information.", note: "Check, repeat, and report back." },
      { id: "46.11", title: "Listening: a voicemail", focus: "skill", canDo: "I can note key info from a message.", note: "Catch who/what/when to report." },
      { id: "46.12", title: "Unit review", focus: "review", canDo: "I can communicate and report what others said.", note: "Mixed check of Unit 10 (B1) goals." },
    ],
  },
  {
    id: 47,
    slug: "technology",
    title: "Technology",
    summary: "Discuss technology and how things are done, using the passive.",
    lessons: [
      { id: "47.1", title: "Technology & devices", focus: "vocabulary", canDo: "I can talk about devices and features.", vocab: ["app", "update", "charge", "back up", "log in"] },
      { id: "47.2", title: "Using technology", focus: "vocabulary", canDo: "I can describe how I use technology.", vocab: ["download", "install", "stream", "share", "set up"] },
      { id: "47.3", title: "Passive: present simple", focus: "grammar", canDo: "I can say how things are done now.", grammar: "present simple passive (is/are + past participle)", note: "Phones are made in… English is spoken here. Focus on the action/result." },
      { id: "47.4", title: "Passive: past simple", focus: "grammar", canDo: "I can say how things were done.", grammar: "past simple passive (was/were + past participle)", note: "It was invented in 1876. by + agent when relevant." },
      { id: "47.5", title: "Active vs passive", focus: "grammar", canDo: "I can choose active or passive appropriately.", grammar: "active vs passive (when to use passive)", note: "Use passive when the doer is unknown/unimportant." },
      { id: "47.6", title: "used to vs be used to", focus: "grammar", canDo: "I can tell past habit from being accustomed.", grammar: "used to vs be/get used to", note: "I used to (past habit) vs I'm used to (accustomed) + noun/-ing." },
      { id: "47.7", title: "Past participle endings", focus: "pronunciation", canDo: "I can pronounce participles in the passive.", note: "made, spoken, written, taken — clear endings." },
      { id: "47.8", title: "Explain how something works", focus: "function", canDo: "I can explain a process.", fn: "explaining how something is made/done" },
      { id: "47.9", title: "Give & follow instructions", focus: "function", canDo: "I can give tech instructions.", fn: "giving step-by-step instructions" },
      { id: "47.10", title: "Describe a useful invention", focus: "skill", canDo: "I can describe an invention using the passive.", note: "It's used to… It was invented by…" },
      { id: "47.11", title: "Listening: a product review", focus: "skill", canDo: "I can follow a description of a product.", note: "Catch passive descriptions and features." },
      { id: "47.12", title: "Unit review", focus: "review", canDo: "I can discuss technology using the passive.", note: "Mixed check of Unit 11 (B1) goals." },
    ],
  },
  {
    id: 48,
    slug: "travel",
    title: "Travel",
    summary: "Plan trips, handle travel situations, and talk about possible outcomes.",
    lessons: [
      { id: "48.1", title: "Travel vocabulary", focus: "vocabulary", canDo: "I can talk about trips and transport.", vocab: ["book", "luggage", "boarding pass", "delay", "destination"] },
      { id: "48.2", title: "At the airport / hotel", focus: "vocabulary", canDo: "I can handle airport and hotel words.", vocab: ["check in", "gate", "reservation", "passport", "departure"] },
      { id: "48.3", title: "First conditional", focus: "grammar", canDo: "I can talk about likely future results.", grammar: "first conditional (if + present, will)", note: "If we miss the train, we'll take a taxi. Real future possibility." },
      { id: "48.4", title: "when / unless / as soon as", focus: "grammar", canDo: "I can link conditions and time.", grammar: "first conditional with when/unless/as soon as", note: "Unless it rains, we'll walk. As soon as I arrive, I'll text." },
      { id: "48.5", title: "Modals for travel", focus: "grammar", canDo: "I can give advice and talk necessity for trips.", grammar: "should / ought to / have to / had better", note: "You should book early. You have to show your passport." },
      { id: "48.6", title: "Indirect questions", focus: "grammar", canDo: "I can ask politely for travel info.", grammar: "indirect questions (Could you tell me…?)", note: "Could you tell me where the gate is? (statement order)." },
      { id: "48.7", title: "Polite intonation for requests", focus: "pronunciation", canDo: "I can ask travel questions politely.", note: "Wide, rising intonation; soft openings." },
      { id: "48.8", title: "Book & ask about a trip", focus: "function", canDo: "I can make a booking and ask questions.", fn: "booking travel and asking for information" },
      { id: "48.9", title: "Deal with a travel problem", focus: "function", canDo: "I can handle a delay or problem politely.", fn: "solving a travel problem" },
      { id: "48.10", title: "Plan a trip", focus: "skill", canDo: "I can plan a trip and talk through what-ifs.", note: "Combine first conditional + travel modals." },
      { id: "48.11", title: "Listening: travel announcements", focus: "skill", canDo: "I can catch key info in announcements.", note: "Times, gates, changes, instructions." },
      { id: "48.12", title: "Course review", focus: "review", canDo: "I can use everything from the B1 course in conversation.", note: "Wrap-up: mix goals from across all B1 units." },
    ],
  },
];

/** Tag base topics with a course (level + target language), offsetting topic ids
 *  so each course stays unique and renumbering lesson ids to match. */
function course(
  topics: Omit<Topic, "level" | "target">[],
  level: CEFRLevel,
  target: TargetLanguage,
  idOffset: number,
): Topic[] {
  return topics.map((t) => ({
    ...t,
    id: t.id + idOffset,
    level,
    target,
    lessons: t.lessons.map((l, i) => ({ ...l, id: `${t.id + idOffset}.${i + 1}` })),
  }));
}

export const CURRICULUM: Topic[] = [
  ...course(A1_TOPICS, "A1", "English", 0), // topics 1–12
  ...course(A2_TOPICS, "A2", "English", 0), // topics 13–24
  // Portuguese (Brazilian) A1 — a real Portuguese scope & sequence (topics 25–36).
  ...course(PT_A1_TOPICS, "A1", "Portuguese", 24),
  ...course(B1_TOPICS, "B1", "English", 0), // topics 37–48
];

export const LEVELS: CEFRLevel[] = ["A1", "A2", "B1"];
/** Target languages offered, in display order. */
export const COURSES: TargetLanguage[] = ["English", "Portuguese"];

/** Topics for one course — a target language at a CEFR level — in order. */
export function topicsBy(target: TargetLanguage, level: CEFRLevel): Topic[] {
  return CURRICULUM.filter((t) => t.target === target && t.level === level);
}

/** Which CEFR levels exist for a target language (e.g. Portuguese only has A1). */
export function levelsForCourse(target: TargetLanguage): CEFRLevel[] {
  return LEVELS.filter((lv) => CURRICULUM.some((t) => t.target === target && t.level === lv));
}

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
  // Continue within the SAME course (same target language), by id order.
  const nextTopic = CURRICULUM.filter((t) => t.target === topic.target && t.id > topicId).sort(
    (a, b) => a.id - b.id,
  )[0];
  return nextTopic ? { topicId: nextTopic.id, lessonId: nextTopic.lessons[0]!.id } : null;
}
