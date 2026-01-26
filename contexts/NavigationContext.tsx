import React, { createContext, useContext, useState, useEffect, useRef, useCallback, ReactNode } from 'react';
import { AppStage } from '../types';
import { audioHaptic } from '../services/audioHapticService';

interface NavigationContextType {
  stage: AppStage;
  setStage: (stage: AppStage) => void;
  goHome: (confirmMsg: string, onConfirmAction?: () => void) => void;
  isNavigatingBackRef: React.MutableRefObject<boolean>;
}

const NavigationContext = createContext<NavigationContextType | undefined>(undefined);

export const NavigationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
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
       // Root state - usually we don't push here to avoid loop
       // Ensure we are at root state logic if needed, but typically replaceState handled in goHome
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
    
    // IMPORTANT: Set flag to prevent useEffect from pushing a new 'INTRO' state on top
    // We want to reset the stack effectively.
    isNavigatingBackRef.current = true;
    setStage(AppStage.INTRO); 
    
    // Reset history stack to root
    window.history.replaceState({ stage: 'root' }, '', window.location.pathname);
  }, [stage]);

  return (
    <NavigationContext.Provider value={{ stage, setStage, goHome, isNavigatingBackRef }}>
      {children}
    </NavigationContext.Provider>
  );
};

export const useNavigationContext = () => {
  const context = useContext(NavigationContext);
  if (!context) {
    throw new Error('useNavigationContext must be used within a NavigationProvider');
  }
  return context;
};