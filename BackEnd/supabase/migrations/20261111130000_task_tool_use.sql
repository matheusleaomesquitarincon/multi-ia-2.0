-- Se a IA pesquisou na internet ou rodou um programa numa mensagem do chat (F53).
--
-- Antes, o aviso "não pesquisou" / "não rodou um programa" dependia do fim do texto da resposta (as fontes ou a frase
-- do programa, escritas pelo servidor). Se a IA terminasse a resposta com uma lista igual, inventada, o aviso sumia.
-- Agora o servidor grava o que de fato aconteceu, e o aviso lê daqui. Vazio (null) nas mensagens de antes desta
-- migração: para elas, o aviso continua lendo o fim do texto.
-- As regras de acesso de tasks não mudam: a pessoa lê só as próprias mensagens, e só o servidor grava.

alter table public.tasks
  add column researched boolean,
  add column ran_code boolean;
