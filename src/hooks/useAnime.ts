import { useEffect, useRef } from 'react';
// @ts-ignore
import anime from 'animejs';

interface UseAnimeProps {
  targets?: anime.AnimeParams['targets'];
  animation: Omit<anime.AnimeParams, 'targets'>;
  shouldAnimate?: boolean;
}

/**
 * A handy hook for applying anime.js animations to React components.
 * Returns a ref to attach to the target element if no external targets string/nodelist is provided.
 */
export function useAnime<T extends HTMLElement | SVGElement = HTMLDivElement>({
  targets,
  animation,
  shouldAnimate = true,
}: UseAnimeProps) {
  const ref = useRef<T>(null);
  const animationRef = useRef<anime.AnimeInstance | null>(null);

  useEffect(() => {
    if (!shouldAnimate) return;

    // Use external targets if provided, otherwise default to the ref
    const targetElements = targets || ref.current;
    
    if (!targetElements) return;

    animationRef.current = anime({
      targets: targetElements,
      ...animation,
    });

    return () => {
      // Cleanup animation if component unmounts
      if (animationRef.current) {
        anime.remove(targetElements);
      }
    };
  }, [targets, shouldAnimate, animation]);

  return { ref, animation: animationRef };
}
