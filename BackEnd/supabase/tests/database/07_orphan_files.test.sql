-- Teste da limpeza de arquivos esquecidos (F28): a função devolve só o conteúdo da pasta "files" que perdeu o registro
-- há mais de 1 hora, e só o servidor pode chamá-la.
begin;
create extension if not exists pgtap with schema extensions;
select plan(6);

insert into public.companies (id, name) values ('0000000c-0000-4000-8000-0000000000f8', 'Limpeza Ltda');
insert into public.members (id, company_id, name, email, role, monthly_budget_cents, status)
values ('f8000000-0000-4000-8000-000000000001', '0000000c-0000-4000-8000-0000000000f8', 'Funcionária',
  'f28@example.com', 'employee', null, 'active');

-- Na pasta: um conteúdo com registro, um esquecido antigo, um esquecido recém-gravado (o registro ainda vai entrar) e
-- um de outra pasta.
insert into storage.objects (bucket_id, name, created_at)
values
  ('files', '0000000c-0000-4000-8000-0000000000f8/f8000000-0000-4000-8000-000000000001/a-com-registro.pdf',
    now() - interval '2 hours'),
  ('files', '0000000c-0000-4000-8000-0000000000f8/f8000000-0000-4000-8000-000000000001/b-esquecido.pdf',
    now() - interval '2 hours'),
  ('files', '0000000c-0000-4000-8000-0000000000f8/f8000000-0000-4000-8000-000000000001/c-recente.pdf',
    now() - interval '5 minutes');

insert into storage.buckets (id, name, public) values ('outra-pasta-f28', 'outra-pasta-f28', false);
insert into storage.objects (bucket_id, name, created_at)
values ('outra-pasta-f28', 'qualquer/coisa.pdf', now() - interval '2 hours');

insert into public.files (company_id, member_id, kind, name, storage_path)
values ('0000000c-0000-4000-8000-0000000000f8', 'f8000000-0000-4000-8000-000000000001', 'upload', 'a-com-registro.pdf',
  '0000000c-0000-4000-8000-0000000000f8/f8000000-0000-4000-8000-000000000001/a-com-registro.pdf');

set local role service_role;

select results_eq(
  $$ select p from public.files_orphan_paths() p where p like '0000000c-0000-4000-8000-0000000000f8/%' $$,
  $$ values ('0000000c-0000-4000-8000-0000000000f8/f8000000-0000-4000-8000-000000000001/b-esquecido.pdf') $$,
  'Só o conteúdo sem registro, com mais de 1 hora, na pasta "files"'
);

select is(
  (select count(*) from public.files_orphan_paths() p where p like '%c-recente.pdf')::integer, 0,
  'O conteúdo recém-gravado não entra (o registro dele ainda pode estar a caminho)'
);

select is(
  (select count(*) from public.files_orphan_paths() p where p = 'qualquer/coisa.pdf')::integer, 0,
  'Outra pasta do Storage não entra'
);

select is(
  (select count(*) from public.files_orphan_paths(0))::integer, 1,
  'Um limite menor que 1 vale 1'
);

reset role;

-- Quando a pessoa apaga o registro pela própria sessão, o conteúdo passa a ser esquecido.
delete from public.files
where storage_path = '0000000c-0000-4000-8000-0000000000f8/f8000000-0000-4000-8000-000000000001/a-com-registro.pdf';

set local role service_role;
select is(
  (select count(*) from public.files_orphan_paths() p where p like '0000000c-0000-4000-8000-0000000000f8/%')::integer, 2,
  'Apagou o registro, o conteúdo entra na limpeza'
);
reset role;

set local role authenticated;
select throws_ok(
  $$ select public.files_orphan_paths() $$,
  '42501', null,
  'Quem está logado não chama a função (ela enxerga a pasta de todas as empresas)'
);
reset role;

select * from finish();
rollback;
