-- Teste das quedas raras na hora de cobrar (F43): cada etapa vira uma linha de gasto só, a etapa concluída é cobrada
-- mesmo com a reserva recém-fechada, e as reservas de execuções e mensagens que terminaram são fechadas pela limpeza.
begin;
create extension if not exists pgtap with schema extensions;
select plan(13);

-- Uma empresa com R$ 20,00 e uma funcionária sem teto.
insert into public.companies (id, name) values ('0000000c-0000-4000-8000-0000000000f4', 'Cobrança Única Ltda');
insert into public.members (id, company_id, name, email, role, monthly_budget_cents, status)
values ('f4000000-0000-4000-8000-000000000001', '0000000c-0000-4000-8000-0000000000f4', 'Funcionária',
  'f43@example.com', 'employee', null, 'active');
select private.wallet_topup('0000000c-0000-4000-8000-0000000000f4', 2000, 'Pix de teste');

-- Execuções: 1 terminou, 2 foi cancelada mas um servidor ainda a roda (reserva de quem roda no prazo), 3 está rodando.
insert into public.runs (id, company_id, member_id, recipe_id, request, status, lease_until)
values
  ('f4000000-0000-4000-8000-0000000000a1', '0000000c-0000-4000-8000-0000000000f4',
    'f4000000-0000-4000-8000-000000000001', 'create-site', 'x', 'cancelled', null),
  ('f4000000-0000-4000-8000-0000000000a2', '0000000c-0000-4000-8000-0000000000f4',
    'f4000000-0000-4000-8000-000000000001', 'create-site', 'x', 'cancelled', now() + interval '1 minute'),
  ('f4000000-0000-4000-8000-0000000000a3', '0000000c-0000-4000-8000-0000000000f4',
    'f4000000-0000-4000-8000-000000000001', 'create-site', 'x', 'running', now() + interval '1 minute');

set local role service_role;

select set_config('tests.h1',
  public.wallet_reserve('f4000000-0000-4000-8000-000000000001', 500, 'f4000000-0000-4000-8000-0000000000a1')::text, true);
select set_config('tests.h2',
  public.wallet_reserve('f4000000-0000-4000-8000-000000000001', 300, 'f4000000-0000-4000-8000-0000000000a2')::text, true);
select set_config('tests.h3',
  public.wallet_reserve('f4000000-0000-4000-8000-000000000001', 200, 'f4000000-0000-4000-8000-0000000000a3')::text, true);

-- 1. Uma linha por etapa.
select is(public.wallet_charge(current_setting('tests.h1')::uuid, 100, 'Criar um site · Chefe', 'claude', null, null, 0),
  400::bigint, 'A etapa 0 é cobrada');
select throws_ok(
  $$ select public.wallet_charge(current_setting('tests.h1')::uuid, 100, 'Criar um site · Chefe', 'claude', null, null, 0) $$,
  'P0001', 'step_already_charged', 'A mesma etapa não é cobrada duas vezes');
select is(public.wallet_charge(current_setting('tests.h1')::uuid, 50, 'Criar um site · Front-end', 'gpt', null, null, 1),
  350::bigint, 'A etapa seguinte é cobrada normalmente');
select is(
  (select count(*)::int from public.wallet_entries where run_id = 'f4000000-0000-4000-8000-0000000000a1'), 2,
  'Duas etapas, duas linhas no extrato');
select throws_ok(
  $$ insert into public.wallet_entries (company_id, kind, amount_cents, member_id, hold_id, run_id, description, step_seq)
     values ('0000000c-0000-4000-8000-0000000000f4', 'charge', -1, 'f4000000-0000-4000-8000-000000000001',
       current_setting('tests.h1')::uuid, 'f4000000-0000-4000-8000-0000000000a1', 'x', 0) $$,
  '42501', null, 'Nem o servidor grava direto no extrato para contornar a regra');

-- 2. Etapa concluída é cobrada mesmo com a reserva fechada; o chat (sem número) continua recusado.
select public.wallet_close_hold(current_setting('tests.h1')::uuid);
select is(public.wallet_charge(current_setting('tests.h1')::uuid, 30, 'Criar um site · Back-end', 'claude', null, null, 2),
  320::bigint, 'Com a reserva recém-fechada, a etapa concluída é cobrada assim mesmo');
select throws_ok(
  $$ select public.wallet_charge(current_setting('tests.h1')::uuid, 30, 'Criar um site · Back-end', 'claude', null, null, 2) $$,
  'P0001', 'step_already_charged', 'E continua uma vez só');
select throws_ok($$ select public.wallet_charge(current_setting('tests.h1')::uuid, 1, 'Tarefa rápida · Resposta') $$,
  'P0001', 'hold_closed', 'Sem número de etapa, reserva fechada não aceita cobrança');
select is((select charged_cents from public.wallet_holds where id = current_setting('tests.h1')::uuid), 180::bigint,
  'A reserva registra tudo o que foi cobrado nela');

-- 3. A limpeza fecha só a reserva da execução que terminou e que ninguém roda.
select set_config('tests.h4',
  public.wallet_reserve('f4000000-0000-4000-8000-000000000001', 100, 'f4000000-0000-4000-8000-0000000000a1')::text, true);
select is(public.wallet_close_stale_holds(), 1, 'Fecha uma reserva esquecida');
select is(
  (select array_agg(status order by amount_cents) from public.wallet_holds
   where id in (current_setting('tests.h2')::uuid, current_setting('tests.h3')::uuid, current_setting('tests.h4')::uuid)),
  array['closed', 'open', 'open'],
  'Fecha a da execução terminada; deixa a que ainda está sendo rodada e a que está rodando'
);
select is(public.wallet_close_stale_holds(), 0, 'Rodar de novo não fecha mais nada');

reset role;
select ok(
  not has_function_privilege('authenticated', 'public.wallet_close_stale_holds()', 'EXECUTE')
    and not has_function_privilege('anon', 'public.wallet_close_stale_holds()', 'EXECUTE'),
  'Quem está logado (ou não) não chama a limpeza');

select * from finish();
rollback;
