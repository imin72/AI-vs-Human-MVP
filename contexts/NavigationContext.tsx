
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
    // Prevent browser scroll restoration causing visual jumps
    if ('scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual';
    }

    // Initialize History Stack for "Exit Guard"
    // If there is no state (fresh load), we create a guard entry + the intro entry.
    // This ensures that hitting "Back" from the start will fire a popstate event we can capture.
    if (!window.history.state || !window.history.state.stage) {
       // Replace current (blank) with a Guard
       window.history.replaceState({ type: 'EXIT_GUARD' }, '');
       // Push the actual App Start
       window.history.pushState({ stage: AppStage.INTRO }, '');
    }
  }, []);

  // Sync state with history
  useEffect(() => {
    // Check if this render is due to a back navigation
    if (isNavigatingBackRef.current) {
      setIsBackNav(true);
      isNavigatingBackRef.current = false;
      
      // Reset back nav flag after a short delay to allow forward navs to animate again
      setTimeout(() => setIsBackNav(false), 500); 
      return;
    } else {
      // Normal forward navigation
      setIsBackNav(false);
    }

    // Define stages that should NOT create a new history entry (Transient states)
    const TRANSIENT_STAGES = [AppStage.LOADING_QUIZ, AppStage.ANALYZING];

    if (stage === AppStage.INTRO) {
       // Intro is handled explicitly in init or goHome
    } else if (TRANSIENT_STAGES.includes(stage)) {
       window.history.replaceState({ stage }, '');
    } else {
       // Only push if we are NOT coming from a back nav
       // (Back navs are handled by the popstate event itself popping the stack)
       if (!isNavigatingBackRef.current) {
          // Check if we are already at this stage to prevent dupes (optional, but good for safety)
          if (window.history.state?.stage !== stage) {
             window.history.pushState({ stage }, '');
          }
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
    
    // Treat Home as a "New Start" or Back depending on UX preference.
    // To satisfy "Reset History" visually, we treat it as a Back nav visual 
    // but we PUSH state so that 'Back' from Intro triggers our Exit Logic.
    isNavigatingBackRef.current = true;
    setIsBackNav(true); 
    
    setStage(AppStage.INTRO); 
    
    // PUSH INTRO to the top.
    // This effectively "buries" the previous session.
    // When user hits "Back", our popstate handler in useGameViewModel will trigger.
    // It will ask "Exit?", and if Yes, it will recursively rewind this stack.
    window.history.pushState({ stage: AppStage.INTRO }, '', window.location.pathname);
    
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
