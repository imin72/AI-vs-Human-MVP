import { useState, useMemo, useEffect, useCallback } from 'react';
import { AppStage, Language, QuizSet, HistoryItem, EvaluationResult, QuizQuestion } from '../types';
import { generateQuestionsBatch, evaluateBatchAnswers, BatchEvaluationInput, seedLocalDatabase } from '../services/geminiService';
import { audioHaptic } from '../services/audioHapticService';
import { TRANSLATIONS } from '../utils/translations';

// Import split hooks
import { useUserProfile } from '../hooks/useUserProfile';
import { useTopicManager } from '../hooks/useTopicManager';
import { useQuizEngine, AccumulatedBatchData } from '../hooks/useQuizEngine';
import { useAppNavigation } from '../hooks/useAppNavigation';
import { useSwipeGesture } from '../hooks/useSwipeGesture';

const DEBUG_QUIZ: QuizQuestion[] = [
  { 
    id: 1, 
    question: "Which protocol is used for secure web browsing?", 
    options: ["HTTP", "HTTPS", "FTP", "SMTP"], 
    correctAnswer: "HTTPS", 
    context: "Hypertext Transfer Protocol Secure is the standard." 
  },
  { 
    id: 2, 
    question: "What is the time complexity of binary search?", 
    options: ["O(n)", "O(log n)", "O(n^2)", "O(1)"], 
    correctAnswer: "O(log n)", 
    context: "Binary search divides the search interval in half." 
  },
  {
    id: 3,
    question: "Which React hook is used for side effects?",
    options: ["useState", "useEffect", "useMemo", "useReducer"],
    correctAnswer: "useEffect",
    context: "useEffect handles side effects in function components."
  }
];

// Helper to detect browser language
const getBrowserLanguage = (): Language => {
  if (typeof navigator === 'undefined') return 'en';
  const lang = navigator.language.split('-')[0];
  const supported: Language[] = ['en', 'ko', 'ja', 'zh', 'es', 'fr'];
  return supported.includes(lang as Language) ? (lang as Language) : 'en';
};

