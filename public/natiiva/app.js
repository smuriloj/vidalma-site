/* Natiiva — area restrita.
   Sem build, sem framework, mesmo padrao da area do cliente da Vidalma.

   O QUE ESTE ARQUIVO PROTEGE: nada.
   Ele so decide qual tela mostrar. Roda no navegador do visitante, e qualquer
   pessoa pode pular a tela de login digitando painel.html direto na barra de
   endereco. Isso e esperado e nao e problema.
   Quem impede alguem de ver lead sem permissao e a RLS do banco: sem uma linha
   em natiiva.membros com ativo = true, o Supabase devolve vazio para qualquer
   consulta, venha ela desta tela, de outra aba ou de um terminal.
   Ver sql/999_teste_rls.sql no repositorio smuriloj/vitrine-leads. */

(function () {
  'use strict';

  var cfg = window.NATIIVA_SUPABASE;
  var sb = window.supabase.createClient(cfg.url, cfg.chave, {
    db: { schema: cfg.schema }
  });

  function tela(nome) {
    var el = document.querySelector('[data-tela]');
    return el && el.getAttribute('data-tela') === nome;
  }

  function ir(destino) { location.replace(destino); }

  function abs(destino) {
    return location.href.replace(/[^/]*$/, '') + destino;
  }

  function mostrar(id, texto) {
    var el = document.getElementById(id);
    if (!el) return;
    if (texto) {
      var p = el.querySelector('p');
      if (p) p.textContent = texto;
    }
    el.style.display = 'flex';
  }

  function esconder(id) {
    var el = document.getElementById(id);
    if (el) el.style.display = 'none';
  }

  function ocupado(botao, sim, rotuloOcupado) {
    if (!botao) return;
    botao.disabled = sim;
    if (sim) {
      botao.dataset.rotulo = botao.textContent;
      botao.textContent = rotuloOcupado;
      botao.style.opacity = '.6';
      botao.style.cursor = 'default';
    } else {
      if (botao.dataset.rotulo) botao.textContent = botao.dataset.rotulo;
      botao.style.opacity = '';
      botao.style.cursor = 'pointer';
    }
  }

  // -------------------------------------------------------------------------
  // Confere se quem entrou pertence a Natiiva.
  //
  // Estar logado no Supabase NAO basta: o auth.users e compartilhado com a
  // area do cliente da Vidalma. Um cliente da Vidalma tem login valido e nao
  // pode ver lead nenhum. Quem separa os dois e natiiva.membros.
  // -------------------------------------------------------------------------
  function conferirMembro() {
    return sb.from('membros')
      .select('nome, papel, ativo')
      .limit(1)
      .then(function (r) {
        if (r.error) {
          // O schema ainda nao existe / nao esta exposto na API. Nao e o mesmo
          // que "sem permissao", e a mensagem precisa dizer isso, senao a
          // proxima pessoa perde uma tarde procurando erro de senha.
          var m = (r.error.message || '') + ' ' + (r.error.code || '');
          if (/schema|does not exist|42P01|PGRST106|PGRST205|404/i.test(m)) {
            return { estado: 'banco_ausente', detalhe: r.error.message };
          }
          return { estado: 'erro', detalhe: r.error.message };
        }
        var linhas = r.data || [];
        // A RLS ja filtra: se voltou linha, e a do proprio usuario.
        if (!linhas.length) return { estado: 'sem_acesso' };
        if (!linhas[0].ativo) return { estado: 'sem_acesso' };
        return { estado: 'ok', membro: linhas[0] };
      })
      .catch(function (e) {
        return { estado: 'erro', detalhe: String(e && e.message || e) };
      });
  }

  // =========================================================================
  // 00 — Redireciona
  // =========================================================================
  if (tela('redireciona')) {
    sb.auth.getSession().then(function (r) {
      ir(r.data && r.data.session ? 'painel.html' : 'entrar.html');
    });
    return;
  }

  // =========================================================================
  // 01 — Entrar
  // =========================================================================
  if (tela('entrar')) {
    // Ja logado? Nao faz sentido pedir senha de novo.
    sb.auth.getSession().then(function (r) {
      if (r.data && r.data.session) ir('painel.html');
    });

    var form = document.getElementById('form-entrar');
    var campoEmail = document.getElementById('email');
    var campoSenha = document.getElementById('senha');
    var btnEntrar = form && form.querySelector('button[type=submit]');
    var btnLink = document.getElementById('btn-link');

    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      esconder('erro-senha');
      ocupado(btnEntrar, true, 'Entrando...');

      sb.auth.signInWithPassword({
        email: campoEmail.value.trim(),
        password: campoSenha.value
      }).then(function (r) {
        if (r.error) {
          ocupado(btnEntrar, false);
          mostrar('erro-senha');
          campoSenha.value = '';
          campoSenha.focus();
          return;
        }
        ir('painel.html');
      });
    });

    btnLink.addEventListener('click', function () {
      var email = campoEmail.value.trim();
      if (!email) {
        campoEmail.focus();
        mostrar('erro-senha', 'Escreve o e-mail primeiro, que eu mando o link para ele.');
        return;
      }
      esconder('erro-senha');
      ocupado(btnLink, true, 'Enviando...');

      sb.auth.signInWithOtp({
        email: email,
        options: {
          // Nao criar conta sozinho: quem entra e quem a Vidalma cadastrou.
          shouldCreateUser: false,
          emailRedirectTo: abs('painel.html')
        }
      }).then(function (r) {
        ocupado(btnLink, false);
        if (r.error) { ir('entrar-erro.html'); return; }
        sessionStorage.setItem('natiiva_email', email);
        ir('entrar-link-enviado.html');
      });
    });
    return;
  }

  // =========================================================================
  // 02 — Link enviado
  // =========================================================================
  if (tela('link-enviado')) {
    var guardado = sessionStorage.getItem('natiiva_email');
    var alvo = document.getElementById('email-enviado');
    if (guardado && alvo) alvo.textContent = guardado;
    return;
  }

  // =========================================================================
  // 03 — Erro
  // =========================================================================
  if (tela('erro')) {
    var formErro = document.getElementById('form-entrar');
    if (formErro) {
      formErro.addEventListener('submit', function (ev) {
        ev.preventDefault();
        ir('entrar.html');
      });
    }
    return;
  }

  // =========================================================================
  // 04 — Painel
  // =========================================================================
  if (tela('painel')) {
    var sair = document.getElementById('sair');
    if (sair) {
      sair.addEventListener('click', function (ev) {
        ev.preventDefault();
        sb.auth.signOut().then(function () { ir('entrar.html'); });
      });
    }

    sb.auth.getSession().then(function (r) {
      var sessao = r.data && r.data.session;
      if (!sessao) { ir('entrar.html'); return; }

      return conferirMembro().then(function (res) {
        if (res.estado === 'sem_acesso') {
          // Login valido, mas nao e da Natiiva. Encerra a sessao para nao
          // deixar o navegador achando que esta dentro.
          return sb.auth.signOut().then(function () { ir('entrar-erro.html'); });
        }

        esconder('carregando');

        if (res.estado === 'banco_ausente') {
          mostrar('aviso-banco');
          document.getElementById('ola').textContent = 'Olá.';
          return;
        }
        if (res.estado === 'erro') {
          mostrar('aviso-erro', 'Nao consegui falar com o banco: ' + res.detalhe);
          document.getElementById('ola').textContent = 'Olá.';
          return;
        }

        var nome = (res.membro.nome || '').split(' ')[0];
        document.getElementById('ola').textContent = nome ? 'Olá, ' + nome + '.' : 'Olá.';
        var papel = document.getElementById('papel');
        if (papel) papel.textContent = res.membro.papel;
        mostrar('conteudo-liberado');
      });
    });
  }
})();
