-- E-mail do funcionário conferido (F32, parte 1).
--
-- O dono cria o login do funcionário com uma senha temporária, e o e-mail digitado vira o login sem prova de que é da
-- pessoa. Agora a pessoa pode confirmar: pede um código de 6 dígitos, que chega no e-mail dela, e digita na tela
-- (lib/auth/email-check.js). email_verified_at guarda quando. O dono vê no painel quem já confirmou.
-- O dono da empresa já confirma o e-mail no cadastro (o link do e-mail de confirmação), então os donos que já existem
-- entram como confirmados, na data em que o Supabase confirmou.
-- Só o servidor (chave-mestra) grava: a sessão lê, mas não marca a própria linha nem a de outra pessoa.

alter table public.members add column email_verified_at timestamptz;

update public.members m
set email_verified_at = u.email_confirmed_at
from auth.users u
where u.id = m.user_id and m.role = 'owner' and u.email_confirmed_at is not null;

grant update (email_verified_at) on table public.members to service_role;
