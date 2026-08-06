# vidalma-site

Site da Vidalma — vidalma.com.br

Uma página só. HTML e CSS no mesmo arquivo, sem build, sem framework.

## Estrutura

```
wrangler.jsonc      diz ao Cloudflare qual Worker é e onde estão os arquivos
public/             tudo que vai para o ar
  index.html        a página inteira (o CSS está dentro, na tag <style>)
  fontes/           Chivo e DM Sans, servidas pelo próprio site
  favicon.svg       ícone da aba
  apple-touch-icon.png
  og-image.png      imagem que aparece ao colar o link no WhatsApp
```

## Como publicar

Não existe passo de publicar. Toda alteração enviada para a branch `main`
sobe sozinha em uns 30 segundos, via Cloudflare Workers Builds.

Se algo sair errado: Cloudflare → o Worker → aba Implantações → escolher a
versão anterior. Volta em segundos.

## Como editar

Direto pelo site do GitHub: abra `public/index.html`, clique no lápis, edite,
clique em Commit. Funciona do celular.

Ou no computador:

```bash
git pull
# edita public/index.html
git add .
git commit -m "o que mudou"
git push
```

## O que ainda falta na página

Dois blocos marcados com `====` dentro do `index.html`, esperando decisão:

- **PREÇO** — hoje a página promete dizer o preço na primeira conversa.
  Quando os valores estiverem fechados, o formato já está pronto no comentário.
- **WHATSAPP** — hoje o botão leva ao direct do Instagram. Quando existir o
  WhatsApp Business, o link pronto está no comentário.

## Regras que a página tem que respeitar

Vêm do manual da marca. Antes de publicar qualquer alteração:

- Só as quatro cores: `#101418` `#F2C230` `#454C55` `#E9EBEA`. Nenhum tom
  intermediário.
- Amarelo com teto de 10% da área, nunca de fundo, sempre com texto preto.
  Hoje está em 0,40%, e é normal ficar bem abaixo do teto.
- Chivo 700/800 em título, DM Sans 400/500 em texto. Nada abaixo de 400.
- Nenhuma fonte abaixo de 11px. Nenhum link com alvo de toque abaixo de 44px.
- Os 7 dias nunca aparecem sem "até 5 páginas" e "conta da entrega do
  conteúdo". Prazo sem escopo é promessa vaga.
- Nada de "solução", "inovador", "disruptivo", "expertise", "jornada do
  cliente".
