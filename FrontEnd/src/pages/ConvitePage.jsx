import { useParams } from "react-router";
import { AcceptInviteForm } from "../components/AcceptInviteForm.jsx";
import { InviteProblem } from "../components/InviteProblem.jsx";
import { useView } from "../lib/useView.js";

// Abrir esta página só mostra o convite; quem gasta o convite é o botão. O título é genérico de propósito. O código do
// convite está no endereço, então o BackEnd entrega esta página com os cabeçalhos que o protegem (src/app.js).
export function ConvitePage() {
  const { token } = useParams();
  const { data, loading } = useView(`/api/views/convite/${encodeURIComponent(token)}`);
  if (loading) return null;

  return (
    <>
      <title>Convite para a equipe · Multi-IA</title>
      <meta name="referrer" content="no-referrer" />
      <meta name="robots" content="noindex, nofollow" />
      {data.status !== "valid" ? (
        <InviteProblem kind={data.status} />
      ) : (
        <AcceptInviteForm
          token={token}
          kind={data.kind}
          name={data.name}
          email={data.email}
          companyName={data.companyName}
          deadline={data.deadline}
          signedInAs={data.signedInAs}
        />
      )}
    </>
  );
}
