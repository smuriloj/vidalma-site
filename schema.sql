-- ============================================================================
-- ÁREA DO CLIENTE VIDALMA — banco de dados
-- Para rodar UMA vez no SQL Editor do Supabase, num projeto criado na região
-- South America (São Paulo).
--
-- O desenho vem das 10 telas de 10-area-do-cliente (pacote da marca, ago/2026):
-- toda coluna daqui aparece em alguma tela.
-- Quem escreve nos dados é a Vidalma, pelo painel do Supabase. O cliente, pela
-- área, só lê o que é dele, abre solicitação e responde conversa — as regras
-- de segurança (RLS) lá embaixo garantem isso no banco, não no navegador.
-- ============================================================================

-- 1. CLIENTES ----------------------------------------------------------------
-- Uma linha por cliente. O id é o mesmo do login (auth.users): é o elo entre
-- o e-mail do link mágico e os dados. Cliente não se cadastra sozinho.
create table public.clientes (
  id        uuid primary key references auth.users (id) on delete cascade,
  nome      text not null,        -- primeiro nome; vira o "Olá, Marcos." do início
  email     text not null unique, -- o mesmo e-mail usado no login
  criado_em timestamptz not null default now()
);

-- 2. PROJETOS ----------------------------------------------------------------
-- Cada trabalho contratado. O tipo acende o módulo certo do ícone
-- (site = superior, aplicativo = direito, design = inferior, automacao = esquerdo).
create table public.projetos (
  id         uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clientes (id) on delete cascade,
  nome       text not null,                       -- "Site da Barbearia Rocha"
  tipo       text not null
             check (tipo in ('site','aplicativo','design','automacao')),
  estado     text not null default 'em_producao'
             check (estado in ('em_producao','no_ar','entregue','pausado')),
  link       text,                                -- "barbeariarocha.com.br" quando no ar
  previsao   date,                                -- "Previsão: 12 de agosto." em produção
  criado_em  timestamptz not null default now()
);

-- 3. SOLICITAÇÕES ------------------------------------------------------------
-- Os pedidos de alteração. Os quatro estados são as etiquetas das telas.
-- O texto do pedido em si vira a primeira mensagem da conversa (tabela 4).
create table public.solicitacoes (
  id           uuid primary key default gen_random_uuid(),
  cliente_id   uuid not null references public.clientes (id) on delete cascade,
  projeto_id   uuid not null references public.projetos (id) on delete cascade,
  titulo       text not null,          -- "Trocar as fotos da home"
  estado       text not null default 'aberta'
               check (estado in ('aberta','em_andamento','aguardando_voce','concluida')),
  concluida_em date,                   -- só preenchida quando concluir
  criada_em    timestamptz not null default now()
);

-- 4. MENSAGENS ---------------------------------------------------------------
-- A conversa dentro de cada solicitação, em ordem de chegada.
create table public.mensagens (
  id             uuid primary key default gen_random_uuid(),
  solicitacao_id uuid not null references public.solicitacoes (id) on delete cascade,
  autor          text not null check (autor in ('cliente','vidalma')),
  texto          text not null,
  criada_em      timestamptz not null default now()
);

-- 5. PAGAMENTOS --------------------------------------------------------------
-- Uma linha por cobrança. Valor em centavos (R$ 600,00 = 60000) para a conta
-- nunca errar centavo. "Vencido", "vence em X dias" e "a vencer" saem da data
-- de vencimento; "pago" é o campo pago. Os três números do resumo
-- (contratado / já pago / em aberto) somam daqui.
create table public.pagamentos (
  id             uuid primary key default gen_random_uuid(),
  cliente_id     uuid not null references public.clientes (id) on delete cascade,
  projeto_id     uuid references public.projetos (id) on delete set null,
  descricao      text not null,        -- "Robô de agendamento · entrada"
  valor_centavos integer not null check (valor_centavos > 0),
  vencimento     date not null,
  pago           boolean not null default false,
  pago_em        date,
  criado_em      timestamptz not null default now()
);

-- Índices para as listas abrirem rápido --------------------------------------
create index projetos_por_cliente      on public.projetos (cliente_id);
create index solicitacoes_por_cliente  on public.solicitacoes (cliente_id, criada_em desc);
create index mensagens_por_solicitacao on public.mensagens (solicitacao_id, criada_em);
create index pagamentos_por_cliente    on public.pagamentos (cliente_id, vencimento);

-- ============================================================================
-- SEGURANÇA (RLS) — a parte mais importante do arquivo.
-- Ligada, cada cliente só enxerga as PRÓPRIAS linhas, mesmo que alguém tente
-- falar direto com a API sem passar pelas telas. Sem uma política que permita,
-- tudo é negado por padrão. Quem não fez login não vê nada.
-- Você (Vidalma), pelo painel do Supabase, passa por cima disso tudo.
-- ============================================================================
alter table public.clientes     enable row level security;
alter table public.projetos     enable row level security;
alter table public.solicitacoes enable row level security;
alter table public.mensagens    enable row level security;
alter table public.pagamentos   enable row level security;

-- Ler: cada um só o que é seu
create policy "cliente le a si mesmo"        on public.clientes
  for select to authenticated using (id = auth.uid());
create policy "cliente le seus projetos"     on public.projetos
  for select to authenticated using (cliente_id = auth.uid());
create policy "cliente le suas solicitacoes" on public.solicitacoes
  for select to authenticated using (cliente_id = auth.uid());
create policy "cliente le suas conversas"    on public.mensagens
  for select to authenticated using (
    exists (select 1 from public.solicitacoes s
            where s.id = solicitacao_id and s.cliente_id = auth.uid()));
create policy "cliente le seus pagamentos"   on public.pagamentos
  for select to authenticated using (cliente_id = auth.uid());

-- Escrever: só o que a área permite fazer
create policy "cliente abre solicitacao"     on public.solicitacoes
  for insert to authenticated
  with check (cliente_id = auth.uid() and estado = 'aberta');
create policy "cliente responde conversa"    on public.mensagens
  for insert to authenticated
  with check (autor = 'cliente' and exists
    (select 1 from public.solicitacoes s
     where s.id = solicitacao_id and s.cliente_id = auth.uid()));

-- Automação única: quando o cliente responde uma solicitação que estava
-- "Aguardando você", ela volta sozinha para "Em andamento".
create function public.volta_para_andamento()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.autor = 'cliente' then
    update public.solicitacoes
       set estado = 'em_andamento'
     where id = new.solicitacao_id and estado = 'aguardando_voce';
  end if;
  return new;
end;
$$;

create trigger mensagem_do_cliente_reabre
  after insert on public.mensagens
  for each row execute function public.volta_para_andamento();

-- ============================================================================
-- COMO CADASTRAR UM CLIENTE (guarde para depois; NÃO roda junto com o resto)
-- 1) Supabase → Authentication → Users → Add user → e-mail do cliente.
-- 2) Depois rode no SQL Editor, trocando o nome e o e-mail:
--
--    insert into public.clientes (id, nome, email)
--    select id, 'Marcos', email
--      from auth.users
--     where email = 'marcos@exemplo.com.br';
--
-- Sem essas duas etapas o link mágico não encontra o cliente e a tela
-- entrar-erro.html ("e-mail não cadastrado") é a resposta certa.
-- ============================================================================
