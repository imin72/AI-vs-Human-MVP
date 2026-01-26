import { useRef, useCallback } from 'react';

interface SwipeConfig {
  onSwipeRight?: () => void;
  onSwipeLeft?: () => void;
  threshold?: number;
  edgeOnly?: boolean;
}

export const useSwipeGesture = ({ 
  onSwipeRight, 
  onSwipeLeft, 
  threshold = 60, // Minimum distance
  edgeOnly = true 
}: SwipeConfig) => {
  const touchStartRef = useRef<{ x: number, y: number, time: number } | null>(null);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    // Only track single touch to avoid conflict with pinch-to-zoom
    if (e.targetTouches.length !== 1) return;
    
    touchStartRef.current = {
      x: e.targetTouches[0].clientX,
      y: e.targetTouches[0].clientY,
      time: Date.now()
    };
  }, []);

  const onTouchEnd = useCallback((e: React.TouchEvent) => {
    if (!touchStartRef.current) return;

    // Use changedTouches for the ended touch
    const touchEnd = {
      x: e.changedTouches[0].clientX,
      y: e.changedTouches[0].clientY,
      time: Date.now()
    };

    const deltaX = touchEnd.x - touchStartRef.current.x;
    const deltaY = touchEnd.y - touchStartRef.current.y;
    const duration = touchEnd.time - touchStartRef.current.time;

    // Logic:
    // 1. Must be fast enough (< 500ms) to distinguish from scroll
    // 2. Must be horizontal dominant (Abs(X) > Abs(Y) * 1.5)
    // 3. Must exceed threshold
    
    const isFast = duration < 500;
    const isHorizontal = Math.abs(deltaX) > Math.abs(deltaY) * 1.5;
    const isSignificant = Math.abs(deltaX) > threshold;

    if (isFast && isHorizontal && isSignificant) {
      // Swipe Right (Back Action)
      if (deltaX > 0 && onSwipeRight) {
        // Edge check: Start within 30px of left edge for iOS-like feel, 
        // preventing accidental swipes in the middle of content
        const isEdge = touchStartRef.current.x < 30;
        if (!edgeOnly || isEdge) {
            onSwipeRight();
        }
      } 
      // Swipe Left (Forward/Next Action - Optional)
      else if (deltaX < 0 && onSwipeLeft) {
        onSwipeLeft();
      }
    }

    touchStartRef.current = null;
  }, [onSwipeRight, onSwipeLeft, threshold, edgeOnly]);

  return { onTouchStart, onTouchEnd };
};