// Segura qualquer erro ao montar uma tela (ex.: o banco não respondeu) e mostra a página de erro em português. A mensagem
// técnica fica no registro; a tela só pede para tentar de novo.

import { Component } from "react";
import ErrorPage from "./ErrorPage.jsx";

export class ErrorBoundary extends Component {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error) {
    console.error(error);
  }

  render() {
    if (this.state.failed) return <ErrorPage retry={() => window.location.reload()} />;
    return this.props.children;
  }
}
