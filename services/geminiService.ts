import { Type } from "@google/genai";
import { QuizQuestion, EvaluationResult, Difficulty, UserProfile, Language, QuizSet, UserAnswer } from "../types";
import { getStaticQuestions, resolveTopicInfo } from "../data/staticDatabase";

// Import new separated services
import { generateCacheKey, loadQuizCache, updateCacheEntry, saveQuizCache } from "./cacheManager";
import { generateContentJSON, getAiClient, cleanJson } from "./geminiClient";

// --- Safe Environment Helpers ---
const isDev = () => {
  if (typeof window !== 'undefined') {
     const h = window.location.hostname;
     if (h.includes('vercel.app')) return false;
  }
  try {
    // @ts-ignore
    if (import.meta.env.DEV) return true;
  } catch {}
  if (typeof window !== 'undefined') {
    const h = window.location.hostname;
    if (h === 'localhost' || h === '127.0.0.1' || h.includes('googleusercontent.com') || h.includes('webcontainer.io') || h.includes('idx.google')) return true;
  }
  return false;
};

// Fallback Quiz Data
const FALLBACK_QUIZ: QuizQuestion[] = [
  { id: 1, question: "Which is not a characteristic of Human Intelligence?", options: ["Emotional Intuition", "Pattern Recognition", "Finite Biological Memory", "Infinite Electricity Consumption"], correctAnswer: "Infinite Electricity Consumption", context: "AI uses vast amounts of electricity compared to the human brain." },
  { id: 2, question: "What is the Turing Test designed to determine?", options: ["CPU Speed", "AI's ability to exhibit human-like behavior", "Battery life", "Internet connectivity"], correctAnswer: "AI's ability to exhibit human-like behavior" },
  { id: 3, question: "Which field is Cognito Protocol measuring?", options: ["Weightlifting", "Battle of Wits vs AI", "Cooking speed", "Running endurance"], correctAnswer: "Battle of Wits vs AI" },
  { id: 4, question: "In AI terminology, what does 'LLM' stand for?", options: ["Light Level Monitor", "Large Language Model", "Long Logic Mode", "Lunar Landing Module"], correctAnswer: "Large Language Model" },
  { id: 5, question: "Who is often called the father of Computer Science?", options: ["Alan Turing", "Steve Jobs", "Elon Musk", "Thomas Edison"], correctAnswer: "Alan Turing" }
];

// Helper: Translate Elo to descriptive level for Gemini
const getAdaptiveLevel = (elo: number): string => {
  if (elo < 800) return "Beginner";
  if (elo < 1200) return "Intermediate";
  if (elo < 1600) return "Advanced";
  return "Expert/PhD Level";
};

// --- CLIENT-SIDE SEEDING FUNCTION ---
export const seedLocalDatabase = async (onProgress: (msg: string) => void) => {
  if (!isDev()) {
    onProgress("Warning: File saving requires Dev Server. Data will be cached in memory only.");
  }

  const SEED_TARGETS = [
    { cat: "Science", topics: ["Quantum Physics", "Neuroscience", "Astronomy"] },
    { cat: "History", topics: ["World War II", "Ancient Egypt", "Cold War"] },
    { cat: "Tech", topics: ["Artificial Intelligence", "Coding", "Blockchain"] },
    { cat: "Philosophy", topics: ["Stoicism", "Existentialism"] }
  ];

  onProgress("Initializing Seeding Protocol...");

  for (const group of SEED_TARGETS) {
    for (const topic of group.topics) {
      const difficulty = Difficulty.HARD;
      const lang = 'en';
      
      onProgress(`Generating Master Data for: ${topic}...`);
      
      try {
        const existing = await getStaticQuestions(topic, difficulty, lang);
        if (existing) {
          console.log(`[Seed] Skipping ${topic} (Already exists)`);
          continue;
        }

        const prompt = `
          Generate 5 challenging, high-quality multiple-choice questions about "${topic}".
          STRICT OBJECTIVITY RULES:
          1. All questions must be based on UNDISPUTED FACTS and HARD DATA.
          2. Avoid subjective value judgments.
          3. Answers must be objectively verifiable.
          Constraints: English, Hard. Format: JSON Array (id, question, options, correctAnswer, context).
        `;

        const questions = await generateContentJSON(prompt);
        
        // Log to console
        console.group(`📦 [SEED DATA] ${topic}`);
        console.log(JSON.stringify(questions, null, 2));
        console.groupEnd();

        // Save via Middleware
        if (isDev()) {
          try {
            await fetch('/__save-question', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ 
                  categoryId: group.cat, 
                  key: `${topic}_${difficulty}_${lang}`, 
                  data: questions 
                })
            });
          } catch (err) { /* Ignore */ }
        }

        // Update Cache
        updateCacheEntry(generateCacheKey(topic, difficulty, lang), questions);
        
        await new Promise(r => setTimeout(r, 1000));

      } catch (e) {
        console.error(`[Seed] Failed for ${topic}`, e);
        onProgress(`Error seeding ${topic}`);
      }
    }
  }
  onProgress("Seeding Complete!");
};

