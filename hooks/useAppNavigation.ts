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
    // If this state change was caused by a popstate event (back button),
    // do not push/replace history again.
    if (isNavigatingBackRef.current) {
      isNavigatingBackRef.current = false;
      return;
    }

    // Define stages that should NOT create a new history entry (Transient states)
    const TRANSIENT_STAGES = [AppStage.LOADING_QUIZ, AppStage.ANALYZING];

    if (stage === AppStage.INTRO) {
       // Root state - usually we don't push here to avoid loop, 
       // but we could replace to ensure clean state if needed.
    } else if (TRANSIENT_STAGES.includes(stage)) {
       // Replace current entry for transient stages
       window.history.replaceState({ stage }, '');
    } else {
       // Push new entry for stable stages (Profile, Topics, Quiz, Results)
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
    // Replace the current history entry with root to "reset" the effective head of history
    window.history.replaceState({ stage: 'root' }, '', window.location.pathname);
  }, [stage]);

  return {
    stage,
    setStage,
    goHome,
    isNavigatingBackRef
  };
};