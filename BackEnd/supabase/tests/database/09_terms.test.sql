-- Teste do aceite dos termos (F05) e da marca de e-mail confirmado (F32): a pessoa lê o próprio aceite, mas só o servidor grava; o dono não muda o aceite
-- de um funcionário; e versão e data andam juntas.
begin;
create extension if not exists pgtap with schema extensions;
select plan(8);

create schema tests;
create function tests.login_as(p_user uuid) returns void language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
end;
$$;
grant usage on schema tests to authenticated, service_role;
grant execute on all functions in schema tests to authenticated, service_role;

insert into auth.users (id, email)
values
  ('00000000-0000-4000-8000-0000000009a1', 'f05.dona@example.com'),
  ('00000000-0000-4000-8000-0000000009a2', 'f05.ana@example.com');
insert into public.companies (id, name) values ('0000000c-0000-4000-8000-0000000009a0', 'Termos Ltda');
insert into public.members (id, company_id, user_id, name, email, role, status)
values
  ('f0500000-0000-4000-8000-000000000001', '0000000c-0000-4000-8000-0000000009a0',
    '00000000-0000-4000-8000-0000000009a1', 'Dona', 'f05.dona@example.com', 'owner', 'active'),
  ('f0500000-0000-4000-8000-000000000002', '0000000c-0000-4000-8000-0000000009a0',
    '00000000-0000-4000-8000-0000000009a2', 'Ana', 'f05.ana@example.com', 'employee', 'active');

select throws_ok(
  $$ update public.members set terms_version = '2026-11-18' where id = 'f0500000-0000-4000-8000-000000000002' $$,
  '23514', null,
  'Versão sem data do aceite é recusada'
);

-- ---------- A sessão lê, mas não grava ----------
select tests.login_as('00000000-0000-4000-8000-0000000009a2');
select is(
  (select terms_version from public.members where id = 'f0500000-0000-4000-8000-000000000002'),
  null,
  'A funcionária lê o próprio aceite (ainda em branco)'
);
select throws_ok(
  $$ update public.members set terms_version = '2026-11-18', terms_accepted_at = now()
     where id = 'f0500000-0000-4000-8000-000000000002' $$,
  '42501', null,
  'A funcionária não grava o próprio aceite pela sessão'
);
select throws_ok(
  $$ update public.members set email_verified_at = now() where id = 'f0500000-0000-4000-8000-000000000002' $$,
  '42501', null,
  'A funcionária não marca o próprio e-mail como confirmado pela sessão (F32)'
);
reset role;

select tests.login_as('00000000-0000-4000-8000-0000000009a1');
select throws_ok(
  $$ update public.members set terms_version = '2026-11-18', terms_accepted_at = now()
     where id = 'f0500000-0000-4000-8000-000000000002' $$,
  '42501', null,
  'A dona não grava o aceite de uma funcionária'
);
reset role;

-- ---------- O servidor grava ----------
set local role service_role;
select lives_ok(
  $$ update public.members set terms_version = '2026-11-18', terms_accepted_at = now()
     where id = 'f0500000-0000-4000-8000-000000000002' $$,
  'O servidor grava o aceite'
);
reset role;
select is(
  (select terms_version from public.members where id = 'f0500000-0000-4000-8000-000000000002'),
  '2026-11-18',
  'O aceite ficou guardado'
);
set local role service_role;
select lives_ok(
  $$ update public.members set email_verified_at = now() where id = 'f0500000-0000-4000-8000-000000000002' $$,
  'O servidor marca o e-mail como confirmado (F32)'
);
reset role;

select * from finish();
rollback;