// --- BACKGROUND TASK: Mirror Translation ---
const triggerBackgroundTranslation = async (
  topicId: string,
  categoryId: string,
  difficulty: Difficulty,
  sourceLang: Language,
  sourceQuestions: QuizQuestion[]
) => {
  if (!isDev()) return;

  const ALL_LANGUAGES: Language[] = ['en', 'ko', 'ja', 'es', 'fr', 'zh'];
  const targetLangs = ALL_LANGUAGES.filter(l => l !== sourceLang);

  console.log(`[Background] Mirroring ${topicId} to [${targetLangs.join(',')}]...`);

  try {
    const prompt = `
      Translate the following JSON quiz questions from ${sourceLang} into: ${JSON.stringify(targetLangs)}.
      SOURCE DATA: ${JSON.stringify(sourceQuestions)}
      RULES:
      1. Return JSON object where keys are language codes.
      2. Values are arrays of questions matching input structure.
      3. Maintain IDs.
    `;

    // Define Schema
    const questionSchema = {
      type: Type.OBJECT,
      properties: {
        id: { type: Type.INTEGER },
        question: { type: Type.STRING }, 
        options: { type: Type.ARRAY, items: { type: Type.STRING } }, 
        correctAnswer: { type: Type.STRING }, 
        context: { type: Type.STRING }
      }
    };
    const langProperties: Record<string, any> = {};
    targetLangs.forEach(lang => {
      langProperties[lang] = { type: Type.ARRAY, items: questionSchema };
    });

    const translatedData = await generateContentJSON(prompt, {
      type: Type.OBJECT,
      properties: langProperties,
      required: targetLangs
    });

    // Update Cache and File System
    const quizCache = loadQuizCache();
    for (const lang of targetLangs) {
      if (translatedData[lang]) {
        const questions = translatedData[lang];
        const key = generateCacheKey(topicId, difficulty, lang as Language);
        quizCache[key] = questions;

        fetch('/__save-question', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ 
              categoryId: categoryId, 
              key: `${topicId}_${difficulty}_${lang}`, 
              data: questions 
            })
        }).catch(() => {});
      }
    }
    saveQuizCache(quizCache);

  } catch (error) {
    console.warn(`[Background] Translation failed for ${topicId}`, error);
  }
};

/**
 * Main Orchestrator: Fetch Questions
 * Priority: 1. Static DB -> 2. Local Cache -> 3. Master Data Translation -> 4. AI Generation
 */
