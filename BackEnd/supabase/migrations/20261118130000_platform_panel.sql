-- Painel interno da plataforma (bloco 3; F17 e F25): a equipe da plataforma vê todas as empresas, recarrega crédito
-- pela tela, acompanha o custo real das IAs contra o cobrado e muda o câmbio.
--
-- Quem é da equipe fica em platform_staff, que só se preenche pelo editor de SQL do Supabase (nenhuma tela adiciona
-- gente). Exemplo: insert into public.platform_staff (user_id, name) values ('<id do login>', 'Luis');
--
-- As funções platform_* rodam como dono do banco (security definer), mas só para quem está logado E está na equipe:
-- quem confere é o próprio banco, pelo login de quem chama (auth.uid()), e não o nosso servidor. Assim, mesmo um defeito
-- no servidor não deixa um funcionário recarregar crédito: o pedido precisa vir com o login de alguém da equipe.
-- A recarga continua passando por private.wallet_topup, e o ajuste continua só pelo editor de SQL.

create table public.platform_staff (
  user_id uuid primary key references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  created_at timestamptz not null default now()
);

-- Uma linha só: o câmbio usado para cobrar em reais. O servidor lê de tempos em tempos (lib/platform/exchange.js).
create table public.platform_settings (
  id boolean primary key default true check (id),
  usd_to_brl numeric(8, 4) not null check (usd_to_brl between 1 and 20),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null
);
insert into public.platform_settings (usd_to_brl) values (5.5);

-- O que a equipe fez pelo painel: recargas e mudanças de câmbio. Só linhas novas.
create table public.platform_log (
  id bigint generated always as identity primary key,
  staff_user_id uuid references auth.users (id) on delete set null,
  staff_name text not null,
  action text not null check (action in ('topup', 'exchange')),
  company_id uuid references public.companies (id) on delete restrict,
  amount_cents bigint,
  usd_to_brl numeric(8, 4),
  details text check (char_length(details) <= 200),
  created_at timestamptz not null default now()
);

alter table public.platform_staff enable row level security;
alter table public.platform_settings enable row level security;
alter table public.platform_log enable row level security;

revoke all on table public.platform_staff, public.platform_settings, public.platform_log
  from public, anon, authenticated, service_role;
-- O servidor só lê o câmbio. Ninguém mais lê nada destas tabelas direto: a equipe lê pelas funções abaixo.
grant select on table public.platform_settings to service_role;

-- ---------- Quem é da equipe ----------

-- O nome de quem chama, se for da equipe; senão, nulo.
create function private.platform_staff_name()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select s.name from public.platform_staff s where s.user_id = (select auth.uid())
$$;

-- Para no começo de cada função da equipe.
create function private.require_platform_staff()
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_name text := private.platform_staff_name();
begin
  if v_name is null then
    raise exception 'not_staff' using errcode = '42501';
  end if;
  return v_name;
end;
$$;

create function public.platform_is_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.platform_staff_name() is not null
$$;

-- ---------- O que a equipe vê ----------

