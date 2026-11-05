// Os atalhos do dono no topo do site: o painel dele e o espaço de trabalho (onde ele também usa as IAs). O da página
// aberta fica marcado. O funcionário não vê: ele só tem o espaço de trabalho.

import { Link, useLocation } from "react-router";
import styles from "./OwnerNav.module.css";

const LINKS = [
  { href: "/dono", label: "Painel do dono" },
  { href: "/trabalho", label: "Trabalho" },
];

export function OwnerNav() {
  const { pathname } = useLocation();
  return (
    <nav aria-label="Áreas do dono">
      <ul className={styles.links}>
        {LINKS.map((link) => (
          <li key={link.href}>
            <Link to={link.href} className={styles.link} aria-current={pathname === link.href ? "page" : undefined}>
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
