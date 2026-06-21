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
export type CEFRLevel = "A1" | "A2";

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
  slug: string;
  title: string;
  summary: string;
  lessons: MicroLesson[];
}

const A1_TOPICS: Omit<Topic, "level">[] = [
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
const A2_TOPICS: Omit<Topic, "level">[] = [
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

export const CURRICULUM: Topic[] = [
  ...A1_TOPICS.map((t) => ({ ...t, level: "A1" as const })),
  ...A2_TOPICS.map((t) => ({ ...t, level: "A2" as const })),
];

export const LEVELS: CEFRLevel[] = ["A1", "A2"];

/** All topics in one CEFR course, in order. */
export function topicsByLevel(level: CEFRLevel): Topic[] {
  return CURRICULUM.filter((t) => t.level === level);
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
  const nextTopic = CURRICULUM.find((t) => t.id === topicId + 1);
  return nextTopic ? { topicId: nextTopic.id, lessonId: nextTopic.lessons[0]!.id } : null;
}