export const generateQuestionsBatch = async (
  topics: string[], 
  difficulty: Difficulty, 
  lang: Language,
  userProfile?: UserProfile
): Promise<QuizSet[]> => {
  const quizCache = loadQuizCache();
  const results: QuizSet[] = [];
  
  const resolvedRequests = topics.map(topicLabel => {
    const info = resolveTopicInfo(topicLabel, lang);
    return {
      originalLabel: topicLabel,
      stableId: info ? info.englishName : topicLabel, 
      catId: info ? info.catId : "GENERAL"
    };
  });

  const missingRequests: typeof resolvedRequests = [];
  const translationRequests: { req: typeof resolvedRequests[0], sourceData: QuizQuestion[] }[] = [];
  const seenIds = new Set(userProfile?.seenQuestionIds || []);

  for (const req of resolvedRequests) {
    const cacheKey = generateCacheKey(req.stableId, difficulty, lang);

    // 1. Static DB Check
    const staticQuestions = await getStaticQuestions(req.originalLabel, difficulty, lang);
    if (staticQuestions) {
      const unseen = staticQuestions.filter(q => !seenIds.has(q.id));
      if (unseen.length >= 5) {
        results.push({ topic: req.originalLabel, questions: unseen.sort(() => 0.5 - Math.random()).slice(0, 5), categoryId: req.catId });
        console.log(`[Source: StaticDB] ${req.stableId}`);
        continue;
      }
    }

    // 2. Cache Check
    if (quizCache[cacheKey]) {
       const cached = quizCache[cacheKey];
       const unseen = cached.filter((q: QuizQuestion) => !seenIds.has(q.id));
       if (unseen.length >= 5) {
           results.push({ topic: req.originalLabel, questions: unseen.sort(() => 0.5 - Math.random()).slice(0, 5), categoryId: req.catId });
           console.log(`[Source: Cache] ${req.stableId}`);
           continue;
       }
    }

    // 3. Master Data Translation Check (English -> Target Lang)
    if (lang !== 'en') {
      const masterData = await getStaticQuestions(req.originalLabel, difficulty, 'en');
      if (masterData && masterData.length > 0) {
        translationRequests.push({ req, sourceData: masterData });
        continue;
      }
    }

    // 4. Queue for Generation
    missingRequests.push(req);
  }

  // PROCESS TRANSLATIONS
  if (translationRequests.length > 0) {
    for (const item of translationRequests) {
      try {
        const { req, sourceData } = item;
        const sourceSelection = sourceData.filter(q => !seenIds.has(q.id)).slice(0, 5);
        
        if (sourceSelection.length === 0) {
          missingRequests.push(req);
          continue;
        }

        const prompt = `Translate these quiz questions from English to ${lang}. Return valid JSON matching structure. INPUT: ${JSON.stringify(sourceSelection)}`;
        const translatedQs = await generateContentJSON(prompt);
        
        // Cache It
        updateCacheEntry(generateCacheKey(req.stableId, difficulty, lang), translatedQs);
        results.push({ topic: req.originalLabel, questions: translatedQs, categoryId: req.catId });
        console.log(`[Source: Translation] ${req.stableId}`);

      } catch (e) {
        console.error("Translation Failed, falling back to gen", e);
        missingRequests.push(item.req);
      }
    }
  }

  // PROCESS AI GENERATION
  if (missingRequests.length > 0) {
    try {
      const targetIds = missingRequests.map(r => r.stableId);
      const adaptiveContext = missingRequests.map(r => {
         const elo = userProfile?.eloRatings?.[r.catId] || 1000;
         return `${r.stableId}: User Level ${getAdaptiveLevel(elo)} (Elo ${elo})`;
      }).join("; ");

      const prompt = `
        Generate 5 multiple-choice questions for EACH topic: ${JSON.stringify(targetIds)}.
        Difficulty: ${difficulty}.
        Language: ${lang}.
        Constraints: Objective facts only. No subjective questions.
        Context: ${adaptiveContext}.
        Format: JSON Object where keys are topic names and values are arrays of questions.
      `;

      // Schema construction
      const questionSchema = {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.INTEGER },
          question: { type: Type.STRING }, 
          options: { type: Type.ARRAY, items: { type: Type.STRING } }, 
          correctAnswer: { type: Type.STRING }, 
          context: { type: Type.STRING }
        },
        required: ["id", "question", "options", "correctAnswer", "context"]
      };
      const topicProperties: Record<string, any> = {};
      targetIds.forEach(id => { topicProperties[id] = { type: Type.ARRAY, items: questionSchema }; });

      const generatedData = await generateContentJSON(prompt, {
        type: Type.OBJECT,
        properties: topicProperties,
        required: targetIds
      });

      missingRequests.forEach(req => {
        if (generatedData[req.stableId]) {
          const raw = generatedData[req.stableId];
          const formatted = raw.map((q: any) => ({
             ...q, id: q.id || Math.floor(Math.random() * 100000) + Date.now()
          }));
          
          updateCacheEntry(generateCacheKey(req.stableId, difficulty, lang), formatted);
          results.push({ topic: req.originalLabel, questions: formatted, categoryId: req.catId });
          
          // Dev: Save & Mirror
          if (isDev()) {
             fetch('/__save-question', {
                 method: 'POST',
                 headers: {'Content-Type': 'application/json'},
                 body: JSON.stringify({ categoryId: req.catId, key: `${req.stableId}_${difficulty}_${lang}`, data: formatted })
             }).catch(() => {});
             triggerBackgroundTranslation(req.stableId, req.catId, difficulty, lang, formatted);
          }
        }
      });
    } catch (e) {
      console.error("Batch Gen Failed", e);
      missingRequests.forEach(req => {
         results.push({ topic: req.originalLabel, questions: FALLBACK_QUIZ, categoryId: req.catId });
      });
    }
  }

  return topics.map(t => results.find(r => r.topic === t)!).filter(Boolean);
};

