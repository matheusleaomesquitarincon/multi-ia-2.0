// O mapa das telas do site: endereço -> tela. Quem pode ver o quê é decidido no servidor, a cada pedido de dados; aqui
// só se escolhe o que mostrar com a resposta.

import { Route, Routes, useLocation } from "react-router";
import { SiteHeader } from "./components/SiteHeader.jsx";
import { SessionProvider } from "./lib/session.jsx";
import { ErrorBoundary } from "./pages/ErrorBoundary.jsx";
import { CadastroPage } from "./pages/CadastroPage.jsx";
import { ConvitePage } from "./pages/ConvitePage.jsx";
import { DonoPage } from "./pages/DonoPage.jsx";
import { EntrarPage } from "./pages/EntrarPage.jsx";
import { EsqueciSenhaPage } from "./pages/EsqueciSenhaPage.jsx";
import { HomePage } from "./pages/HomePage.jsx";
import NotFound from "./pages/NotFound.jsx";
import { RaioXPage } from "./pages/RaioXPage.jsx";
import { RecipeRedirectPage } from "./pages/RecipeRedirectPage.jsx";
import { TrabalhoPage } from "./pages/TrabalhoPage.jsx";
import { TrocarSenhaPage } from "./pages/TrocarSenhaPage.jsx";

export function App() {
  const location = useLocation();
  return (
    <SessionProvider>
      <SiteHeader />
      {/* A chave limpa o erro ao trocar de endereço. */}
      <ErrorBoundary key={location.pathname}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/entrar" element={<EntrarPage />} />
          <Route path="/esqueci-senha" element={<EsqueciSenhaPage />} />
          <Route path="/cadastro" element={<CadastroPage />} />
          <Route path="/convite/:token" element={<ConvitePage />} />
          <Route path="/trocar-senha" element={<TrocarSenhaPage />} />
          <Route path="/dono" element={<DonoPage />} />
          <Route path="/trabalho" element={<TrabalhoPage />} />
          <Route path="/raiox" element={<RaioXPage />} />
          <Route path="/recipes/:recipeId" element={<RecipeRedirectPage />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </ErrorBoundary>
    </SessionProvider>
  );
}
