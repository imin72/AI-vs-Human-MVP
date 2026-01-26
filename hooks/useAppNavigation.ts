import { useState, useEffect, useRef, useCallback } from 'react';
import { AppStage } from '../types';
import { audioHaptic } from '../services/audioHapticService';

export const useAppNavigation = () => {
  const [stage, setStage] = useState<AppStage>(AppStage.INTRO);
  const isNavigatingBackRef = useRef(false);

  // Initialize history
  useEffect(() => {
    window.history.replaceState({ stage: 'root' }, '');
  }, []);

  // Sync state with history
  useEffect(() => {
    if (isNavigatingBackRef.current) {
      isNavigatingBackRef.current = false;
      return;
    }
    if (stage !== AppStage.INTRO) {
      window.history.pushState({ stage }, '');
    }
  }, [stage]);

  const goHome = useCallback((confirmMsg: string, onConfirmAction?: () => void) => {
    try { audioHaptic.playClick(); } catch {}
    
    const needsConfirmation = stage === AppStage.QUIZ || stage === AppStage.LOADING_QUIZ || stage === AppStage.ANALYZING;

    if (needsConfirmation) {
      if (!window.confirm(confirmMsg)) return;
    }
    
    if (onConfirmAction) onConfirmAction();
    setStage(AppStage.INTRO); 
    window.history.replaceState({ stage: 'root' }, '', window.location.pathname);
  }, [stage]);

  return {
    stage,
    setStage,
    goHome,
    isNavigatingBackRef
  };
};