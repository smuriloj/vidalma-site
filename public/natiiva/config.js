// Natiiva — dados do projeto Supabase (Settings -> API).
// Mesmo projeto da area do cliente da Vidalma: o login e um so para os dois.
// A chave "publishable" e publica por natureza e pode ficar neste arquivo.
// A service_role/secret NUNCA entra aqui.
//
// Quem protege os leads nao e esta chave nem a tela de login: e a RLS do
// banco. Com esta chave em maos e sem estar em natiiva.membros com
// ativo = true, a consulta volta vazia. Ver sql/001_schema.sql no repositorio
// smuriloj/vitrine-leads.
window.NATIIVA_SUPABASE = {
  url: 'https://urqwdbxohprkrdknmdaj.supabase.co',
  chave: 'sb_publishable_OmlTOJm1PXMt5iC6YsyNYA_Mh0_lLVA',
  // Os dados da Natiiva vivem no schema "natiiva", nunca em "public".
  // Este schema precisa estar em Settings -> API -> Exposed schemas,
  // senao toda consulta volta 404 mesmo com o SQL correto.
  schema: 'natiiva'
};
