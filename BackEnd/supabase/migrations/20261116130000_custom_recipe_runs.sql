-- Receita própria (F08) e a aba "Meu time".
--
-- 1. A execução de uma receita própria guarda o time como estava ao começar (nome, membros, IAs e o que cada um faz).
--    Editar ou apagar o time depois não muda uma execução que já está rodando nem a que já terminou. A coluna é só do
--    servidor: a sessão não ganha leitura dela (as colunas que a sessão lê de runs estão listadas na migração do trabalho).
-- 2. O uso de cada dia da própria pessoa, para o gráfico da aba "Meu time": quanto gastou e quantas tarefas e receitas
--    fez em cada um dos últimos dias, no horário de Brasília. Roda com o login de quem chama (security invoker) e só
--    soma o que é dela, como as contas do mês (migração de 25/10/2026).

alter table public.runs
  add column custom_recipe jsonb
    check (custom_recipe is null or (jsonb_typeof(custom_recipe) = 'object' and octet_length(custom_recipe::text) <= 65536));

-- Execução de receita própria: recipe_id é "custom:<id do time>" e o time fica guardado na própria execução.
alter table public.runs
  add constraint runs_custom_recipe_snapshot
    check ((recipe_id like 'custom:%') = (custom_recipe is not null));

create function public.my_daily_spending(p_days integer default 14)
returns table (
  day date,
  spent_cents bigint,
  -- Quantas tarefas do chat e execuções de receita tiveram gasto naquele dia.
  tasks integer
)
language sql
stable
security invoker
set search_path = ''
as $$
  with days as (
    select generate_series(
      (now() at time zone 'America/Sao_Paulo')::date - (least(greatest(p_days, 1), 60) - 1),
      (now() at time zone 'America/Sao_Paulo')::date,
      interval '1 day'
    )::date as day
  ),
  own as (
    select (e.created_at at time zone 'America/Sao_Paulo')::date as day, e.amount_cents, coalesce(e.run_id, e.task_id) as work_id
    from public.wallet_entries e
    where e.kind = 'charge'
      and e.member_id = (select private.current_member_id())
      and e.created_at >= now() - make_interval(days => least(greatest(p_days, 1), 60) + 1)
  )
  select d.day,
    coalesce(sum(-o.amount_cents), 0)::bigint as spent_cents,
    count(distinct o.work_id)::integer as tasks
  from days d
  left join own o on o.day = d.day
  group by d.day
  order by d.day;
$$;

revoke execute on function public.my_daily_spending(integer) from public, anon, service_role;
grant execute on function public.my_daily_spending(integer) to authenticated;