-- Todas as empresas, com o dono, quantas pessoas ativas, o saldo, o disponível (saldo menos reservas abertas), o gasto
-- do mês e o último movimento.
create function public.platform_companies()
returns table (
  company_id uuid,
  company_name text,
  created_at timestamptz,
  owner_name text,
  owner_email text,
  active_members integer,
  balance_cents bigint,
  available_cents bigint,
  month_spent_cents bigint,
  last_activity_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.require_platform_staff();
  return query
  select
    c.id,
    c.name,
    c.created_at,
    o.name,
    o.email,
    (select count(*)::integer from public.members m where m.company_id = c.id and m.status = 'active'),
    coalesce((select sum(e.amount_cents) from public.wallet_entries e where e.company_id = c.id), 0)::bigint,
    private.company_available_cents(c.id),
    coalesce((
      select -sum(e.amount_cents) from public.wallet_entries e
      where e.company_id = c.id and e.kind = 'charge' and e.created_at >= private.month_start(now())
    ), 0)::bigint,
    (select max(e.created_at) from public.wallet_entries e where e.company_id = c.id)
  from public.companies c
  left join lateral (
    select m.name, m.email from public.members m
    where m.company_id = c.id and m.role = 'owner'
    order by m.created_at
    limit 1
  ) o on true
  order by c.created_at desc;
end;
$$;

-- O custo real das IAs (ai_calls, em dólar e em reais no câmbio de cada chamada) contra o que foi cobrado das empresas
-- (os gastos do extrato), por empresa, entre p_from e p_to.
create function public.platform_costs(p_from timestamptz, p_to timestamptz)
returns table (
  company_id uuid,
  company_name text,
  calls integer,
  failed_calls integer,
  cost_usd numeric,
  cost_cents bigint,
  failed_cost_cents bigint,
  billed_cents bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.require_platform_staff();
  if p_from is null or p_to is null or p_from >= p_to then
    raise exception 'invalid_period';
  end if;
  return query
  select
    c.id,
    c.name,
    coalesce(a.calls, 0)::integer,
    coalesce(a.failed_calls, 0)::integer,
    coalesce(a.cost_usd, 0),
    coalesce(a.cost_cents, 0)::bigint,
    coalesce(a.failed_cost_cents, 0)::bigint,
    coalesce(b.billed_cents, 0)::bigint
  from public.companies c
  left join lateral (
    select
      count(*) as calls,
      count(*) filter (where k.status = 'error') as failed_calls,
      sum(k.cost_usd) as cost_usd,
      -- Chamada antiga sem câmbio guardado: conta no câmbio de hoje.
      ceil(sum(k.cost_usd * coalesce(k.usd_brl, (select s.usd_to_brl from public.platform_settings s)) * 100)) as cost_cents,
      ceil(sum(k.cost_usd * coalesce(k.usd_brl, (select s.usd_to_brl from public.platform_settings s)) * 100)
        filter (where not k.charged)) as failed_cost_cents
    from public.ai_calls k
    where k.company_id = c.id and k.created_at >= p_from and k.created_at < p_to
  ) a on true
  left join lateral (
    select -sum(e.amount_cents) as billed_cents
    from public.wallet_entries e
    where e.company_id = c.id and e.kind = 'charge' and e.created_at >= p_from and e.created_at < p_to
  ) b on true
  where coalesce(a.calls, 0) > 0 or coalesce(b.billed_cents, 0) <> 0
  order by coalesce(a.cost_cents, 0) desc;
end;
$$;

-- As recargas e os ajustes mais recentes de todas as empresas (o extrato de recargas).
create function public.platform_credit_entries(p_limit integer default 50)
returns table (
  entry_id bigint,
  company_id uuid,
  company_name text,
  kind text,
  amount_cents bigint,
  description text,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.require_platform_staff();
  return query
  select e.id, e.company_id, c.name, e.kind, e.amount_cents, e.description, e.created_at
  from public.wallet_entries e
  join public.companies c on c.id = e.company_id
  where e.kind in ('topup', 'adjustment')
  order by e.created_at desc, e.id desc
  limit least(greatest(coalesce(p_limit, 50), 1), 200);
end;
$$;

-- O câmbio atual e o que a equipe fez pelo painel por último.
create function public.platform_overview()
returns table (
  usd_to_brl numeric,
  usd_to_brl_updated_at timestamptz,
  staff_name text,
  recent_log jsonb
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_name text := private.require_platform_staff();
begin
  return query
  select
    s.usd_to_brl,
    s.updated_at,
    v_name,
    coalesce((
      select jsonb_agg(to_jsonb(l) - 'staff_user_id' order by l.created_at desc)
      from (select * from public.platform_log order by created_at desc limit 20) l
    ), '[]'::jsonb)
  from public.platform_settings s;
end;
$$;

-- ---------- O que a equipe faz ----------

-- Recarga pela tela, depois de receber o pagamento (no lugar do editor de SQL). Até R$ 100.000,00 por vez, para um
-- dígito a mais não virar uma recarga enorme. Devolve o saldo novo.
create function public.platform_topup(p_company_id uuid, p_amount_cents bigint, p_description text)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text := private.require_platform_staff();
  v_description text := btrim(coalesce(p_description, ''));
  v_balance bigint;
begin
  if p_amount_cents is null or p_amount_cents <= 0 or p_amount_cents > 10000000 then
    raise exception 'invalid_amount';
  end if;
  if char_length(v_description) < 1 or char_length(v_description) > 120 then
    raise exception 'invalid_description';
  end if;
  if not exists (select 1 from public.companies c where c.id = p_company_id) then
    raise exception 'company_not_found';
  end if;

  v_balance := private.wallet_topup(p_company_id, p_amount_cents, v_description);

  insert into public.platform_log (staff_user_id, staff_name, action, company_id, amount_cents, details)
  values ((select auth.uid()), v_name, 'topup', p_company_id, p_amount_cents, v_description);

  return v_balance;
end;
$$;

-- Novo câmbio (reais por dólar), entre R$ 1 e R$ 20. Vale para os próximos usos; o que já foi cobrado não muda.
create function public.platform_set_usd_to_brl(p_usd_to_brl numeric)
returns numeric
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text := private.require_platform_staff();
  v_rate numeric(8, 4) := round(p_usd_to_brl, 4);
begin
  if v_rate is null or v_rate < 1 or v_rate > 20 then
    raise exception 'invalid_rate';
  end if;

  update public.platform_settings
  set usd_to_brl = v_rate, updated_at = now(), updated_by = (select auth.uid())
  where id;

  insert into public.platform_log (staff_user_id, staff_name, action, usd_to_brl)
  values ((select auth.uid()), v_name, 'exchange', v_rate);

  return v_rate;
end;
$$;

-- Quem chama cada função: as da equipe, só quem está logado (e o banco confere a equipe dentro de cada uma).
revoke execute on function
  private.platform_staff_name(),
  private.require_platform_staff(),
  public.platform_is_staff(),
  public.platform_companies(),
  public.platform_costs(timestamptz, timestamptz),
  public.platform_credit_entries(integer),
  public.platform_overview(),
  public.platform_topup(uuid, bigint, text),
  public.platform_set_usd_to_brl(numeric)
from public, anon, authenticated, service_role;

grant execute on function
  public.platform_is_staff(),
  public.platform_companies(),
  public.platform_costs(timestamptz, timestamptz),
  public.platform_credit_entries(integer),
  public.platform_overview(),
  public.platform_topup(uuid, bigint, text),
  public.platform_set_usd_to_brl(numeric)
to authenticated;