export const useGameViewModel = () => {
  // 1. Core State
  const [language, setLanguage] = useState<Language>(getBrowserLanguage());
  const [isPending, setIsPending] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  
  // 2. Composed Hooks
  const nav = useAppNavigation();
  const profile = useUserProfile();
  const topicMgr = useTopicManager(language);
  const quiz = useQuizEngine();

  // 3. Result State (Still managed here as it connects Quiz -> Profile)
  const [evaluation, setEvaluation] = useState<EvaluationResult | null>(null);
  const [sessionResults, setSessionResults] = useState<EvaluationResult[]>([]); 

  const t = useMemo(() => TRANSLATIONS[language], [language]);

  // --- Logic: Finish Batch & Calculate Results ---
  const finishBatchQuiz = async (allBatches: AccumulatedBatchData[]) => {
    if (isPending) return;
    setIsPending(true);
    nav.setStage(AppStage.ANALYZING);
    audioHaptic.playClick('hard');

    try {
      // Prepare data for API & Local Profile Updates
      const batchInputs: BatchEvaluationInput[] = [];
      const updatedProfile = { ...profile.userProfile };
      const currentScores = { ...(updatedProfile.scores || {}) };
      const currentElos = { ...(updatedProfile.eloRatings || {}) };
      const seenIds = new Set(updatedProfile.seenQuestionIds || []);
      const currentHistory = [...(updatedProfile.history || [])];

      allBatches.forEach(batch => {
        const correctCount = batch.answers.filter(a => a.isCorrect).length;
        const totalCount = batch.answers.length;
        const score = totalCount > 0 ? Math.round((correctCount / totalCount) * 100) : 0;
        
        // Update High Score
        if (score >= (currentScores[batch.topicLabel] || 0)) {
           currentScores[batch.topicLabel] = score;
        }

        // Adaptive Learning Logic
        batch.answers.forEach(a => seenIds.add(a.questionId));

        const currentElo = currentElos[batch.topicId] || 1000;
        let eloChange = 0;
        if (score >= 80) eloChange = 30; 
        else if (score >= 60) eloChange = 10;
        else if (score >= 40) eloChange = -10; 
        else eloChange = -20;

        currentElos[batch.topicId] = Math.max(0, currentElo + eloChange);

        const aiBenchmark = topicMgr.state.difficulty === 'HARD' ? 98 : topicMgr.state.difficulty === 'MEDIUM' ? 95 : 92;
        
        const historyItem: HistoryItem = {
          timestamp: Date.now(),
          topicId: batch.topicId,
          score: score,
          aiScore: aiBenchmark,
          difficulty: topicMgr.state.difficulty
        };
        currentHistory.push(historyItem);

        batchInputs.push({
          topic: batch.topicLabel,
          score: score,
          performance: batch.answers 
        });
      });

      // Save Profile
      updatedProfile.scores = currentScores;
      updatedProfile.eloRatings = currentElos;
      updatedProfile.seenQuestionIds = Array.from(seenIds);
      updatedProfile.history = currentHistory;
      
      profile.actions.persistProfile(updatedProfile);

      // Debug Mode Check
      const isDebug = allBatches.some(b => b.topicLabel.startsWith("Debug"));
      if (isDebug) {
         await new Promise(resolve => setTimeout(resolve, 800));
         const mockResults: EvaluationResult[] = allBatches.map(b => ({
            id: b.topicId,
            totalScore: 80,
            humanPercentile: 90,
            aiComparison: "Debug Mode Analysis.",
            demographicPercentile: 50,
            demographicComment: "Simulated Data.",
            title: b.topicLabel,
            details: b.answers.map(a => ({
               questionId: a.questionId,
               isCorrect: a.isCorrect,
               questionText: a.questionText,
               selectedOption: a.selectedOption,
               correctAnswer: a.correctAnswer,
               aiComment: "Debug Comment",
               correctFact: "Debug Fact"
            }))
         }));
         setEvaluation(mockResults[0]);
         setSessionResults(mockResults);
         audioHaptic.playLevelUp();
         nav.setStage(AppStage.RESULTS);
         return;
      }

      // Real API Call
      const results = await evaluateBatchAnswers(batchInputs, updatedProfile, language);
      
      // Inject IDs
      const resultsWithIds = results.map((res, idx) => ({
        ...res,
        id: allBatches[idx].topicId
      }));

      setEvaluation(resultsWithIds[0]); 
      setSessionResults(resultsWithIds);
      audioHaptic.playLevelUp();
      nav.setStage(AppStage.RESULTS);

    } catch (e: any) {
      console.error("Batch Finish Error", e);
      setErrorMsg(e.message || "Unknown analysis error");
      audioHaptic.playError();
      nav.setStage(AppStage.ERROR);
    } finally {
      setIsPending(false);
    }
  };

  // --- Orchestration: Confirm Answer & Flow Control ---
  const confirmAnswer = useCallback(() => {
    if (!quiz.state.selectedOption || quiz.state.isSubmitting) return;
    
    quiz.actions.setIsSubmitting(true);
    
    const question = quiz.state.questions[quiz.state.currentQuestionIndex];
    const isCorrect = quiz.state.selectedOption === question.correctAnswer;
    
    if (isCorrect) audioHaptic.playSuccess();
    else audioHaptic.playError();

    const answer = { 
      questionId: question.id, 
      questionText: question.question, 
      selectedOption: quiz.state.selectedOption, 
      correctAnswer: question.correctAnswer, 
      isCorrect 
    };
    
    const updatedAnswers = [...quiz.state.userAnswers, answer];
    quiz.actions.setUserAnswers(updatedAnswers);
    
    // Move to next question or finish topic
    if (quiz.state.currentQuestionIndex < quiz.state.questions.length - 1) {
      setTimeout(() => {
         quiz.actions.setCurrentQuestionIndex(prev => prev + 1);
         quiz.actions.setSelectedOption(null);
         quiz.actions.setIsSubmitting(false);
      }, 800); 
    } else {
      // Topic Finished
      const currentTopicLabel = quiz.state.currentQuizSet?.topic || "Unknown";
      const currentTopicId = quiz.state.currentQuizSet?.categoryId || "GENERAL";
      
      const batchData: AccumulatedBatchData = {
         topicLabel: currentTopicLabel,
         topicId: currentTopicId,
         answers: updatedAnswers
      };
      
      const newCompletedBatches = [...quiz.state.completedBatches, batchData];
      quiz.actions.setCompletedBatches(newCompletedBatches);

      if (quiz.state.remainingTopics > 0) {
         // Proceed to next topic in queue
         setTimeout(() => {
             quiz.actions.handleNextTopic();
         }, 800);
      } else {
         // All Topics Finished
         finishBatchQuiz(newCompletedBatches).then(() => {
             quiz.actions.setIsSubmitting(false);
         });
      }
    }
  }, [quiz, nav, profile.userProfile, language]);

  // --- Browser History Integration ---
  const performBackNavigation = useCallback((): boolean => {
    if (isPending || quiz.state.isSubmitting) return false;
    try { audioHaptic.playClick('soft'); } catch {}

    const confirmHomeMsg = t.common.confirm_home;

    switch (nav.stage) {
      case AppStage.TOPIC_SELECTION:
        // Handle internal subtopic state without leaving view
        if (topicMgr.state.selectionPhase === 'SUBTOPIC') {
            topicMgr.actions.backToCategories();
            return true;
        }
        nav.setStage(AppStage.INTRO); 
        return true;

      case AppStage.PROFILE:
        nav.setStage(AppStage.INTRO);
        return true;

      case AppStage.INTRO:
        // Allow default browser behavior (exit app/tab)
        return false;

      case AppStage.QUIZ:
        if (window.confirm(confirmHomeMsg)) {
           // Cleanup and go home
           setIsPending(false);
           quiz.actions.resetQuizState();
           topicMgr.actions.resetSelection();
           setEvaluation(null);
           setSessionResults([]);
           nav.setStage(AppStage.INTRO);
           return true;
        }
        // Cancelled
        return true;

      case AppStage.RESULTS:
      case AppStage.ERROR:
        if (window.confirm(confirmHomeMsg)) {
          setIsPending(false);
          quiz.actions.resetQuizState();
          topicMgr.actions.resetSelection();
          setEvaluation(null);
          setSessionResults([]);
          nav.setStage(AppStage.INTRO);
          return true;
        }
        return true;

      default:
        nav.setStage(AppStage.INTRO);
        return true;
    }
  }, [nav.stage, topicMgr.state.selectionPhase, isPending, quiz.state.isSubmitting, t, nav, topicMgr.actions, quiz.actions]);

  useEffect(() => {
    const handlePopState = (_: PopStateEvent) => {
      // Browser Back Button was pressed
      nav.isNavigatingBackRef.current = true;
      const handled = performBackNavigation();
      
      // If handled internally (e.g., cancelled exit or state change),
      // we must push state back to restore forward history because browser popped it.
      if (handled) {
         window.history.pushState({ stage: nav.stage }, '');
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [performBackNavigation, nav.stage]);

  // --- Manual Back Action (Button or Swipe) ---
  const goBack = useCallback(() => {
     if (isPending || quiz.state.isSubmitting) return;
     try { audioHaptic.playClick('soft'); } catch {}

     // 1. Internal Logic first (Subtopic -> Category)
     if (nav.stage === AppStage.TOPIC_SELECTION && topicMgr.state.selectionPhase === 'SUBTOPIC') {
        topicMgr.actions.backToCategories();
        return;
     }

     // 2. Default: Trigger Browser Back which fires popstate
     window.history.back();
  }, [isPending, quiz.state.isSubmitting, nav.stage, topicMgr.state.selectionPhase, topicMgr.actions]);

  // --- Actions Wrapper for View ---
  const actions = useMemo(() => ({
    setLanguage: (lang: Language) => { 
      try { audioHaptic.playClick('soft'); } catch {}
      setLanguage(lang); 
    },
    startIntro: () => {
      try { audioHaptic.playClick('hard'); } catch {}
      if (profile.userProfile.gender && profile.userProfile.nationality) {
        nav.setStage(AppStage.TOPIC_SELECTION);
      } else {
        nav.setStage(AppStage.PROFILE);
      }
    },
    editProfile: () => {
      try { audioHaptic.playClick(); } catch {}
      nav.setStage(AppStage.PROFILE);
    },
    resetProfile: () => {
      profile.actions.resetProfile();
      nav.setStage(AppStage.PROFILE);
    },
    updateProfile: profile.actions.updateProfile,
    submitProfile: () => {
      profile.actions.saveProfile();
      nav.setStage(AppStage.TOPIC_SELECTION);
    },
    selectCategory: topicMgr.actions.selectCategory,
    proceedToSubTopics: topicMgr.actions.proceedToSubTopics,
    selectSubTopic: topicMgr.actions.selectSubTopic,
    setDifficulty: topicMgr.actions.setDifficulty,
    shuffleTopics: topicMgr.actions.shuffleTopics,
    shuffleSubTopics: () => {}, 
    setCustomTopic: (_topic: string) => {},
    
    goBack,
    
    goHome: () => {
      nav.goHome(t.common.confirm_home, () => {
        setIsPending(false);
        quiz.actions.resetQuizState();
        topicMgr.actions.resetSelection();
        setEvaluation(null);
        setSessionResults([]);
      });
    },

    resetApp: () => {
      try { audioHaptic.playClick(); } catch {}
      quiz.actions.resetQuizState();
      setEvaluation(null);
      setSessionResults([]);
      topicMgr.actions.resetSelection();
      nav.setStage(AppStage.TOPIC_SELECTION);
    },

    startQuiz: async () => {
      if (isPending) return;
      if (topicMgr.state.selectedSubTopics.length === 0) return;
      try { audioHaptic.playClick('hard'); } catch {}
      setIsPending(true);
      nav.setStage(AppStage.LOADING_QUIZ);
      try {
        const quizSets = await generateQuestionsBatch(
          topicMgr.state.selectedSubTopics, 
          topicMgr.state.difficulty, 
          language, 
          profile.userProfile
        );
        if (quizSets.length > 0) {
          quiz.actions.initQuiz(quizSets);
          nav.setStage(AppStage.QUIZ);
        } else {
           throw new Error("No questions generated");
        }
      } catch (e: any) {
        setErrorMsg(e.message || "Failed to initialize protocol");
        nav.setStage(AppStage.ERROR);
      } finally {
        setIsPending(false);
      }
    },
    
    nextTopicInQueue: () => {
      try { audioHaptic.playClick(); } catch {}
      quiz.actions.handleNextTopic();
      nav.setStage(AppStage.QUIZ);
    },

    selectOption: quiz.actions.selectOption,
    confirmAnswer,

    startDebugQuiz: async () => { 
       /* Re-implementing simplified debug for consistency */
       if (isPending) return;
       try { audioHaptic.playClick(); } catch {}
       setIsPending(true);
       nav.setStage(AppStage.LOADING_QUIZ);
       try {
         await new Promise(resolve => setTimeout(resolve, 800));
         const debugTopics = ["Debug Alpha", "Debug Beta"];
         const debugSets: QuizSet[] = debugTopics.map((topic, index) => ({
           topic: topic,
           categoryId: "GENERAL",
           questions: DEBUG_QUIZ.map(q => ({ ...q, id: q.id + (index * 100) }))
         }));
         quiz.actions.initQuiz(debugSets);
         nav.setStage(AppStage.QUIZ);
       } catch (e) {
         nav.setStage(AppStage.ERROR);
       } finally { setIsPending(false); }
    },
    triggerSeeding: async () => { 
       try { await seedLocalDatabase(console.log); alert("Seeding OK"); } catch(e) { alert("Fail"); }
    },
    previewResults: () => {
      const mockResult: EvaluationResult = {
        id: "SCIENCE",
        totalScore: 88, humanPercentile: 92, aiComparison: "Debug Mode.", demographicPercentile: 95, demographicComment: "Outlier.", title: "Quantum Physics", details: []
      };
      setEvaluation(mockResult); setSessionResults([mockResult]); nav.setStage(AppStage.RESULTS);
    },
    previewLoading: () => {
        nav.setStage(AppStage.LOADING_QUIZ);
        setTimeout(() => nav.setStage(AppStage.INTRO), 3000);
    },
  }), [language, nav, profile, topicMgr, quiz, isPending, confirmAnswer, t, goBack]);

  // --- Initialize Swipe Gestures ---
  const swipeHandlers = useSwipeGesture({
    onSwipeRight: goBack,
    edgeOnly: true, // Only swipe from edge to go back (Native-like)
    threshold: 60
  });

  // Return Facade
  return {
    state: {
      stage: nav.stage,
      language,
      userProfile: profile.userProfile,
      topicState: { 
        ...topicMgr.state, 
        isTopicLoading: isPending,
        errorMsg,
        userProfile: profile.userProfile
      },
      quizState: quiz.state,
      resultState: { evaluation, sessionResults, errorMsg } 
    },
    actions,
    swipeHandlers, // Expose swipe handlers
    t
  };
};