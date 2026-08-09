/* =============================================================================
   Natiiva — configuracao
   ============================================================================= */

/* ---- Supabase ------------------------------------------------------------
   Mesmo projeto da area do cliente da Vidalma: um login serve aos dois.
   A chave "publishable" e publica por natureza e pode ficar aqui.
   A service_role/secret NUNCA entra neste arquivo.

   Quem protege os leads nao e esta chave nem a tela de login: e a RLS do banco.
   Com esta chave em maos e sem estar em natiiva.membros com ativo = true, a
   consulta volta vazia. Ver sql/001_schema.sql em smuriloj/vitrine-leads. */
window.NATIIVA_SUPABASE = {
  url: 'https://urqwdbxohprkrdknmdaj.supabase.co',
  chave: 'sb_publishable_OmlTOJm1PXMt5iC6YsyNYA_Mh0_lLVA',
  // Os dados vivem no schema "natiiva", nunca em "public". Este schema precisa
  // estar em Settings -> API -> Exposed schemas, senao tudo volta 404.
  schema: 'natiiva'
};

/* ---- Contato -------------------------------------------------------------
   AQUI E O UNICO LUGAR COM O NUMERO. Mudar esta linha muda todos os botoes do
   site de uma vez: home, hero, CTA final e login. Nao ha numero escrito em
   nenhum outro arquivo.

   Formato internacional, so digitos: 55 + DDD + numero.
   Exemplo: 5511987654321

   ENQUANTO O NUMERO FOR VAZIO, os botoes de WhatsApp continuam na tela, com a
   aparencia certa, mas nao navegam — ficam inertes e com aviso de leitor de
   tela. E de proposito: botao que abre uma conversa com numero inexistente e
   pior do que botao que ainda nao abre. Assim que o numero existir, troque a
   linha abaixo e tudo passa a funcionar sem mexer em mais nada. */
window.NATIIVA_CONTATO = {
  whatsapp: '',
  mensagem: 'Ola! Vim pelo site da Natiiva e quero saber sobre a base de leads industriais.'
};

/* ---- Texto de conformidade ----------------------------------------------
   [3] PROPOSTA, para você aprovar ou trocar. Sai do que a base de fato e, sem
   prometer o que ela nao tem. */
window.NATIIVA_LGPD =
  'Os dados são cadastrais de pessoa jurídica e vêm da Base de Dados Abertos ' +
  'do CNPJ, publicada pela Receita Federal. Telefone e e-mail são os declarados ' +
  'pela própria empresa no cadastro do CNPJ. A finalidade é prospecção comercial ' +
  'entre empresas. Atendemos pedidos de correção e de exclusão pelos canais de ' +
  'contato desta página.';
