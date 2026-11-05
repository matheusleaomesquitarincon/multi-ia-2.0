// Faz um bloco surgir suavemente quando entra na tela, uma vez só. Para quem pediu menos movimento no sistema, ou em
// navegadores sem o recurso, o bloco aparece direto (Reveal.module.css).

import { useEffect, useRef } from "react";
import styles from "./Reveal.module.css";

/**
 * @param {{ as?: React.ElementType, delay?: number, className?: string, children: React.ReactNode }} props
 */
export function Reveal({ as: Tag = "div", delay = 0, className = "", children, ...rest }) {
  const ref = useRef(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return undefined;
    if (!("IntersectionObserver" in window)) {
      element.classList.add(styles.shown);
      return undefined;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        element.classList.add(styles.shown);
        observer.disconnect();
      },
      { threshold: 0.08 },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return (
    <Tag
      ref={ref}
      className={`${styles.reveal} ${className}`}
      // O atraso vem da posição do bloco na sequência, não de um token.
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
      {...rest}
    >
      {children}
    </Tag>
  );
}
