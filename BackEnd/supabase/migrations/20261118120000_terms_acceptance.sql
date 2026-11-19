-- Aceite dos termos de uso e da política de privacidade (F05, LGPD).
--
-- Cada pessoa guarda a versão dos termos que aceitou e quando. O dono aceita no cadastro da empresa; o funcionário, ao
-- criar a própria senha (no convite ou no primeiro acesso). Quando a versão mudar (TERMS_VERSION, em lib/auth/forms.js),
-- quem aceitou a antiga é chamado a aceitar de novo. Só o servidor (chave-mestra) grava: a sessão de quem está logado
-- lê a própria linha, mas não muda essas colunas (nem o dono muda a de um funcionário).

alter table public.members
  add column terms_version text check (terms_version is null or char_length(terms_version) between 1 and 40),
  add column terms_accepted_at timestamptz,
  add constraint members_terms_together check ((terms_version is null) = (terms_accepted_at is null));

grant update (terms_version, terms_accepted_at) on table public.members to service_role;
