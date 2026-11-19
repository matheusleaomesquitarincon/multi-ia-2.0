-- Teste do painel interno da plataforma: só quem está na equipe (platform_staff) vê as empresas, recarrega e muda o
-- câmbio; dono e funcionário de uma empresa são recusados pelo próprio banco; a recarga cai no extrato e no registro.
begin;
create extension if not exists pgtap with schema extensions;
select plan(17);

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
  ('00000000-0000-4000-8000-0000000010a1', 'plat.equipe@example.com'),
  ('00000000-0000-4000-8000-0000000010a2', 'plat.dona@example.com'),
  ('00000000-0000-4000-8000-0000000010a3', 'plat.ana@example.com');
insert into public.platform_staff (user_id, name) values ('00000000-0000-4000-8000-0000000010a1', 'Equipe Teste');
insert into public.companies (id, name) values ('0000000c-0000-4000-8000-0000000010a0', 'Plataforma Ltda');
insert into public.members (id, company_id, user_id, name, email, role, monthly_budget_cents, status)
values
  ('f1000000-0000-4000-8000-000000000001', '0000000c-0000-4000-8000-0000000010a0',
    '00000000-0000-4000-8000-0000000010a2', 'Dona', 'plat.dona@example.com', 'owner', null, 'active'),
  ('f1000000-0000-4000-8000-000000000002', '0000000c-0000-4000-8000-0000000010a0',
    '00000000-0000-4000-8000-0000000010a3', 'Ana', 'plat.ana@example.com', 'employee', null, 'active');
insert into public.ai_calls (company_id, member_id, provider, model, cost_usd, usd_brl, charged, status)
values
  ('0000000c-0000-4000-8000-0000000010a0', 'f1000000-0000-4000-8000-000000000002', 'claude', 'm', 1, 5.5, true, 'ok'),
  ('0000000c-0000-4000-8000-0000000010a0', 'f1000000-0000-4000-8000-000000000002', 'gpt', 'm', 0.2, 5.5, false, 'error');

-- ---------- Dona e funcionária são recusadas ----------
select tests.login_as('00000000-0000-4000-8000-0000000010a2');
select is(public.platform_is_staff(), false, 'A dona de uma empresa não é da equipe');
select throws_ok($$ select * from public.platform_companies() $$, '42501', 'not_staff', 'A dona não vê as empresas');
select throws_ok($$ select public.platform_topup('0000000c-0000-4000-8000-0000000010a0', 100000, 'Pix') $$,
  '42501', 'not_staff', 'A dona não recarrega a própria empresa pelo painel');
select throws_ok($$ select public.platform_set_usd_to_brl(1) $$, '42501', 'not_staff', 'A dona não muda o câmbio');
reset role;

select tests.login_as('00000000-0000-4000-8000-0000000010a3');
select throws_ok($$ select * from public.platform_costs(now() - interval '1 day', now() + interval '1 day') $$,
  '42501', 'not_staff', 'A funcionária não vê o custo das IAs');
select throws_ok($$ select * from public.platform_credit_entries(10) $$, '42501', 'not_staff',
  'A funcionária não vê o extrato de recargas');
select throws_ok($$ select * from public.platform_staff $$, '42501', null, 'Ninguém logado lê a lista da equipe direto');
select throws_ok($$ insert into public.platform_staff (user_id, name) values ('00000000-0000-4000-8000-0000000010a3', 'Eu') $$,
  '42501', null, 'Ninguém logado se coloca na equipe');
reset role;

-- ---------- A equipe ----------
select tests.login_as('00000000-0000-4000-8000-0000000010a1');
select is(public.platform_is_staff(), true, 'Quem está na equipe é reconhecido');
select throws_ok($$ select public.platform_topup('0000000c-0000-4000-8000-0000000010a0', 10000001, 'Pix') $$,
  'P0001', 'invalid_amount', 'Recarga acima de R$ 100.000,00 é recusada');
select throws_ok($$ select public.platform_topup('0000000c-0000-4000-8000-0000000010a0', 1000, '  ') $$,
  'P0001', 'invalid_description', 'Recarga sem descrição é recusada');
select is(public.platform_topup('0000000c-0000-4000-8000-0000000010a0', 20000, 'Pix de 18/11'), 20000::bigint,
  'A recarga devolve o saldo novo');
select results_eq(
  $$ select company_name, balance_cents, available_cents, owner_name, active_members
     from public.platform_companies() where company_id = '0000000c-0000-4000-8000-0000000010a0' $$,
  $$ values ('Plataforma Ltda'::text, 20000::bigint, 20000::bigint, 'Dona'::text, 2) $$,
  'A lista de empresas mostra o saldo, o dono e as pessoas ativas'
);
select results_eq(
  $$ select calls, failed_calls, cost_cents, failed_cost_cents
     from public.platform_costs(now() - interval '1 day', now() + interval '1 day')
     where company_id = '0000000c-0000-4000-8000-0000000010a0' $$,
  $$ values (2, 1, 660::bigint, 110::bigint) $$,
  'O custo real soma as chamadas no câmbio de cada uma, separando as que falharam'
);
select is(public.platform_set_usd_to_brl(5.65), 5.65::numeric, 'A equipe muda o câmbio');
select throws_ok($$ select public.platform_set_usd_to_brl(0.5) $$, 'P0001', 'invalid_rate', 'Câmbio fora de R$ 1 a R$ 20 é recusado');
reset role;

select results_eq(
  $$ select action, staff_name from public.platform_log
     where staff_user_id = '00000000-0000-4000-8000-0000000010a1' order by id $$,
  $$ values ('topup'::text, 'Equipe Teste'::text), ('exchange'::text, 'Equipe Teste'::text) $$,
  'O registro guarda quem recarregou e quem mudou o câmbio'
);

select * from finish();
rollback;
