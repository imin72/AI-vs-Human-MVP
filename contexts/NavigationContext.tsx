
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
    // Ensure we start with a clean state on load
    window.history.replaceState({ stage: 'root' }, '');
    
    // Prevent browser scroll restoration causing visual jumps
    if ('scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual';
    }
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
       // When hitting Intro, we want to establish it as a stable point
       // But we manage the 'clearing' logic inside goHome mostly
    } else if (TRANSIENT_STAGES.includes(stage)) {
       window.history.replaceState({ stage }, '');
    } else {
       // Only push if we are NOT coming from a back nav
       // (Back navs are handled by the popstate event itself popping the stack)
       if (!isNavigatingBackRef.current) {
          window.history.pushState({ stage }, '');
       }
    }
  }, [stage]);

  const goHome = useCallback((confirmMsg: string, onConfirmAction?: () => void) => {
    try { audioHaptic.playClick(); } catch {}
    
    const needsConfirmation = stage === AppStage.QUIZ || stage === AppStage.LOADING_QUIZ || stage === AppStage.ANALYZING;

    if (needsConfirmation) {
      if (!window.confirm(confirmMsg)) return;
    }
    
    if (onConfirmAction) onConfirmAction();
    
    // UX FIX: Treat "Home" as a back navigation visually to prevent "fade-in" flicker
    isNavigatingBackRef.current = true;
    setIsBackNav(true); 
    
    setStage(AppStage.INTRO); 
    
    // HISTORY FIX: Replace the current entry with Root/Intro instead of pushing.
    // This effectively "resets" the forward history from this point.
    window.history.replaceState({ stage: 'root' }, '', window.location.pathname);
    
    setTimeout(() => setIsBackNav(false), 500);
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
