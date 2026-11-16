-- Teste da receita própria (F08) e da aba "Meu time": a execução de receita própria sempre guarda o time, a sessão não
-- lê esse time guardado, e o uso de cada dia soma só o que é da própria pessoa.
begin;
create extension if not exists pgtap with schema extensions;
select plan(10);

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
  ('00000000-0000-4000-8000-0000000008a1', 'f08.ana@example.com'),
  ('00000000-0000-4000-8000-0000000008a2', 'f08.bia@example.com');
insert into public.companies (id, name) values ('0000000c-0000-4000-8000-0000000008a0', 'Time Próprio Ltda');
insert into public.members (id, company_id, user_id, name, email, role, monthly_budget_cents, status)
values
  ('f0800000-0000-4000-8000-000000000001', '0000000c-0000-4000-8000-0000000008a0',
    '00000000-0000-4000-8000-0000000008a1', 'Ana', 'f08.ana@example.com', 'employee', null, 'active'),
  ('f0800000-0000-4000-8000-000000000002', '0000000c-0000-4000-8000-0000000008a0',
    '00000000-0000-4000-8000-0000000008a2', 'Bia', 'f08.bia@example.com', 'employee', null, 'active');
select private.wallet_topup('0000000c-0000-4000-8000-0000000008a0', 5000, 'Pix de teste');

-- ---------- O time guardado na execução ----------
select throws_ok(
  $$ insert into public.runs (company_id, member_id, recipe_id, request)
     values ('0000000c-0000-4000-8000-0000000008a0', 'f0800000-0000-4000-8000-000000000001',
       'custom:11111111-1111-4111-8111-111111111111', 'x') $$,
  '23514', null,
  'Execução de receita própria sem o time guardado é recusada'
);
select throws_ok(
  $$ insert into public.runs (company_id, member_id, recipe_id, request, custom_recipe)
     values ('0000000c-0000-4000-8000-0000000008a0', 'f0800000-0000-4000-8000-000000000001',
       'create-site', 'x', '{"name": "x"}') $$,
  '23514', null,
  'Receita pronta não guarda time de receita própria'
);
insert into public.runs (id, company_id, member_id, recipe_id, request, status, custom_recipe)
values ('f0800000-0000-4000-8000-0000000000a1', '0000000c-0000-4000-8000-0000000008a0',
  'f0800000-0000-4000-8000-000000000001', 'custom:11111111-1111-4111-8111-111111111111', 'x', 'running',
  '{"id": "11111111-1111-4111-8111-111111111111", "form": {"name": "Meu time"}}');
select is(
  (select custom_recipe ->> 'id' from public.runs where id = 'f0800000-0000-4000-8000-0000000000a1'),
  '11111111-1111-4111-8111-111111111111',
  'Com o time guardado, a execução de receita própria entra'
);

-- ---------- Gastos de hoje: Ana, uma receita (2 etapas) e uma mensagem do chat ----------
set local role service_role;
select set_config('tests.h1',
  public.wallet_reserve('f0800000-0000-4000-8000-000000000001', 500, 'f0800000-0000-4000-8000-0000000000a1')::text, true);
select public.wallet_charge(current_setting('tests.h1')::uuid, 30, 'Receita própria · Etapa 1', 'claude', null, null, 0);
select public.wallet_charge(current_setting('tests.h1')::uuid, 20, 'Receita própria · Etapa 2', 'gpt', null, null, 1);
select set_config('tests.h2', public.wallet_reserve('f0800000-0000-4000-8000-000000000001', 100, null,
  '22222222-2222-4222-8222-222222222222')::text, true);
select public.wallet_charge(current_setting('tests.h2')::uuid, 7, 'Tarefa rápida · Resposta', 'gemini',
  null, '22222222-2222-4222-8222-222222222222');
reset role;

select tests.login_as('00000000-0000-4000-8000-0000000008a1');

select throws_ok(
  $$ select custom_recipe from public.runs $$,
  '42501', null,
  'A sessão não lê o time guardado na execução (só o servidor)'
);

select is(
  (select count(*) from public.my_daily_spending(14))::integer, 14,
  'Uma linha para cada um dos últimos 14 dias, inclusive os sem gasto'
);
select results_eq(
  $$ select spent_cents, tasks from public.my_daily_spending(14)
     where day = (now() at time zone 'America/Sao_Paulo')::date $$,
  $$ values (57::bigint, 2) $$,
  'Hoje: R$ 0,57 em duas tarefas (a receita conta uma vez só)'
);
select is(
  (select sum(spent_cents) from public.my_daily_spending(14)
   where day < (now() at time zone 'America/Sao_Paulo')::date)::bigint, 0::bigint,
  'Os dias sem gasto vêm zerados'
);
select is((select count(*) from public.my_daily_spending(0))::integer, 1, 'Pedir menos de 1 dia vale 1 dia');
select is((select count(*) from public.my_daily_spending(999))::integer, 60, 'No máximo 60 dias');
reset role;

select tests.login_as('00000000-0000-4000-8000-0000000008a2');
select is(
  (select sum(spent_cents) from public.my_daily_spending(14))::bigint, 0::bigint,
  'A colega da mesma empresa não soma o gasto da Ana'
);
reset role;

select * from finish();
rollback;
