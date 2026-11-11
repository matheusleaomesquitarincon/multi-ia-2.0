-- Quedas raras na hora de cobrar (F43).
--
-- 1. Cada etapa de uma execução vira no máximo UMA linha de gasto. O servidor manda o número da etapa (a posição dela
--    entre as concluídas, p_step_seq) e o banco recusa a segunda cobrança do mesmo número ('step_already_charged'),
--    mesmo que dois servidores tentem ao mesmo tempo. Antes, isso dependia de contar as linhas e torcer.
-- 2. Etapa concluída é cobrada mesmo se a reserva acabou de fechar (a pessoa cancelou no mesmo instante): a regra é
--    "paga as etapas concluídas" (AGENTS.md, seção 5), e a chave do item 1 impede que isso cobre duas vezes. Cobrança
--    sem número (o chat) continua recusada em reserva fechada.
-- 3. wallet_close_stale_holds fecha as reservas de execuções e mensagens que já terminaram e que ninguém está rodando.
--    O servidor a chama de tempos em tempos (lib/runs/housekeeping.js). Antes, uma reserva assim segurava o saldo até
--    vencer (uma hora), se o servidor caísse no meio de uma fase cancelada.

alter table public.wallet_entries
  add column step_seq integer check (step_seq >= 0),
  add constraint wallet_entries_step_seq_is_run_charge
    check (step_seq is null or (kind = 'charge' and run_id is not null));

create unique index wallet_entries_run_step_once on public.wallet_entries (run_id, step_seq)
  where step_seq is not null;

drop function public.wallet_charge(uuid, bigint, text, text, uuid, uuid);

-- Cobra o consumo real de uma etapa ou tarefa concluída. Cobrança zero não vira linha. Devolve quanto ainda sobra da
-- reserva; negativo quer dizer que o custo já passou da estimativa. Com p_step_seq (etapa de uma execução), cobra uma
-- vez só por número, e também numa reserva já fechada.
create function public.wallet_charge(
  p_hold_id uuid,
  p_amount_cents bigint,
  p_description text,
  p_provider text default null,
  p_run_id uuid default null,
  p_task_id uuid default null,
  p_step_seq integer default null
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_company_id uuid;
  v_hold public.wallet_holds%rowtype;
  v_run_id uuid;
begin
  if p_amount_cents is null or p_amount_cents < 0 then
    raise exception 'invalid_amount';
  end if;

  select h.company_id into v_company_id from public.wallet_holds h where h.id = p_hold_id;
  if not found then
    raise exception 'hold_not_found';
  end if;

  perform private.lock_wallet(v_company_id);

  select * into v_hold from public.wallet_holds h where h.id = p_hold_id;
  v_run_id := coalesce(p_run_id, v_hold.run_id);

  if p_step_seq is null then
    if v_hold.status <> 'open' then
      raise exception 'hold_closed';
    end if;
  else
    if v_run_id is null then
      raise exception 'step_seq_needs_run';
    end if;
    -- Com a carteira travada, ninguém lança a mesma etapa entre esta conferência e o insert (o índice único é a rede).
    if exists (
      select 1 from public.wallet_entries e where e.run_id = v_run_id and e.step_seq = p_step_seq
    ) then
      raise exception 'step_already_charged';
    end if;
  end if;

  if p_amount_cents > 0 then
    insert into public.wallet_entries
      (company_id, kind, amount_cents, member_id, hold_id, run_id, task_id, provider, description, step_seq)
    values (
      v_hold.company_id, 'charge', -p_amount_cents, v_hold.member_id, v_hold.id,
      v_run_id, coalesce(p_task_id, v_hold.task_id), p_provider, p_description, p_step_seq
    );

    update public.wallet_holds h set charged_cents = h.charged_cents + p_amount_cents where h.id = v_hold.id;
  end if;

  return v_hold.amount_cents - v_hold.charged_cents - p_amount_cents;
end;
$$;

-- Fecha as reservas abertas de execuções que terminaram (concluída, falhou, cancelada) e que nenhum servidor está
-- rodando agora (a reserva de quem roda, lease_until, venceu ou não existe), e as de mensagens do chat que terminaram.
-- O que não foi cobrado volta a ficar disponível. Devolve quantas fechou.
create function public.wallet_close_stale_holds()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_hold record;
  v_closed integer := 0;
begin
  for v_hold in
    select h.id, h.company_id
    from public.wallet_holds h
    where h.status = 'open'
      and (
        exists (
          select 1 from public.runs r
          where r.id = h.run_id
            and r.status in ('finished', 'failed', 'cancelled')
            and (r.lease_until is null or r.lease_until < now())
        )
        or exists (
          select 1 from public.tasks t where t.id = h.task_id and t.status in ('finished', 'failed')
        )
      )
    order by h.company_id
  loop
    perform private.lock_wallet(v_hold.company_id);
    update public.wallet_holds h
    set status = 'closed', closed_at = now()
    where h.id = v_hold.id and h.status = 'open';
    if found then
      v_closed := v_closed + 1;
    end if;
  end loop;
  return v_closed;
end;
$$;

revoke execute on function
  public.wallet_charge(uuid, bigint, text, text, uuid, uuid, integer),
  public.wallet_close_stale_holds()
from public, anon, authenticated;

grant execute on function
  public.wallet_charge(uuid, bigint, text, text, uuid, uuid, integer),
  public.wallet_close_stale_holds()
to service_role;
