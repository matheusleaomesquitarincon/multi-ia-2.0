// Só o dono logado recebe estes dados: o servidor manda os outros para a entrada ou para a página deles. Tudo é lido com
// a sessão do dono, e as contas do mês são feitas no banco (F48).

import { useMemo } from "react";
import { Navigate } from "react-router";
import { OwnerHome } from "../components/OwnerHome.jsx";
import { useView } from "../lib/useView.js";

export function DonoPage() {
  const { data, loading } = useView("/api/views/dono");
  const months = useMemo(() => new Map((data?.months ?? []).map((month) => [month.memberId, month])), [data]);

  if (loading) return null;
  if (data.redirect) return <Navigate to={data.redirect} replace />;
  return (
    <>
      <title>Painel do dono · Multi-IA</title>
      <OwnerHome
        me={data.me}
        team={data.team}
        credit={data.credit}
        months={months}
        statement={data.statement}
        agents={data.agents}
        demo={data.demo}
      />
    </>
  );
}
