import { useState, useCallback } from 'react';
import { QuizSet, QuizQuestion, UserAnswer } from '../types';
import { audioHaptic } from '../services/audioHapticService';

export interface AccumulatedBatchData {
  topicLabel: string;
  topicId: string;
  answers: UserAnswer[];
}

export const useQuizEngine = () => {
  const [quizQueue, setQuizQueue] = useState<QuizSet[]>([]);
  const [currentQuizSet, setCurrentQuizSet] = useState<QuizSet | null>(null);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState<UserAnswer[]>([]);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [batchProgress, setBatchProgress] = useState<{ total: number, current: number, topics: string[] }>({ total: 0, current: 0, topics: [] });
  const [completedBatches, setCompletedBatches] = useState<AccumulatedBatchData[]>([]);

  const initQuiz = useCallback((quizSets: QuizSet[]) => {
    if (quizSets.length === 0) return;
    
    const [first, ...rest] = quizSets;
    setQuizQueue(rest);
    setCurrentQuizSet(first);
    setQuestions(first.questions);
    setCurrentQuestionIndex(0);
    setUserAnswers([]);
    setCompletedBatches([]);
    
    setBatchProgress({
      total: quizSets.length,
      current: 1,
      topics: quizSets.map(qs => qs.topic)
    });
  }, []);

  const selectOption = useCallback((option: string) => {
    if (isSubmitting) return;
    try { audioHaptic.playClick('soft'); } catch {}
    setSelectedOption(option);
  }, [isSubmitting]);

  const resetQuizState = useCallback(() => {
    setQuizQueue([]);
    setCurrentQuizSet(null);
    setQuestions([]);
    setCurrentQuestionIndex(0);
    setUserAnswers([]);
    setSelectedOption(null);
    setIsSubmitting(false);
    setBatchProgress({ total: 0, current: 0, topics: [] });
    setCompletedBatches([]);
  }, []);

  const handleNextTopic = useCallback(() => {
    if (quizQueue.length > 0) {
       const [next, ...rest] = quizQueue;
       
       setQuizQueue(rest);
       setCurrentQuizSet(next);
       setQuestions(next.questions);
       setCurrentQuestionIndex(0);
       setUserAnswers([]);
       setSelectedOption(null);
       setIsSubmitting(false);

       setBatchProgress(prev => ({
          ...prev,
          current: prev.current + 1
       }));
    }
  }, [quizQueue]);

  return {
    state: {
      quizQueue,
      currentQuizSet,
      questions,
      currentQuestionIndex,
      userAnswers,
      selectedOption,
      isSubmitting,
      batchProgress,
      completedBatches,
      remainingTopics: quizQueue.length,
      nextTopicName: quizQueue.length > 0 ? quizQueue[0].topic : undefined,
      currentTopicName: currentQuizSet?.topic || (batchProgress.topics.length > 0 ? batchProgress.topics[batchProgress.current - 1] : undefined),
    },
    actions: {
      initQuiz,
      selectOption,
      resetQuizState,
      setIsSubmitting,
      setSelectedOption,
      setUserAnswers,
      setCurrentQuestionIndex,
      setCompletedBatches,
      handleNextTopic
    }
  };
};