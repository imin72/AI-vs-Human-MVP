import { Difficulty, Language, QuizQuestion } from '../types';

const CACHE_KEY_QUIZ = "cognito_quiz_cache_v3";

/**
 * Generates a unique cache key for a quiz set.
 */
export const generateCacheKey = (stableTopicId: string, difficulty: Difficulty, lang: Language) => {
  return `${stableTopicId}_${difficulty}_${lang}`.toLowerCase();
};

/**
 * Loads the entire quiz cache from localStorage.
 */
export const loadQuizCache = (): Record<string, QuizQuestion[]> => {
  try {
    const saved = localStorage.getItem(CACHE_KEY_QUIZ);
    return saved ? JSON.parse(saved) : {};
  } catch (e) {
    console.warn("[CacheManager] Failed to load cache", e);
    return {};
  }
};

/**
 * Saves the quiz cache to localStorage with basic quota management.
 */
export const saveQuizCache = (data: Record<string, QuizQuestion[]>) => {
  try {
    localStorage.setItem(CACHE_KEY_QUIZ, JSON.stringify(data));
  } catch (e) {
    // QuotaExceededError handling
    if (e instanceof DOMException && (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED')) {
      console.warn("[CacheManager] Quota exceeded. Clearing cache.");
      try {
        localStorage.removeItem(CACHE_KEY_QUIZ);
        // Retry saving current data only (optional, or just leave empty for now)
        localStorage.setItem(CACHE_KEY_QUIZ, JSON.stringify(data));
      } catch (retryErr) {
        console.error("[CacheManager] Critical cache failure", retryErr);
      }
    }
  }
};

/**
 * Updates a specific entry in the cache.
 */
export const updateCacheEntry = (key: string, questions: QuizQuestion[]) => {
  const cache = loadQuizCache();
  cache[key] = questions;
  saveQuizCache(cache);
};
