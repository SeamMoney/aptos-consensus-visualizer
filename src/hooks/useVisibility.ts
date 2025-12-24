import { useEffect, useState, RefObject } from "react";

/**
 * Hook to detect if an element is visible in the viewport.
 * Used to pause canvas animations when components are off-screen.
 *
 * This provides massive performance gains by preventing
 * 25+ canvas animations from running continuously.
 */
export function useVisibility(ref: RefObject<HTMLElement | null>): boolean {
  const [isVisible, setIsVisible] = useState(true); // Default to true for SSR

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    // Start as visible if element is in initial viewport
    const rect = element.getBoundingClientRect();
    const initiallyVisible = rect.top < window.innerHeight && rect.bottom > 0;
    setIsVisible(initiallyVisible);

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsVisible(entry.isIntersecting);
      },
      {
        threshold: 0.05, // Trigger when 5% visible
        rootMargin: "50px" // Start animating slightly before visible
      }
    );

    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, [ref]);

  return isVisible;
}
