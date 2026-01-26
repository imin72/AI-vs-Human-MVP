import React, { createContext, useContext, useState, useEffect, useRef, useCallback, ReactNode } from 'react';
import { AppStage } from '../types';
import { audioHaptic } from '../services/audioHapticService';

interface NavigationContextType {
  stage: AppStage;
  setStage: (stage: AppStage) => void;
  goHome: (confirmMsg: string, onConfirmAction?: () => void) => void;
  isNavigatingBackRef: React.MutableRefObject<boolean>;
  isBackNav: boolean; // New exposed state
}

const NavigationContext = createContext<NavigationContextType | undefined>(undefined);

export const NavigationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [stage, setStage] = useState<AppStage>(AppStage.INTRO);
  const [isBackNav, setIsBackNav] = useState(false); // State to trigger re-renders without animation
  const isNavigatingBackRef = useRef(false);

  // Initialize history
  useEffect(() => {
    window.history.replaceState({ stage: 'root' }, '');
  }, []);

  // Sync state with history
  useEffect(() => {
    // Check if this render is due to a back navigation
    if (isNavigatingBackRef.current) {
      setIsBackNav(true);
      isNavigatingBackRef.current = false;
      
      // Reset back nav flag after a short delay to allow forward navs to animate again
      // The delay ensures the current render cycle picks up 'true'
      setTimeout(() => setIsBackNav(false), 500); 
      return;
    } else {
      // Normal forward navigation
      setIsBackNav(false);
    }

    // Define stages that should NOT create a new history entry (Transient states)
    const TRANSIENT_STAGES = [AppStage.LOADING_QUIZ, AppStage.ANALYZING];

    if (stage === AppStage.INTRO) {
       // Root state
    } else if (TRANSIENT_STAGES.includes(stage)) {
       window.history.replaceState({ stage }, '');
    } else {
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
    
    // Explicitly handle "Home" as a reset, often similar to back navigation in feel
    // But we force animation reset here too just in case
    isNavigatingBackRef.current = true;
    setStage(AppStage.INTRO); 
    
    // Reset history stack to root
    window.history.replaceState({ stage: 'root' }, '', window.location.pathname);
  }, [stage]);

  return (
    <NavigationContext.Provider value={{ stage, setStage, goHome, isNavigatingBackRef, isBackNav }}>
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