export interface BatchEvaluationInput {
  topic: string;
  score: number;
  performance: UserAnswer[]; 
}

/**
 * Main Orchestrator: Evaluate Answers
 */
export const evaluateBatchAnswers = async (
  batches: BatchEvaluationInput[],
  userProfile: UserProfile,
  lang: Language
): Promise<EvaluationResult[]> => {
  try {
    const summaries = batches.map(b => 
      `## Topic: ${b.topic} (Score: ${b.score}/100)
       Questions:
       ${b.performance.map(p => `- Q${p.questionId}: "${p.questionText}" Selected: "${p.selectedOption}" Correct: "${p.correctAnswer}" Result: ${p.isCorrect}`).join('\n')}`
    ).join('\n\n');

    const prompt = `
      Analyze user performance across topics.
      User: Age ${userProfile.ageGroup}, Nationality ${userProfile.nationality}.
      Language: ${lang} (Output in this language).
      Input: ${summaries}
      Return JSON with 'results' array matching input order.
      Include 'details' array for each question with 'aiComment' explaining the result.
    `;

    // Schema definition allows for safer parsing, though we rely on standard JSON structure
    const parsed = await generateContentJSON(prompt, {
      type: Type.OBJECT,
      properties: {
        results: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              humanPercentile: { type: Type.INTEGER },
              demographicPercentile: { type: Type.INTEGER },
              demographicComment: { type: Type.STRING },
              aiComparison: { type: Type.STRING },
              title: { type: Type.STRING },
              details: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    questionId: { type: Type.INTEGER },
                    isCorrect: { type: Type.BOOLEAN },
                    aiComment: { type: Type.STRING },
                    correctFact: { type: Type.STRING }
                  }
                }
              }
            }
          }
        }
      }
    });

    return parsed.results.map((res: any, index: number) => {
      const originalBatch = batches[index];
      return {
        ...res,
        totalScore: originalBatch.score,
        details: originalBatch.performance.map((p) => {
          const aiDetail = res.details?.find((d: any) => d.questionId === p.questionId);
          return {
            questionId: p.questionId,
            isCorrect: p.isCorrect,
            questionText: p.questionText,
            selectedOption: p.selectedOption,
            correctAnswer: p.correctAnswer,
            aiComment: aiDetail?.aiComment || "Analysis unavailable",
            correctFact: aiDetail?.correctFact || "N/A"
          };
        })
      };
    });

  } catch (error) {
    console.error("Evaluation Failed", error);
    // Fallback Result
    return batches.map(b => ({
      totalScore: b.score,
      humanPercentile: b.score,
      demographicPercentile: b.score,
      demographicComment: "Analysis failed.",
      aiComparison: "AI Unavailable.",
      title: b.topic,
      details: b.performance.map(p => ({
        ...p, aiComment: "N/A", correctFact: "N/A"
      })) as any
    }));
  }
};
