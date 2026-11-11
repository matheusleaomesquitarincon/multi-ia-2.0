import { Link } from "react-router";
import { signOut } from "../lib/actions.js";
import { useSession } from "../lib/session.jsx";
import { DemoSwitcher } from "./DemoSwitcher.jsx";
import { OwnerNav } from "./OwnerNav.jsx";
import styles from "./SiteHeader.module.css";

// Topo do site: o logo, que volta para a entrada, e, para quem está logado, quem é e o botão "Sair". O dono ganha os
// atalhos entre o painel dele e o espaço de trabalho.
export function SiteHeader() {
  const { viewer, demo } = useSession();

  return (
    <>
      <header className={styles.header}>
        <div className={styles.inner}>
          <Link to="/" className={styles.logo}>
            OCK
          </Link>
          {viewer.status === "signed-out" && (
            <nav className={styles.publicNav} aria-label="Página inicial">
              <a href="/#como-funciona" className={styles.navLink}>
                Como funciona
              </a>
              <a href="/#receitas" className={styles.navLink}>
                Receitas
              </a>
              <a href="/#duvidas" className={styles.navLink}>
                Dúvidas
              </a>
              <Link to="/entrar" className={styles.navLink}>
                Entrar
              </Link>
              <Link to="/cadastro" className={styles.navCta}>
                Criar conta
              </Link>
            </nav>
          )}
          {viewer.status === "member" && viewer.member.role === "owner" && (
            <div className={styles.nav}>
              <OwnerNav />
            </div>
          )}
          {viewer.status !== "signed-out" && (
            <div className={styles.account}>
              {viewer.status === "member" && (
                <p className={styles.who}>
                  <span className={styles.name}>{viewer.member.name}</span>
                  <span className={styles.company}>{viewer.member.companyName}</span>
                </p>
              )}
              <form action={signOut}>
                <button type="submit" className={styles.signOut}>
                  Sair
                </button>
              </form>
            </div>
          )}
        </div>
      </header>
      {demo && <DemoSwitcher />}
    </>
  );
}
