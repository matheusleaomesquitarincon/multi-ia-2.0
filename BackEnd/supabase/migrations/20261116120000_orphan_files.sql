-- Conteúdo da pasta fechada "files" que perdeu o registro (F28). Pelas nossas telas, apagar um arquivo tira o registro
-- e o conteúdo. Mas quem usa a própria sessão direto no banco apaga só o registro (files_delete_own), e o conteúdo fica
-- na pasta: ninguém consegue abri-lo, mas ele não foi apagado de verdade, como a LGPD pede.
--
-- Esta função devolve o caminho desse conteúdo para a limpeza do servidor (lib/runs/housekeeping.js) apagar pela API do
-- Storage (o Supabase não deixa apagar direto na tabela storage.objects). Só o conteúdo com mais de 1 hora entra: o
-- servidor grava primeiro o conteúdo e logo depois o registro (lib/ock/files.js), e um arquivo no meio desse caminho não
-- pode ser confundido com um esquecido.

create function public.files_orphan_paths(p_limit integer default 100)
returns setof text
language sql
stable
security definer
set search_path = ''
as $$
  select o.name
  from storage.objects o
  where o.bucket_id = 'files'
    and o.created_at < now() - interval '1 hour'
    and not exists (select 1 from public.files f where f.storage_path = o.name)
  order by o.created_at
  limit least(greatest(p_limit, 1), 1000);
$$;

revoke execute on function public.files_orphan_paths(integer) from public, anon, authenticated;
grant execute on function public.files_orphan_paths(integer) to service_role;
