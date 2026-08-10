/* =============================================================================
   Natiiva — home, login e aplicacao
   =============================================================================
   Sem build, sem framework, mesmo padrao do resto do site.

   O QUE ESTE ARQUIVO PROTEGE: nada.
   Ele decide qual tela mostrar e monta o que veio do banco. Roda no navegador
   do visitante e pode ser pulado — qualquer um abre app.html direto. Isso e
   esperado.
   Quem impede alguem de ver lead sem permissao e a RLS do Postgres: sem uma
   linha em natiiva.membros com ativo = true, o Supabase devolve vazio, venha a
   consulta desta tela, de outra aba ou de um terminal. E a mascara da amostra e
   feita no banco, nao aqui — nunca chega ao navegador o dado inteiro.
   Ver sql/999_teste_rls.sql em smuriloj/vitrine-leads.
   ============================================================================= */

(function () {
  'use strict';

  var cfg = window.NATIIVA_SUPABASE;
  var contato = window.NATIIVA_CONTATO || {};
  var tela = document.body.getAttribute('data-tela');

  function $(sel, raiz) { return (raiz || document).querySelector(sel); }
  function $$(sel, raiz) { return Array.prototype.slice.call((raiz || document).querySelectorAll(sel)); }
  function ir(destino) { location.replace(destino); }
  function texto(el, t) { if (el) el.textContent = t; }
  // Endereco absoluto de um arquivo vizinho. O Supabase exige URL inteira no
  // redirectTo, e ela ainda precisa estar na lista de Redirect URLs do painel.
  function abs(destino) { return location.href.replace(/[^/]*$/, '') + destino; }

  /* =========================================================================
     CAIXA DE DIALOGO
     =========================================================================
     O prompt(), o confirm() e o alert() do navegador funcionam, mas sao cinza
     de sistema operacional, aparecem colados no topo da janela e nao aceitam
     formatacao nenhuma. Numa tela que vai ser vendida, a caixa que pergunta o
     nome da base e parte do produto tanto quanto a tabela.

     Alem da aparencia, ganha-se uma coisa que o prompt() nao da: perguntar as
     tres informacoes da base de uma vez so, em vez de tres caixas em fila em
     que voltar atras significa cancelar tudo.

     dialogo(op) devolve uma promessa: null se a pessoa desistiu, ou um objeto
     com o valor de cada campo se ela confirmou.

       op.titulo    texto da tarja
       op.texto     paragrafo de explicacao (opcional)
       op.tom       'cuidado' pinta a tarja de ferrugem
       op.ok        rotulo do botao que confirma
       op.cancelar  rotulo do botao que desiste; null esconde o botao
       op.campos    lista de campos:
                      {id, rotulo, tipo:'texto'|'numero'|'escolha', valor,
                       ajuda, minimo, maximo, opcoes:[{valor,titulo,detalhe}]}
     ========================================================================= */
  function dialogo(op) {
    return new Promise(function (resolve) {
      var campos = op.campos || [];
      var valores = {};
      var focoAnterior = document.activeElement;

      var veu = document.createElement('div');
      veu.className = 'veu';

      var caixa = document.createElement('div');
      caixa.className = 'dialogo' + (op.tom === 'cuidado' ? ' dialogo--cuidado' : '');
      caixa.setAttribute('role', 'dialog');
      caixa.setAttribute('aria-modal', 'true');
      caixa.setAttribute('aria-labelledby', 'dlg-titulo');

      var topo = document.createElement('div');
      topo.className = 'dialogo-topo';
      var h = document.createElement('h2');
      h.id = 'dlg-titulo';
      h.textContent = op.titulo || '';
      topo.appendChild(h);
      caixa.appendChild(topo);

      var corpo = document.createElement('div');
      corpo.className = 'dialogo-corpo';
      if (op.texto) {
        var p = document.createElement('p');
        p.textContent = op.texto;
        corpo.appendChild(p);
      }

      var erro = document.createElement('div');
      erro.className = 'dialogo-erro';
      erro.style.display = 'none';
      erro.setAttribute('role', 'alert');

      var primeiro = null;

      campos.forEach(function (c) {
        valores[c.id] = c.valor;

        var env = document.createElement('div');
        env.className = 'dialogo-campo';

        if (c.rotulo) {
          var lab = document.createElement('label');
          lab.className = 'rotulo';
          lab.setAttribute('for', 'dlg-' + c.id);
          lab.textContent = c.rotulo;
          env.appendChild(lab);
        }

        if (c.tipo === 'escolha') {
          // Escolha e feita de blocos, e nao de uma chavinha de sim ou nao: o
          // que muda entre as duas opcoes precisa caber na propria etiqueta, e
          // nao numa pergunta que a pessoa vai ter de adivinhar.
          (c.opcoes || []).forEach(function (o) {
            var bloco = document.createElement('div');
            bloco.className = 'dialogo-opcao';
            bloco.setAttribute('role', 'radio');
            bloco.setAttribute('tabindex', '0');
            bloco.setAttribute('aria-checked', String(o.valor === c.valor));
            var i = document.createElement('i');
            var txt = document.createElement('div');
            var b = document.createElement('b'); b.textContent = o.titulo;
            txt.appendChild(b);
            if (o.detalhe) {
              var s = document.createElement('span'); s.textContent = o.detalhe;
              txt.appendChild(s);
            }
            bloco.appendChild(i); bloco.appendChild(txt);
            function marcar() {
              valores[c.id] = o.valor;
              $$('.dialogo-opcao', env).forEach(function (x) {
                x.setAttribute('aria-checked', String(x === bloco));
              });
            }
            bloco.addEventListener('click', marcar);
            bloco.addEventListener('keydown', function (ev) {
              if (ev.key === ' ' || ev.key === 'Enter') { ev.preventDefault(); marcar(); }
            });
            env.appendChild(bloco);
            if (!primeiro) primeiro = bloco;
          });
        } else {
          var inp = document.createElement('input');
          inp.id = 'dlg-' + c.id;
          inp.type = c.tipo === 'numero' ? 'number' : 'text';
          inp.value = c.valor == null ? '' : String(c.valor);
          if (c.minimo != null) inp.min = String(c.minimo);
          if (c.maximo != null) inp.max = String(c.maximo);
          inp.addEventListener('input', function () { valores[c.id] = inp.value; });
          inp.addEventListener('keydown', function (ev) {
            if (ev.key === 'Enter') { ev.preventDefault(); confirmar(); }
          });
          env.appendChild(inp);
          if (!primeiro) primeiro = inp;
        }

        if (c.ajuda) {
          var aj = document.createElement('div');
          aj.className = 'dialogo-ajuda';
          aj.textContent = c.ajuda;
          env.appendChild(aj);
        }
        corpo.appendChild(env);
      });

      corpo.appendChild(erro);
      caixa.appendChild(corpo);

      var pe = document.createElement('div');
      pe.className = 'dialogo-pe';

      if (op.cancelar !== null) {
        var btnNao = document.createElement('button');
        btnNao.type = 'button';
        btnNao.className = 'botao botao--borda-clara';
        btnNao.textContent = op.cancelar || 'Cancelar';
        btnNao.addEventListener('click', function () { fechar(null); });
        pe.appendChild(btnNao);
      }

      var btnSim = document.createElement('button');
      btnSim.type = 'button';
      btnSim.className = 'botao botao--brasa';
      btnSim.textContent = op.ok || 'Confirmar';
      btnSim.addEventListener('click', function () { confirmar(); });
      pe.appendChild(btnSim);

      caixa.appendChild(pe);
      veu.appendChild(caixa);

      function confirmar() {
        for (var i = 0; i < campos.length; i++) {
          var c = campos[i];
          var v = valores[c.id];
          if (c.tipo === 'numero') {
            var n = parseInt(v, 10);
            if (isNaN(n) || (c.minimo != null && n < c.minimo)
                         || (c.maximo != null && n > c.maximo)) {
              return falhar(c, 'Escreva um número'
                + (c.minimo != null ? ' de ' + c.minimo + ' para cima' : '') + '.');
            }
            valores[c.id] = n;
          } else if (c.tipo !== 'escolha') {
            if (!String(v == null ? '' : v).trim()) {
              return falhar(c, 'Falta preencher: ' + (c.rotulo || 'este campo') + '.');
            }
            valores[c.id] = String(v).trim();
          }
        }
        fechar(valores);
      }

      function falhar(c, msg) {
        erro.textContent = msg;
        erro.style.display = 'block';
        var alvo = $('#dlg-' + c.id, caixa);
        if (alvo) alvo.focus();
      }

      function aoTeclar(ev) {
        if (ev.key === 'Escape') { ev.preventDefault(); fechar(null); return; }
        // Prende o Tab dentro da caixa: fora dela esta a tela apagada pelo veu,
        // e sair para la com o teclado deixa a pessoa perdida.
        if (ev.key !== 'Tab') return;
        var focaveis = $$('input, button, [tabindex="0"]', caixa)
          .filter(function (e) { return !e.disabled; });
        if (!focaveis.length) return;
        var pri = focaveis[0], ult = focaveis[focaveis.length - 1];
        if (ev.shiftKey && document.activeElement === pri) { ev.preventDefault(); ult.focus(); }
        else if (!ev.shiftKey && document.activeElement === ult) { ev.preventDefault(); pri.focus(); }
      }

      var fechado = false;
      function fechar(resultado) {
        if (fechado) return;
        fechado = true;
        document.removeEventListener('keydown', aoTeclar, true);
        veu.parentNode.removeChild(veu);
        if (focoAnterior && focoAnterior.focus) focoAnterior.focus();
        resolve(resultado);
      }

      document.addEventListener('keydown', aoTeclar, true);
      document.body.appendChild(veu);
      (primeiro || btnSim).focus();
    });
  }

  // Um aviso, um botao so. Substitui o alert().
  function avisar(titulo, texto) {
    return dialogo({ titulo: titulo, texto: texto, ok: 'Entendi', cancelar: null });
  }

  // Uma pergunta de sim ou nao. Substitui o confirm().
  function perguntar(op) {
    return dialogo(op).then(function (r) { return r !== null; });
  }

  /* =========================================================================
     WHATSAPP e LGPD — valem nas tres telas
     ========================================================================= */
  (function contatos() {
    var num = (contato.whatsapp || '').replace(/\D/g, '');
    var botoes = $$('[data-zap]');
    if (num) {
      var href = 'https://wa.me/' + num + '?text=' + encodeURIComponent(contato.mensagem || '');
      botoes.forEach(function (b) { b.setAttribute('href', href); });
    } else {
      // Sem numero, o botao continua na tela com a aparencia certa, mas nao
      // navega. Botao que abre conversa com numero inexistente e pior do que
      // botao que ainda nao abre.
      botoes.forEach(function (b) {
        b.setAttribute('href', '#');
        b.setAttribute('aria-disabled', 'true');
        b.setAttribute('title', 'Canal de WhatsApp em configuracao');
        b.style.opacity = '.55';
        b.style.cursor = 'default';
        b.addEventListener('click', function (ev) { ev.preventDefault(); });
      });
      $$('[data-zap-aviso]').forEach(function (a) { a.style.display = 'block'; });
    }
    var lgpd = $('#lgpd');
    if (lgpd && window.NATIIVA_LGPD) lgpd.textContent = window.NATIIVA_LGPD;
  })();

  if (tela === 'home') return;   // a home nao fala com o banco

  /* =========================================================================
     CLIENTE SUPABASE
     ========================================================================= */
  var sb = window.supabase.createClient(cfg.url, cfg.chave, { db: { schema: cfg.schema } });

  function lerMembro(colunas) {
    return sb.from('membros').select(colunas).limit(1)
      .then(function (r) { return r; })
      .catch(function (e) { return { error: { message: String(e && e.message || e) } }; });
  }

  function conferirMembro() {
    return lerMembro('nome, papel, ativo, liberado')
      .then(function (r) {
        // A coluna "liberado" so existe depois do 005. Se o site subir antes do
        // SQL, a consulta falha por coluna inexistente — e o aviso na tela diria
        // "o banco nao esta de pe", que e mentira e manda procurar no lugar
        // errado. Aqui ele tenta de novo sem a coluna, e o site funciona igual
        // ate o 005 rodar.
        var m = (r.error && ((r.error.message || '') + ' ' + (r.error.code || ''))) || '';
        if (r.error && /liberado|42703|PGRST204/i.test(m)) {
          return lerMembro('nome, papel, ativo');
        }
        return r;
      })
      .then(function (r) {
        if (r.error) {
          var m = (r.error.message || '') + ' ' + (r.error.code || '');
          // schema ausente ou nao exposto na API nao e o mesmo que sem
          // permissao, e a mensagem precisa dizer isso — senao a proxima pessoa
          // perde uma tarde procurando erro de senha.
          var det = (r.error.code ? '[' + r.error.code + '] ' : '')
                  + (r.error.message || '')
                  + (r.error.hint ? ' — ' + r.error.hint : '');
          if (/schema|does not exist|42P01|PGRST106|PGRST205|404/i.test(m)) {
            return { estado: 'banco_ausente', detalhe: det };
          }
          return { estado: 'erro', detalhe: det };
        }
        var linhas = r.data || [];
        if (!linhas.length || !linhas[0].ativo) return { estado: 'sem_acesso' };
        return { estado: 'ok', membro: linhas[0] };
      })
      .catch(function (e) { return { estado: 'erro', detalhe: String(e && e.message || e) }; });
  }

  /* =========================================================================
     LOGIN
     ========================================================================= */
  if (tela === 'login') {
    sb.auth.getSession().then(function (r) {
      if (r.data && r.data.session) ir('inicio.html');
    });

    var form = $('#form-entrar');
    var email = $('#email');
    var senha = $('#senha');
    var btn = form.querySelector('button[type=submit]');
    var erro = $('#erro');

    function mostrarErro(t) {
      erro.querySelector('p').textContent = t;
      erro.style.display = 'block';
    }

    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      erro.style.display = 'none';
      btn.disabled = true; btn.textContent = 'Entrando...';

      sb.auth.signInWithPassword({ email: email.value.trim(), password: senha.value })
        .then(function (r) {
          if (r.error) {
            btn.disabled = false; btn.textContent = 'Entrar';
            mostrarErro('E-mail e senha não bateram. Confere os dois e tenta de novo.');
            senha.value = ''; senha.focus();
            return;
          }
          // Entra pelo Inicio: quem loga quer saber onde parou, e nao
          // recomecar montando um recorte do zero.
          ir('inicio.html');
        });
    });

    // Esqueci a senha. Serve para dois casos que parecem um so: quem esqueceu,
    // e quem nunca teve senha — o login criado por link magico na area do
    // cliente da Vidalma existe, mas nao tem senha nenhuma. Nos dois, o caminho
    // e o mesmo: o Supabase manda um link, e senha.html recebe.
    $('#esqueci').addEventListener('click', function (ev) {
      ev.preventDefault();
      var alvo = email.value.trim();
      if (!alvo) {
        email.focus();
        mostrarErro('Escreve o e-mail primeiro, que eu mando o link para ele.');
        return;
      }
      erro.style.display = 'none';
      sb.auth.resetPasswordForEmail(alvo, { redirectTo: abs('senha.html') })
        .then(function (r) {
          // A resposta e a mesma existindo ou nao o e-mail, de proposito: senao
          // esta tela vira um jeito de descobrir quem e cliente.
          mostrarErro('Se esse e-mail tiver acesso, o link chega em menos de um '
                    + 'minuto. Olha o spam também.');
        });
    });
    return;
  }

  /* =========================================================================
     DEFINIR SENHA
     =========================================================================
     A pagina que o link de recuperacao abre. O supabase-js le o token do
     endereco sozinho e cria uma sessao temporaria; e ela que autoriza a troca. */
  if (tela === 'senha') {
    var conferindo = $('#conferindo');
    var pode = $('#pode');
    var semLink = $('#sem-link');
    var pronto = $('#pronto');
    var erroS = $('#erro');
    var decidido = false;

    function decidir(temSessao) {
      if (decidido) return;
      decidido = true;
      conferindo.style.display = 'none';
      (temSessao ? pode : semLink).style.display = 'flex';
    }

    sb.auth.onAuthStateChange(function (evento, sessao) {
      if (evento === 'PASSWORD_RECOVERY' || sessao) decidir(true);
    });
    // Rede de seguranca: se o evento nao vier (link ja usado, token vencido),
    // ninguem fica olhando "conferindo o link" para sempre.
    setTimeout(function () {
      sb.auth.getSession().then(function (r) { decidir(!!(r.data && r.data.session)); });
    }, 1500);

    $('#form-senha').addEventListener('submit', function (ev) {
      ev.preventDefault();
      var a = $('#senha').value, b = $('#senha2').value;
      erroS.style.display = 'none';
      if (a !== b) {
        erroS.querySelector('p').textContent = 'As duas senhas não são iguais.';
        erroS.style.display = 'block';
        return;
      }
      var botao = ev.target.querySelector('button');
      botao.disabled = true; botao.textContent = 'Salvando...';
      sb.auth.updateUser({ password: a }).then(function (r) {
        if (r.error) {
          botao.disabled = false; botao.textContent = 'Salvar senha';
          erroS.querySelector('p').textContent = r.error.message || 'Não consegui salvar.';
          erroS.style.display = 'block';
          return;
        }
        pode.style.display = 'none';
        pronto.style.display = 'flex';
      });
    });
    return;
  }

  /* =========================================================================
     AJUDA COMPARTILHADA ENTRE AS TELAS DE BASE
     ========================================================================= */
  function numero(n) {
    return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  }
  function escapar(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function param(nome) {
    var m = new RegExp('[?&]' + nome + '=([^&]*)').exec(location.search);
    return m ? decodeURIComponent(m[1]) : null;
  }
  function pintarRetrato(caixa, linhas) {
    if (!caixa) return;
    caixa.innerHTML = '';
    if (!linhas || !linhas.length) {
      var p = document.createElement('p');
      p.style.cssText = "font:400 14px 'Chivo';color:var(--cimento);margin:0";
      p.textContent = 'Nenhuma empresa atendida ainda.';
      caixa.appendChild(p);
      return;
    }
    linhas.sort(function (a, b) { return b.quantidade - a.quantidade; });
    linhas.forEach(function (r) {
      var d = document.createElement('div');
      d.className = 'resultado' + (r.encerra ? ' fecha' : '');
      d.innerHTML = '<b>' + r.quantidade + '</b><span>' + escapar(r.descricao || r.codigo) + '</span>';
      caixa.appendChild(d);
    });
  }
  // "há 3 dias", e nao "07/08/2026 14:22". Quem olha o painel quer saber se a
  // pessoa trabalhou hoje, nao a data exata.
  function quando(iso) {
    if (!iso) return 'nunca';
    var dif = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
    if (dif < 2) return 'agora';
    if (dif < 60) return 'há ' + dif + ' min';
    if (dif < 60 * 24) { var h = Math.floor(dif / 60); return 'há ' + h + (h === 1 ? ' hora' : ' horas'); }
    var d = Math.floor(dif / 60 / 24);
    if (d < 30) return 'há ' + d + (d === 1 ? ' dia' : ' dias');
    return new Date(iso).toLocaleDateString('pt-BR');
  }

  /* =========================================================================
     INICIO — o painel de cada um
     =========================================================================
     Tres blocos, e quais aparecem depende do papel:

       o seu trabalho    todo mundo
       bases             todo mundo
       a sua equipe      supervisor, admin e dono
       o estoque         supervisor, admin e dono

     A hierarquia nao e decidida aqui. natiiva.painel_usuario e uma view com
     security_invoker: ela devolve as linhas que a RLS deixa aquela pessoa ver,
     e mais nenhuma. Se esta tela pedir a equipe inteira sendo consultor, o
     banco devolve so a linha dela. Esconder o bloco e arrumacao, nao trava. */
  if (tela === 'inicio') {
    $('#sair').addEventListener('click', function () {
      sb.auth.signOut().then(function () { ir('login.html'); });
    });
    $('#aba-downloads').addEventListener('click', function () {
      avisar('Ainda não construído',
             'O histórico de downloads entra depois. Por enquanto o caminho é '
           + 'Filtrar base e criar uma base a partir do recorte.');
    });

    function pct(feito, total) {
      return total ? Math.round(feito * 100 / total) : 0;
    }

    function pintarMeu(p) {
      var empresas = Number(p.empresas || 0);
      var atendidas = Number(p.atendidas || 0);
      texto($('#m-bases'), numero(p.bases || 0));
      texto($('#m-empresas'), numero(empresas));
      texto($('#m-atendidas'), numero(atendidas));
      texto($('#m-pct'), pct(atendidas, empresas) + '%');
      texto($('#m-encerradas'), numero(p.encerradas || 0));
      texto($('#meu-quando'), 'Último atendimento: ' + quando(p.ultimo_atendimento));
    }

    function pintarBases(bases) {
      var caixa = $('#lista-bases');
      caixa.innerHTML = '';
      if (!bases.length) {
        caixa.style.display = 'none';
        $('#sem-bases').style.display = 'flex';
        return;
      }
      // As que ainda tem trabalho primeiro. A tela de inicio responde "o que
      // falta"; o que ja acabou tem a tela de Minhas bases.
      bases.sort(function (a, b) {
        var fa = Number(a.faltam || 0), fb = Number(b.faltam || 0);
        if ((fa > 0) !== (fb > 0)) return fa > 0 ? -1 : 1;
        return new Date(b.criada_em) - new Date(a.criada_em);
      });
      bases.slice(0, 6).forEach(function (b) {
        var feito = Number(b.atendidos || 0), total = Number(b.total || 0);
        var p = pct(feito, total);

        var linha = document.createElement('div');
        linha.className = 'b-linha';

        var nome = document.createElement('div');
        nome.className = 'b-nome';
        var bb = document.createElement('b'); bb.textContent = b.nome;
        var ss = document.createElement('span');
        ss.textContent = (b.descricao || 'Recorte sem descrição')
                       + (b.reservou ? ' · reservada' : '');
        nome.appendChild(bb); nome.appendChild(ss);

        var prog = document.createElement('div');
        prog.className = 'b-prog';
        var barra = document.createElement('div');
        barra.className = 'barra';
        var i = document.createElement('i');
        i.style.width = p + '%';
        if (p >= 100) i.className = 'fim';
        barra.appendChild(i);
        var leg = document.createElement('span');
        leg.textContent = numero(feito) + ' de ' + numero(total) + ' · ' + p + '%';
        prog.appendChild(barra); prog.appendChild(leg);

        var acao = document.createElement('div');
        acao.className = 'b-acao';
        var bt = document.createElement('a');
        bt.className = 'botao ' + (p >= 100 ? 'botao--borda-clara' : 'botao--brasa');
        bt.style.cssText = 'min-height:38px;padding:0 16px;font-size:14px';
        bt.href = 'atender.html?base=' + b.id;
        bt.textContent = p >= 100 ? 'Ver resultado' : 'Atender';
        acao.appendChild(bt);

        linha.appendChild(nome); linha.appendChild(prog); linha.appendChild(acao);
        caixa.appendChild(linha);
      });
    }

    function pintarEquipe(equipe) {
      var caixa = $('#equipe');
      caixa.innerHTML = '';
      equipe.sort(function (a, b) {
        return Number(b.atendidas || 0) - Number(a.atendidas || 0);
      });
      equipe.forEach(function (p) {
        var empresas = Number(p.empresas || 0), atendidas = Number(p.atendidas || 0);
        var linha = document.createElement('div');
        linha.className = 'e-linha';

        var quem = document.createElement('div');
        quem.className = 'e-nome';
        var b = document.createElement('b'); b.textContent = p.nome || p.email;
        var s = document.createElement('span');
        s.textContent = (p.papel === 'SUPERVISOR' ? 'Supervisor' : 'Consultor')
                      + (p.ativo ? '' : ' · sem entrada');
        quem.appendChild(b); quem.appendChild(s);
        linha.appendChild(quem);

        [numero(p.bases || 0), numero(empresas), numero(atendidas),
         pct(atendidas, empresas) + '%'].forEach(function (v) {
          var d = document.createElement('div');
          d.className = 'e-num';
          d.textContent = v;
          linha.appendChild(d);
        });

        var q = document.createElement('div');
        q.className = 'e-quando';
        q.textContent = quando(p.ultimo_atendimento);
        linha.appendChild(q);

        caixa.appendChild(linha);
      });
      texto($('#equipe-resumo'), equipe.length
        ? equipe.length + (equipe.length === 1 ? ' pessoa' : ' pessoas') + ' respondendo a você'
        : 'Ninguém aponta para você ainda — defina isso em Acessos.');
    }

    function pintarEstoque(e) {
      texto($('#e-disp'),  numero(e.disponiveis || 0));
      texto($('#e-res'),   numero(e.reservados || 0));
      texto($('#e-ent'),   numero(e.entregues || 0));
      texto($('#e-tot'),   numero(e.total || 0));
      texto($('#e-score'), e.score_medio == null ? '—' : e.score_medio);
      $('#bloco-estoque').style.display = 'flex';
    }

    sb.auth.getSession().then(function (r) {
      if (!(r.data && r.data.session)) { ir('login.html'); return; }
      var meuId = r.data.session.user.id;

      return conferirMembro().then(function (res) {
        if (res.estado === 'sem_acesso') {
          return sb.auth.signOut().then(function () { ir('login.html'); });
        }
        $('#carregando').style.display = 'none';
        if (res.estado !== 'ok') { ir('app.html'); return; }

        var m = res.membro;
        var manda = ['DONO', 'ADMIN', 'SUPERVISOR'].indexOf(m.papel) >= 0;
        var primeiroNome = (m.nome || '').trim().split(/\s+/)[0];

        texto($('#conta'), m.nome || '');
        texto($('#sair'), (m.nome || '?').trim().charAt(0).toUpperCase());
        texto($('#saudacao'), primeiroNome ? 'Olá, ' + primeiroNome : 'Olá');
        texto($('#explica'),
          m.papel === 'DONO' || m.papel === 'ADMIN'
            ? 'Você vê tudo: as suas bases, as de todo mundo e o estoque inteiro da Natiiva.'
          : m.papel === 'SUPERVISOR'
            ? 'Aqui ficam as suas bases e os números de quem responde a você.'
            : 'Aqui ficam as suas bases e o quanto de cada uma já foi atendido.');
        if (['DONO', 'ADMIN'].indexOf(m.papel) >= 0) {
          $('#aba-acessos').style.display = 'inline-flex';
        }
        $('#conteudo').style.display = 'flex';

        // As bases vem de bases_resumo, que existe desde o 007. Este pedaco da
        // tela funciona mesmo sem o 010 ter rodado.
        sb.from('bases_resumo').select('*').then(function (rb) {
          if (rb.error) {
            $('#lista-bases').style.display = 'none';
            $('#sem-bases').style.display = 'flex';
            return;
          }
          pintarBases((rb.data || []).filter(function (b) {
            return b.criada_por === meuId;
          }));
        });

        return sb.from('painel_usuario').select('*').then(function (rp) {
          if (rp.error) {
            // A view so existe depois do 010. Dizer isso e melhor do que
            // mostrar cinco tracos e deixar a pessoa achando que nao trabalhou.
            $('#aviso-010').style.display = 'block';
            $('#bloco-meu').style.display = 'none';
            return;
          }
          var linhas = rp.data || [];
          var eu = linhas.filter(function (p) { return p.usuario_id === meuId; })[0];
          if (eu) pintarMeu(eu);

          if (manda) {
            var equipe = linhas.filter(function (p) { return p.usuario_id !== meuId; });
            // Dono e admin enxergam todo mundo pela RLS. Mostrar a casa inteira
            // como "a sua equipe" seria mentira de rotulo, mas esconder seria
            // pior: e justamente o que o dono pediu para ver.
            if (equipe.length) {
              $('#bloco-equipe').style.display = 'flex';
              pintarEquipe(equipe);
            }
            sb.rpc('painel_estoque').then(function (re) {
              if (re.error) return;   // sem permissao ou sem o 010: bloco fica fora
              var e = Array.isArray(re.data) ? re.data[0] : re.data;
              if (e) pintarEstoque(e);
            });
          }
        });
      });
    });
    return;
  }

  /* =========================================================================
     MINHAS BASES
     ========================================================================= */
  if (tela === 'bases') {
    $('#sair').addEventListener('click', function () {
      sb.auth.signOut().then(function () { ir('login.html'); });
    });
    var abaDown = $('#aba-downloads');
    if (abaDown) abaDown.addEventListener('click', function () {
      avisar('Ainda não construído',
             'O histórico de downloads entra depois. Por enquanto o caminho é '
           + 'Filtrar base e criar uma base a partir do recorte.');
    });

    function pintarBase(b, resultados) {
      var art = document.createElement('article');
      art.className = 'base';

      var feito = Number(b.atendidos || 0);
      var total = Number(b.total || 0);
      var pct = total ? Math.round(feito * 100 / total) : 0;

      var topo = document.createElement('div');
      topo.className = 'base-topo';
      topo.innerHTML =
        '<div style="min-width:0"><h2>' + escapar(b.nome) + '</h2>'
        + '<p class="base-sub">' + escapar(b.descricao || 'Recorte sem descrição')
        + (b.reservou ? ' · <strong style="font-weight:600;color:var(--brasa)">reservada</strong>' : '')
        + '</p></div>';
      var acao = document.createElement('div');
      acao.style.cssText = 'display:flex;gap:10px;flex-wrap:wrap';
      var btn = document.createElement('a');
      btn.className = feito >= total && total > 0 ? 'botao botao--invertido' : 'botao botao--brasa';
      btn.href = 'atender.html?base=' + b.id;
      btn.textContent = feito >= total && total > 0 ? 'Ver resultado' : 'Atender base';
      acao.appendChild(btn);
      topo.appendChild(acao);
      art.appendChild(topo);

      var barra = document.createElement('div');
      barra.className = 'barra';
      var i = document.createElement('i');
      i.style.width = pct + '%';
      if (pct >= 100) i.className = 'fim';
      barra.appendChild(i);
      art.appendChild(barra);

      var nums = document.createElement('div');
      nums.className = 'numeros-base';
      nums.innerHTML =
        '<div><b>' + numero(total) + '</b><span>empresas</span></div>'
        + '<div><b>' + numero(feito) + '</b><span>atendidas</span></div>'
        + '<div><b class="latao">' + pct + '%</b><span>do caminho</span></div>';
      art.appendChild(nums);

      var retrato = document.createElement('div');
      retrato.className = 'retrato';
      pintarRetrato(retrato, resultados);
      art.appendChild(retrato);
      return art;
    }

    sb.auth.getSession().then(function (r) {
      if (!(r.data && r.data.session)) { ir('login.html'); return; }
      return conferirMembro().then(function (res) {
        $('#carregando').style.display = 'none';
        if (res.estado !== 'ok') { ir('app.html'); return; }
        texto($('#conta'), res.membro.nome || '');
        texto($('#sair'), (res.membro.nome || '?').trim().charAt(0).toUpperCase());
        if (['DONO', 'ADMIN'].indexOf(res.membro.papel) >= 0) {
          $('#aba-acessos').style.display = 'inline-flex';
        }
        $('#conteudo').style.display = 'flex';

        return Promise.all([
          sb.from('bases_resumo').select('*').order('criada_em', { ascending: false }),
          sb.from('base_resultado').select('*')
        ]).then(function (rs) {
          var bases = (rs[0].data || []);
          var resultados = (rs[1].data || []);
          if (!bases.length) { $('#vazio').style.display = 'flex'; return; }
          var caixa = $('#lista');
          bases.forEach(function (b) {
            caixa.appendChild(pintarBase(b, resultados.filter(function (x) {
              return x.base_id === b.id;
            })));
          });
        });
      });
    });
    return;
  }

  /* =========================================================================
     ATENDER A BASE
     ========================================================================= */
  if (tela === 'atender') {
    var idBase = Number(param('base'));
    var atual = null, codigoEscolhido = null, codigos = [];

    $('#sair').addEventListener('click', function () {
      sb.auth.signOut().then(function () { ir('login.html'); });
    });

    function dinheiroBR(v) {
      if (v == null) return '—';
      return 'R$ ' + Number(v).toLocaleString('pt-BR', { maximumFractionDigits: 0 });
    }

    function pintarCodigos() {
      var caixa = $('#codigos');
      caixa.innerHTML = '';
      codigos.forEach(function (c) {
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'chip-tab';
        b.setAttribute('aria-pressed', 'false');
        b.innerHTML = escapar(c.descricao)
          + (c.encerra ? '<small>encerra a empresa</small>' : '');
        b.addEventListener('click', function () {
          codigoEscolhido = c.codigo;
          $$('.chip-tab', caixa).forEach(function (o) {
            o.setAttribute('aria-pressed', o === b ? 'true' : 'false');
          });
          $('#btn-salvar').disabled = false;
        });
        caixa.appendChild(b);
      });
    }

    function progresso() {
      return sb.from('bases_resumo').select('*').eq('id', idBase).then(function (r) {
        var b = (r.data || [])[0];
        if (!b) return null;
        texto($('#base-nome'), b.nome);
        texto($('#base-desc'), b.descricao || '');
        var feito = Number(b.atendidos || 0), total = Number(b.total || 0);
        texto($('#prog-num'), numero(feito) + ' de ' + numero(total));
        $('#prog-barra').style.width = (total ? Math.round(feito * 100 / total) : 0) + '%';
        return b;
      });
    }

    function retrato() {
      return sb.from('base_resultado').select('*').eq('base_id', idBase)
        .then(function (r) {
          pintarRetrato($('#retrato'), r.data || []);
          pintarRetrato($('#retrato-fim'), r.data || []);
        });
    }

    function proxima() {
      $('#msg').textContent = '';
      return sb.from('base_fila').select('*').eq('base_id', idBase)
        .is('atendido_em', null).order('ordem').limit(1)
        .then(function (r) {
          if (r.error) { $('#msg').textContent = 'Não consegui ler a base: ' + r.error.message; return; }
          var l = (r.data || [])[0];
          $('#carregando').style.display = 'none';
          if (!l) {
            atual = null;
            $('#atender').style.display = 'none';
            $('#acabou').style.display = 'flex';
            return;
          }
          atual = l;
          $('#acabou').style.display = 'none';
          $('#atender').style.display = 'flex';

          texto($('#posicao'), 'Empresa ' + l.ordem);
          texto($('#razao'), l.razao_social || '—');
          texto($('#onde'), [l.nome_fantasia, (l.cidade || '') + '/' + (l.uf || ''), l.bairro]
                            .filter(Boolean).join(' · '));
          texto($('#score'), l.score);
          $('#score-barra').style.width = Math.max(0, Math.min(100, l.score)) + '%';

          var tel = $('#tel');
          if (l.telefone_1) {
            tel.textContent = l.telefone_1;
            // No celular o telefone vira toque para discar. No computador nao
            // faz nada de ruim.
            tel.href = 'tel:' + l.telefone_1.replace(/\D/g, '');
          } else {
            tel.textContent = 'Sem telefone';
            tel.removeAttribute('href');
          }
          texto($('#tel2'), l.telefone_2 ? 'ou ' + l.telefone_2 : '');
          texto($('#email'), l.email || '—');
          texto($('#cnpj'), l.cnpj);
          texto($('#endereco'), l.endereco || '—');
          texto($('#porte'), l.porte || '—');
          texto($('#capital'), dinheiroBR(l.capital_social));
          texto($('#quem'), l.quem_procurar || '—');
          texto($('#dor'), l.dor_provavel || '—');
          texto($('#frase'), l.frase_abertura || '—');
          texto($('#setor'), l.setor ? 'Setor traduzido: ' + l.setor : '');

          codigoEscolhido = null;
          $('#contato').value = '';
          $('#obs').value = '';
          $('#btn-salvar').disabled = true;
          $$('.chip-tab').forEach(function (o) { o.setAttribute('aria-pressed', 'false'); });
          window.scrollTo(0, 0);
        });
    }

    $('#btn-salvar').addEventListener('click', function () {
      if (!atual || !codigoEscolhido) return;
      var botao = $('#btn-salvar');
      botao.disabled = true;
      botao.textContent = 'Salvando...';
      sb.rpc('tabular', {
        p_base: idBase, p_cnpj: atual.cnpj, p_codigo: codigoEscolhido,
        p_contato: $('#contato').value, p_observacao: $('#obs').value
      }).then(function (r) {
        botao.textContent = 'Salvar e ir para a próxima';
        if (r.error) {
          botao.disabled = false;
          $('#msg').textContent = 'Não consegui salvar: ' + r.error.message;
          return;
        }
        return Promise.all([proxima(), progresso(), retrato()]);
      });
    });

    // Pular manda para o fim da fila, nao tabula. Empresa que nao atendeu
    // agora pode atender depois, e nao vira estatistica de nada.
    //
    // Pergunta antes porque a tela some no clique: a empresa que estava a
    // vista vai para o fim de uma fila de dezenas, e quem clicou sem querer
    // nao tem como voltar nela — nao ha botao de desfazer aqui.
    $('#btn-pular').addEventListener('click', function () {
      if (!atual) return;
      perguntar({
        titulo: 'Pular esta empresa?',
        texto: (atual.razao_social || 'Esta empresa')
             + ' vai para o fim da fila e você a atende depois. '
             + 'Nada é tabulado: ela não entra em nenhum resultado da base.',
        ok: 'Pular e ir para a próxima',
        cancelar: 'Continuar nesta'
      }).then(function (sim) {
        if (!sim) return;
        sb.from('base_leads')
          .update({ ordem: 999999 + (atual.ordem || 0) })
          .eq('base_id', idBase).eq('lead_cnpj', atual.cnpj)
          .then(function (r) {
            if (r.error) { $('#msg').textContent = 'Não consegui pular: ' + r.error.message; return; }
            return proxima();
          });
      });
    });

    sb.auth.getSession().then(function (r) {
      if (!(r.data && r.data.session)) { ir('login.html'); return; }
      if (!idBase) { ir('bases.html'); return; }
      return conferirMembro().then(function (res) {
        if (res.estado !== 'ok') { ir('app.html'); return; }
        texto($('#conta'), res.membro.nome || '');
        texto($('#sair'), (res.membro.nome || '?').trim().charAt(0).toUpperCase());
        if (['DONO', 'ADMIN'].indexOf(res.membro.papel) >= 0) {
          $('#aba-acessos').style.display = 'inline-flex';
        }
        return sb.from('tabulacao_codigos').select('*').order('codigo')
          .then(function (rc) {
            codigos = rc.data || [];
            pintarCodigos();
            return Promise.all([proxima(), progresso(), retrato()]);
          });
      });
    });
    return;
  }

  /* =========================================================================
     GESTAO DE ACESSOS
     =========================================================================
     Tudo aqui e protegido no banco antes de ser protegido na tela: a RLS de
     natiiva.membros so deixa admin ler e escrever as linhas dos outros. Se
     alguem abrir esta pagina sem ser admin, a lista volta com a propria linha
     e as gravacoes sao recusadas. Esconder a tela e cortesia, nao seguranca. */
  if (tela === 'gestao') {
    // Cinco papeis, e a ordem aqui e a da hierarquia. COMERCIAL sai da lista de
    // escolha — o 010 renomeou os que existiam para CONSULTOR — mas continua
    // aceito pelo banco, entao uma linha antiga que ainda esteja assim aparece
    // com o nome dela em vez de cair para o primeiro item da lista.
    var PAPEIS = [
      { valor: 'DONO',       nome: 'Dono',       resumo: 'Tudo. Vê o estoque inteiro e administra acessos.' },
      { valor: 'ADMIN',      nome: 'Admin',      resumo: 'Administra acessos e vê o estoque.' },
      { valor: 'SUPERVISOR', nome: 'Supervisor', resumo: 'Vê os números dos consultores abaixo dele.' },
      { valor: 'CONSULTOR',  nome: 'Consultor',  resumo: 'Cria e atende as próprias bases.' },
      { valor: 'CLIENTE',    nome: 'Cliente',    resumo: 'Usa a base que você liberar.' }
    ];
    function nomeDoPapel(v) {
      for (var i = 0; i < PAPEIS.length; i++) if (PAPEIS[i].valor === v) return PAPEIS[i].nome;
      return v ? v.charAt(0) + v.slice(1).toLowerCase() : '';
    }
    // Preenchida pelo listar(): quem pode receber consultor embaixo.
    var chefes = [];

    $('#sair').addEventListener('click', function () {
      sb.auth.signOut().then(function () { ir('login.html'); });
    });
    $$('#aba-listas, #aba-downloads').forEach(function (b) {
      b.addEventListener('click', function () {
        avisar('Ainda não construído',
               'O histórico de downloads entra depois. Por enquanto o caminho é '
             + 'Filtrar base e criar uma base a partir do recorte.');
      });
    });

    function pintarPessoa(p) {
      var linha = document.createElement('div');
      linha.className = 'pessoa';

      var quem = document.createElement('div');
      quem.className = 'pessoa-nome';
      var b = document.createElement('b'); b.textContent = p.nome || '(sem nome)';
      var s = document.createElement('span'); s.textContent = p.email || '';
      quem.appendChild(b); quem.appendChild(s);

      var papel = document.createElement('div');
      papel.style.cssText = 'width:130px;flex:none';
      var sel = document.createElement('select');
      sel.className = 'campo-sel';
      sel.style.cssText = 'padding:7px 8px;font-size:13px';
      sel.setAttribute('aria-label', 'Papel de ' + (p.nome || p.email));
      var listaPapeis = PAPEIS.slice();
      if (p.papel && !listaPapeis.some(function (x) { return x.valor === p.papel; })) {
        listaPapeis.push({ valor: p.papel, nome: nomeDoPapel(p.papel) });
      }
      listaPapeis.forEach(function (x) {
        var o = document.createElement('option');
        o.value = x.valor; o.textContent = x.nome;
        if (x.valor === p.papel) o.selected = true;
        sel.appendChild(o);
      });
      sel.addEventListener('change', function () {
        gravar(p.usuario_id, { papel: sel.value }, function (ok) {
          if (ok) listar();   // trocar de papel muda quem pode ser chefe de quem
        });
      });
      papel.appendChild(sel);

      // A quem esta pessoa responde. Só faz sentido para quem opera: dono,
      // admin e cliente não entram em equipe.
      var chefe = document.createElement('div');
      chefe.style.cssText = 'width:170px;flex:none';
      if (p.papel === 'CONSULTOR' || p.papel === 'COMERCIAL' || p.papel === 'SUPERVISOR') {
        var selC = document.createElement('select');
        selC.className = 'campo-sel';
        selC.style.cssText = 'padding:7px 8px;font-size:13px';
        selC.setAttribute('aria-label', 'Supervisor de ' + (p.nome || p.email));
        var vazio = document.createElement('option');
        vazio.value = ''; vazio.textContent = 'Sem supervisor';
        selC.appendChild(vazio);
        chefes.forEach(function (c) {
          // Ninguem responde a si mesmo, e isso nao e detalhe de tela: a view
          // do painel juntaria a pessoa com ela mesma e o numero dobraria.
          if (c.usuario_id === p.usuario_id) return;
          var o = document.createElement('option');
          o.value = c.usuario_id;
          o.textContent = c.nome || c.email;
          if (c.usuario_id === p.supervisor_id) o.selected = true;
          selC.appendChild(o);
        });
        selC.addEventListener('change', function () {
          gravar(p.usuario_id, { supervisor_id: selC.value || null });
        });
        chefe.appendChild(selC);
      } else {
        var traco = document.createElement('span');
        traco.style.cssText = "font:400 13px 'Chivo';color:var(--cimento)";
        traco.textContent = '—';
        chefe.appendChild(traco);
      }

      linha.appendChild(quem);
      linha.appendChild(papel);
      linha.appendChild(chefe);
      linha.appendChild(chave(p, 'ativo', 'Entra', 110));
      linha.appendChild(chave(p, 'liberado', 'Vê contato', 130));

      // Remover e diferente de desligar: desligar bloqueia na hora e guarda o
      // historico; remover apaga a linha. Na duvida, desligue.
      var fim = document.createElement('div');
      fim.style.cssText = 'width:90px;flex:none';
      var rm = document.createElement('button');
      rm.type = 'button';
      rm.style.cssText = "background:none;border:0;padding:0;cursor:pointer;"
                       + "font:400 13px 'Chivo';color:var(--brasa);text-decoration:underline";
      rm.textContent = 'Remover';
      rm.addEventListener('click', function () {
        perguntar({
          titulo: 'Remover o acesso de ' + (p.nome || p.email) + '?',
          tom: 'cuidado',
          texto: 'O login continua existindo — só o acesso à Natiiva sai. '
               + 'Se for temporário, desligue "Entra" em vez de remover: '
               + 'a chave bloqueia na hora e guarda o histórico do que a pessoa fez.',
          ok: 'Remover mesmo assim',
          cancelar: 'Deixar como está'
        }).then(function (sim) {
          if (!sim) return;
          sb.rpc('remover_membro', { p_email: p.email }).then(function (r) {
            if (r.error) { avisar('Não consegui remover', r.error.message); return; }
            listar();
          });
        });
      });
      fim.appendChild(rm);
      linha.appendChild(fim);
      return linha;
    }

    function chave(p, campo, rotulo, largura) {
      var env = document.createElement('div');
      env.style.cssText = 'width:' + largura + 'px;flex:none';
      var lab = document.createElement('label');
      lab.className = 'chave';
      var inp = document.createElement('input');
      inp.type = 'checkbox';
      inp.checked = !!p[campo];
      inp.setAttribute('aria-label', rotulo + ' — ' + (p.nome || p.email));
      var i = document.createElement('i');
      var txt = document.createElement('span');
      function rotular() { txt.textContent = inp.checked ? 'Sim' : 'Não'; }
      rotular();
      inp.addEventListener('change', function () {
        rotular();
        var mudanca = {};
        mudanca[campo] = inp.checked;
        gravar(p.usuario_id, mudanca, function (ok) {
          if (!ok) { inp.checked = !inp.checked; rotular(); }
        });
      });
      lab.appendChild(inp); lab.appendChild(i); lab.appendChild(txt);
      env.appendChild(lab);
      return env;
    }

    function gravar(id, mudanca, depois) {
      sb.from('membros').update(mudanca).eq('usuario_id', id).then(function (r) {
        if (r.error) {
          avisar('Não consegui salvar', r.error.message || 'O banco recusou a mudança.');
          if (depois) depois(false);
          return;
        }
        if (depois) depois(true);
      });
    }

    function listar() {
      return sb.from('membros')
        .select('usuario_id, nome, email, papel, ativo, liberado, supervisor_id')
        .order('papel').order('nome')
        .then(function (r) {
          // supervisor_id so existe depois do 010. Sem esta segunda tentativa,
          // subir o site antes de rodar o SQL deixaria a tela de acessos vazia
          // com uma mensagem que manda procurar no lugar errado.
          var m = (r.error && ((r.error.message || '') + ' ' + (r.error.code || ''))) || '';
          if (r.error && /supervisor_id|42703|PGRST204/i.test(m)) {
            semHierarquia = true;
            return sb.from('membros')
              .select('usuario_id, nome, email, papel, ativo, liberado')
              .order('papel').order('nome');
          }
          return r;
        })
        .then(function (r) {
          if (r.error) { avisar('Não consegui ler a lista', r.error.message); return; }
          var pessoas = r.data || [];

          // Quem pode ter gente embaixo. Consultor nao chefia consultor: dois
          // niveis bastam, e mais niveis so aparecem quando alguem precisar.
          chefes = pessoas.filter(function (p) {
            return p.ativo && ['DONO', 'ADMIN', 'SUPERVISOR'].indexOf(p.papel) >= 0;
          });

          var caixa = $('#pessoas');
          caixa.innerHTML = '';
          pessoas.forEach(function (p) { caixa.appendChild(pintarPessoa(p)); });

          var ativos = pessoas.filter(function (p) { return p.ativo; }).length;
          texto($('#resumo-acessos'),
                pessoas.length + ' cadastrados · ' + ativos + ' com entrada liberada');

          // O seletor de supervisor do formulario de criar usa a mesma lista.
          var selNovo = $('#novo-supervisor');
          if (selNovo) {
            var antes = selNovo.value;
            selNovo.innerHTML = '';
            var vazio = document.createElement('option');
            vazio.value = ''; vazio.textContent = 'Sem supervisor';
            selNovo.appendChild(vazio);
            chefes.forEach(function (c) {
              var o = document.createElement('option');
              o.value = c.usuario_id; o.textContent = c.nome || c.email;
              selNovo.appendChild(o);
            });
            selNovo.value = antes;
          }
          if (semHierarquia) $('#aviso-010').style.display = 'block';
          ajustarSupervisor();
        });
    }
    var semHierarquia = false;

    // Supervisor so entra na conversa para quem opera. Perguntar a quem um
    // cliente responde nao significa nada.
    function ajustarSupervisor() {
      var papel = $('#novo-papel').value;
      var mostra = !semHierarquia && (papel === 'CONSULTOR' || papel === 'SUPERVISOR');
      $('#campo-supervisor').style.display = mostra ? 'flex' : 'none';
    }
    $('#novo-papel').addEventListener('change', ajustarSupervisor);

    // A chavinha do formulario de criar
    (function () {
      var c = $('#novo-liberado');
      c.addEventListener('change', function () {
        c.parentNode.querySelector('span').textContent = c.checked ? 'Sim' : 'Não';
      });
    })();

    function senhaSorteada() {
      // Sem 0/O/1/l/I: senha e ditada por telefone e lida em papel.
      var alfabeto = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
      var n = new Uint32Array(12);
      (window.crypto || window.msCrypto).getRandomValues(n);
      return Array.prototype.map.call(n, function (x) {
        return alfabeto[x % alfabeto.length];
      }).join('');
    }

    $('#btn-gerar').addEventListener('click', function () {
      $('#nova-senha').value = senhaSorteada();
    });

    // Criar o login e liberar o acesso, numa acao so.
    //
    // Quem cria o login e o BANCO, pela funcao natiiva.criar_acesso (sql/011),
    // e nao o cadastro publico do Supabase. Dois motivos:
    //
    // O cadastro publico so funciona com "Allow new users to sign up" ligado, e
    // ele precisa ficar desligado — este banco de autenticacao e o mesmo da area
    // do cliente da Vidalma, e liga-lo deixaria qualquer pessoa da internet
    // criar conta ali. Com ele desligado, a resposta era "Signups not allowed
    // for this instance".
    //
    // E a API de administracao, que seria o outro caminho, exige a chave
    // service_role — que abre o banco inteiro e nunca pode chegar ao navegador.
    //
    // A funcao no banco resolve os dois: roda com poder de dono, mas a primeira
    // linha dela confere se quem chamou e admin.
    //
    // O cadastro publico fica como plano B, para o caso de o site subir antes de
    // o 011 rodar. A ordem e: funcao primeiro, cadastro publico depois.
    //
    // A segunda conexao existe porque o cadastro publico entra automaticamente
    // com quem acabou de se cadastrar. Sem guarda propria e sem gravar sessao,
    // criar um usuario derrubaria a sua e voce sairia do sistema a cada cadastro.
    var sbCadastro = window.supabase.createClient(cfg.url, cfg.chave, {
      auth: { storageKey: 'natiiva-cadastro', persistSession: false,
              autoRefreshToken: false, detectSessionInUrl: false }
    });

    // Plano B: o caminho antigo, que depende do cadastro publico estar ligado.
    function criarPeloCadastroPublico(email, nome, senha, papel, liberado, chefe) {
      return sbCadastro.auth.signUp({ email: email, password: senha })
        .then(function (r) {
          var m = (r.error && r.error.message || '').toLowerCase();
          if (r.error && /signup|sign up|not allowed|disabled/.test(m)) {
            throw new Error('SEM_CADASTRO_PUBLICO');
          }
          // "ja cadastrado" nao e erro: e quem ja tem login da area do cliente
          // da Vidalma e so precisa do acesso a Natiiva.
          if (r.error && !/already|registered|exists/.test(m)) {
            throw new Error(r.error.message);
          }
          var arg = { p_email: email, p_nome: nome, p_papel: papel, p_liberado: liberado };
          if (chefe) arg.p_supervisor = chefe;
          return sb.rpc('liberar_membro', arg).then(function (rr) {
            // Antes do 010 a funcao no banco nao tem o parametro do supervisor,
            // e o PostgREST responde "funcao nao encontrada" em vez de ignorar
            // o argumento a mais.
            var m2 = (rr.error && ((rr.error.message || '') + ' ' + (rr.error.code || ''))) || '';
            if (rr.error && chefe && /PGRST202|does not exist|not find/i.test(m2)) {
              semHierarquia = true;
              return sb.rpc('liberar_membro', {
                p_email: email, p_nome: nome, p_papel: papel, p_liberado: liberado
              });
            }
            return rr;
          });
        })
        .then(function (r) {
          if (r.error) throw new Error(r.error.message);
          if (r.data === false) {
            throw new Error('O login foi criado, mas o Supabase ainda não o '
                          + 'confirmou. Espere alguns segundos e clique de novo.');
          }
          return { novo: true };
        });
    }

    $('#btn-liberar').addEventListener('click', function () {
      var email = $('#novo-email').value.trim();
      var nome = $('#novo-nome').value.trim();
      var senha = $('#nova-senha').value;
      var papel = $('#novo-papel').value;
      var liberado = $('#novo-liberado').checked;
      var chefe = (!semHierarquia && $('#campo-supervisor').style.display !== 'none')
                ? ($('#novo-supervisor').value || null) : null;
      var msg = $('#msg-novo');
      var botao = $('#btn-liberar');

      if (!email) { msg.textContent = 'Falta o e-mail.'; return; }
      if (!senha || senha.length < 8) {
        msg.textContent = 'A senha precisa de ao menos 8 caracteres. Use o Gerar.';
        return;
      }

      botao.disabled = true; botao.textContent = 'Criando...';
      msg.textContent = 'Criando o login...';
      $('#senha-pronta').style.display = 'none';

      var arg = {
        p_email: email, p_senha: senha, p_nome: nome,
        p_papel: papel, p_liberado: liberado
      };
      if (chefe) arg.p_supervisor = chefe;

      sb.rpc('criar_acesso', arg)
        .then(function (r) {
          if (!r.error) return { novo: !!(r.data && r.data.novo) };
          var m = (r.error.message || '') + ' ' + (r.error.code || '');
          // A funcao ainda nao existe: o 011 nao rodou. Cai para o caminho
          // antigo, que funciona se o cadastro publico estiver ligado.
          if (/PGRST202|does not exist|not find|schema cache/i.test(m)) {
            return criarPeloCadastroPublico(email, nome, senha, papel, liberado, chefe);
          }
          throw new Error(r.error.message);
        })
        .then(function (res) {
          botao.disabled = false; botao.textContent = 'Criar e liberar acesso';
          msg.textContent = '';
          texto($('#pronta-email'), email);
          // Para quem ja tinha login, mostrar a senha nova seria mentira: a
          // senha dela continua sendo a de antes, e de proposito — trocar
          // derrubaria o acesso dela na area do cliente da Vidalma.
          texto($('#pronta-senha'), (res && res.novo === false)
            ? 'a senha que ela já usa na Vidalma' : senha);
          $('#senha-pronta').style.display = 'flex';
          $('#novo-email').value = ''; $('#novo-nome').value = '';
          $('#nova-senha').value = '';
          listar();
        })
        .catch(function (e) {
          botao.disabled = false; botao.textContent = 'Criar e liberar acesso';
          var t = (e && e.message) || String(e);
          if (t === 'SEM_CADASTRO_PUBLICO') {
            t = 'o cadastro de novos logins está desligado no Supabase, e o '
              + 'arquivo sql/011_criar_login.sql ainda não foi rodado. Rode ele '
              + 'no SQL Editor e tente de novo — é ele que permite criar o login '
              + 'daqui sem ligar o cadastro público.';
          }
          msg.textContent = 'Não consegui: ' + t;
        });
    });

    sb.auth.getSession().then(function (r) {
      if (!(r.data && r.data.session)) { ir('login.html'); return; }
      return conferirMembro().then(function (res) {
        $('#carregando').style.display = 'none';
        if (res.estado !== 'ok') { ir('app.html'); return; }
        if (['DONO', 'ADMIN'].indexOf(res.membro.papel) < 0) {
          $('#sem-permissao').style.display = 'block';
          return;
        }
        texto($('#conta'), res.membro.nome || '');
        texto($('#sair'), (res.membro.nome || '?').trim().charAt(0).toUpperCase());
        $('#conteudo').style.display = 'flex';
        listar();
      });
    });
    return;
  }

  /* =========================================================================
     APLICACAO
     ========================================================================= */
  if (tela !== 'app') return;

  // Os dez setores do design, traduzidos para prefixo de CNAE. A traducao vive
  // aqui e no dicionario PLAYBOOK do LEADS.py — sao os mesmos prefixos.
  var SETORES = [
    { nome: 'Todos',              prefixos: null },
    { nome: 'Metalurgia',         prefixos: ['24'] },
    { nome: 'Alimentos',          prefixos: ['10', '11'] },
    { nome: 'Cimento e cerâmica', prefixos: ['23'] },
    { nome: 'Mineração',          prefixos: ['05', '06', '07', '08', '09'] },
    { nome: 'Plástico',           prefixos: ['22'] },
    { nome: 'Papel',              prefixos: ['17'] },
    { nome: 'Química',            prefixos: ['19', '20', '21'] },
    { nome: 'Têxtil',             prefixos: ['13', '14'] },
    { nome: 'Reciclagem',         prefixos: ['38'] },
    { nome: 'Transporte',         prefixos: ['49', '52'] }
  ];
  // As 27 unidades da federacao mais "EX", que a Receita usa para
  // estabelecimento no exterior e que existe na base.
  var UFS = ['AC', 'AL', 'AM', 'AP', 'BA', 'CE', 'DF', 'ES', 'EX', 'GO', 'MA',
             'MG', 'MS', 'MT', 'PA', 'PB', 'PE', 'PI', 'PR', 'RJ', 'RN', 'RO',
             'RR', 'RS', 'SC', 'SE', 'SP', 'TO'];

  var UNIDADES = [{ nome: 'Todos', valor: null },
                  { nome: 'Matriz', valor: 'Matriz' },
                  { nome: 'Filial', valor: 'Filial' }];

  var FAIXAS = [
    { nome: 'Todas',        valor: null },
    { nome: 'A · frota',    valor: 'A - Frota propria (entrega rapida)' },
    { nome: 'B · interior', valor: 'B - Interior SP (rota semanal)' },
    { nome: 'C · Sul/SE',   valor: 'C - Sudeste/Sul (transportadora)' },
    { nome: 'D · demais',   valor: 'D - Demais estados (transportadora)' }
  ];

  var CONTATOS = [{ nome: 'Todos', valor: null },
                  { nome: 'Com telefone', valor: 'tel' },
                  { nome: 'Com e-mail', valor: 'mail' },
                  { nome: 'Com os dois', valor: 'ambos' }];

  var SITUACOES = [{ nome: 'Todas', valor: null },
                   { nome: 'Disponível', valor: 'DISPONIVEL' },
                   { nome: 'Reservado', valor: 'RESERVADO' },
                   { nome: 'Entregue', valor: 'ENTREGUE' }];

  // Escala de capital social. Nao e linear de proposito: o intervalo que
  // separa uma oficina de uma fabrica esta embaixo, nao em cima.
  var CAPITAIS = [0, 10000, 50000, 100000, 250000, 500000,
                  1000000, 5000000, 10000000, 50000000, 100000000];
  // Os codigos de porte da Receita: 01 microempresa, 03 EPP, 05 demais.
  // O LEADS.py ja converte para texto; aqui so traduzimos o rotulo da tela.
  var PORTES = [
    { nome: 'Todos',   valor: null },
    { nome: 'Pequeno', valor: 'Microempresa' },
    { nome: 'Médio',   valor: 'EPP' },
    { nome: 'Grande',  valor: 'Demais (medio/grande)' }
  ];
  var TETO = 50;   // linhas por consulta

  // O score deixa de ser porta de entrada e vira mais um filtro: comeca em 0,
  // com a base inteira a vista. Quem quiser o corte premium sobe o controle.
  var estado = {
    setor: 'Todos', uf: 'Todos', cidade: '', porte: 'Todos',
    unidade: 'Todos', faixa: 'Todas', contato: 'Todos', situacao: 'Todas',
    minScore: 0, capitalIdx: 0, idadeMin: 0,
    aberto: null, liberado: false, admin: false
  };

  function dinheiro(v) {
    if (v >= 1000000) return 'R$ ' + (v / 1000000) + ' mi';
    if (v >= 1000) return 'R$ ' + (v / 1000) + ' mil';
    return 'R$ ' + v;
  }

  function chips(caixa, itens, campo) {
    caixa.innerHTML = '';
    itens.forEach(function (it) {
      var nome = it.nome !== undefined ? it.nome : it;
      var b = document.createElement('button');
      b.className = 'chip';
      b.type = 'button';
      b.textContent = nome;
      b.setAttribute('aria-pressed', estado[campo] === nome ? 'true' : 'false');
      b.addEventListener('click', function () {
        estado[campo] = nome;
        estado.aberto = null;   // senao a expansao fica orfa quando a linha sai
        $$('.chip', caixa).forEach(function (o) {
          o.setAttribute('aria-pressed', o.textContent === nome ? 'true' : 'false');
        });
        buscar();
      });
      caixa.appendChild(b);
    });
  }

  function prefixosAtuais() {
    var s = SETORES.filter(function (x) { return x.nome === estado.setor; })[0];
    return s ? s.prefixos : null;
  }
  function porteAtual() {
    var p = PORTES.filter(function (x) { return x.nome === estado.porte; })[0];
    return p ? p.valor : null;
  }

  function descreverRecorte() {
    var p = [];
    p.push(estado.setor === 'Todos' ? 'Toda a indústria' : estado.setor);
    if (estado.cidade) p.push('em ' + estado.cidade);
    else if (estado.uf !== 'Todos') p.push('em ' + estado.uf);
    if (estado.porte !== 'Todos') p.push('· porte ' + estado.porte.toLowerCase());
    if (estado.unidade !== 'Todos') p.push('· ' + estado.unidade.toLowerCase());
    if (estado.minScore > 0) p.push('· score ' + estado.minScore + '+');
    if (estado.capitalIdx > 0) p.push('· capital ' + dinheiro(CAPITAIS[estado.capitalIdx]) + '+');
    if (estado.idadeMin > 0) p.push('· ' + estado.idadeMin + '+ anos');
    if (estado.contato !== 'Todos') p.push('· ' + estado.contato.toLowerCase());
    if (estado.situacao !== 'Todas') p.push('· ' + estado.situacao.toLowerCase());
    return p.join(' ');
  }

  function valorDe(lista, nome) {
    var achado = lista.filter(function (x) { return x.nome === nome; })[0];
    return achado ? achado.valor : null;
  }

  // Data limite para "aberta ha mais de N anos". Calculada no navegador para
  // nao precisar de funcao no banco.
  function dataCorte(anos) {
    var d = new Date();
    d.setFullYear(d.getFullYear() - anos);
    return d.toISOString().slice(0, 10);
  }

  // Monta os filtros em cima de uma consulta. Usada nas duas: a das linhas e
  // a do resumo, para os dois nunca discordarem.
  function aplicarFiltros(q) {
    var pref = prefixosAtuais();
    if (pref) q = q.in('cnae_prefixo', pref);
    if (estado.uf !== 'Todos') q = q.eq('uf', estado.uf);
    if (estado.cidade) q = q.ilike('cidade', '%' + estado.cidade + '%');
    var porte = porteAtual();
    if (porte) q = q.eq('porte', porte);
    var unid = valorDe(UNIDADES, estado.unidade);
    if (unid) q = q.eq('tipo_unid', unid);
    var faixa = valorDe(FAIXAS, estado.faixa);
    if (faixa) q = q.eq('faixa_logistica', faixa);
    if (estado.minScore > 0) q = q.gte('score', estado.minScore);
    if (estado.capitalIdx > 0) q = q.gte('capital_social', CAPITAIS[estado.capitalIdx]);
    if (estado.idadeMin > 0) q = q.lte('abertura', dataCorte(estado.idadeMin));
    var ct = valorDe(CONTATOS, estado.contato);
    if (ct === 'tel' || ct === 'ambos') q = q.not('telefone_1', 'is', null);
    if (ct === 'mail' || ct === 'ambos') q = q.not('email', 'is', null);
    var sit = valorDe(SITUACOES, estado.situacao);
    if (sit) q = q.eq('status_base', sit);
    return q;
  }

  function montarLinha(l) {
    var envolucro = document.createElement('div');

    var b = document.createElement('button');
    b.className = 'linha';
    b.type = 'button';
    b.setAttribute('aria-expanded', estado.aberto === l.id ? 'true' : 'false');

    var esq = document.createElement('div');
    esq.className = 'col-empresa';
    var nome = document.createElement('div');
    nome.className = 'corta';
    nome.style.cssText = "font:600 14px/1.35 'Chivo';color:var(--ferro)";
    nome.textContent = l.razao_social || '—';
    var sob = document.createElement('div');
    sob.className = 'corta';
    sob.style.cssText = "font:400 13px/1.4 'Chivo';color:var(--cimento)";
    // Amostra mostra setor; liberado mostra o CNPJ.
    sob.textContent = (estado.liberado && l.cnpj ? l.cnpj : (l.setor || 'Setor não mapeado'))
                    + ' · ' + (l.cidade || '') + '/' + (l.uf || '');
    esq.appendChild(nome); esq.appendChild(sob);

    var meio = document.createElement('div');
    meio.className = 'col-contato corta';
    meio.textContent = l.telefone_1 || (l.email || '—');

    var dir = document.createElement('div');
    dir.className = 'col-score';
    var barra = document.createElement('span');
    barra.className = 'score-barra';
    var dentro = document.createElement('i');
    dentro.style.width = Math.max(0, Math.min(100, l.score)) + '%';
    barra.appendChild(dentro);
    var n = document.createElement('span');
    n.className = 'score-num';
    n.textContent = l.score;
    dir.appendChild(barra); dir.appendChild(n);

    b.appendChild(esq); b.appendChild(meio); b.appendChild(dir);
    b.addEventListener('click', function () {
      estado.aberto = estado.aberto === l.id ? null : l.id;
      desenhar();
    });
    envolucro.appendChild(b);

    if (estado.aberto === l.id) {
      var p = document.createElement('div');
      p.className = 'roteiro';
      p.innerHTML =
        campo('Quem decide a compra', l.quem_procurar) +
        campo('Dor provável', l.dor_provavel) +
        '<div class="roteiro-campo"><span class="rotulo rotulo--latao">Frase de abertura</span>' +
        '<p class="roteiro-frase"></p></div>' +
        '<div style="border-top:1px solid var(--divisoria-esc);padding-top:14px;' +
        'font:400 13px/1.5 \'Chivo\';color:var(--cimento)">Setor traduzido: ' +
        escapar(l.setor || 'não mapeado') + '</div>';
      p.querySelector('.roteiro-frase').textContent =
        l.frase_abertura || 'Disponível com o acesso liberado.';
      envolucro.appendChild(p);
    }
    return envolucro;
  }

  function campo(rotulo, valor) {
    return '<div class="roteiro-campo"><span class="rotulo rotulo--latao">' + rotulo +
           '</span><p>' + escapar(valor || '—') + '</p></div>';
  }
  var linhas = [];

  function desenhar() {
    var caixa = $('#linhas');
    caixa.innerHTML = '';
    linhas.forEach(function (l) { caixa.appendChild(montarLinha(l)); });
    $('#vazio').style.display = linhas.length ? 'none' : 'flex';
    texto($('#recorte-desc'), descreverRecorte());
  }

  var buscaPendente = null;

  function buscar() {
    texto($('#recorte-desc'), descreverRecorte());

    var fonte = estado.liberado ? 'leads_completo' : 'leads_amostra';

    aplicarFiltros(sb.from(fonte).select('*', { count: 'exact' }))
      .order('score', { ascending: false })
      .limit(TETO)
      .then(function (r) {
        if (r.error) {
          linhas = []; desenhar();
          texto($('#contagem'), 'Não consegui ler a base: ' + (r.error.message || ''));
          return;
        }
        linhas = (r.data || []).map(function (l, i) {
          // a view completa nao tem "id"; usamos o CNPJ, que e a chave
          if (!l.id) l.id = l.cnpj || String(i);
          return l;
        });
        desenhar();

        // O count vem do proprio PostgREST e vale para o recorte inteiro, nao
        // para as 50 linhas mostradas.
        var total = r.count;
        texto($('#vivo-total'), total != null ? numero(total) : '—');
        if (total != null) {
          texto($('#contagem'), total > TETO
            ? 'Mostrando as ' + TETO + ' primeiras de ' + numero(total) + ' empresas'
            : numero(total) + ' empresas neste recorte');
        }
        // Media do que esta a vista. Com a base inteira em jogo, calcular a
        // media de milhoes de linhas a cada clique sairia caro.
        var vis = linhas.filter(function (l) { return l.score != null; });
        texto($('#vivo-score'), vis.length
          ? Math.round(vis.reduce(function (s, l) { return s + Number(l.score); }, 0) / vis.length)
          : '—');
      });
  }

  // O usuario mexe em varios filtros seguidos. Sem esta espera, cada tecla
  // digitada na cidade viraria uma consulta.
  function buscarLogo() {
    estado.aberto = null;
    if (buscaPendente) clearTimeout(buscaPendente);
    buscaPendente = setTimeout(buscar, 280);
  }

  // ---- entrada da tela -----------------------------------------------------
  $('#sair').addEventListener('click', function () {
    sb.auth.signOut().then(function () { ir('login.html'); });
  });
  $$('#aba-listas, #aba-downloads').forEach(function (b) {
    b.addEventListener('click', function () {
      avisar('Ainda não construído',
             'O histórico de downloads entra depois. Por enquanto o caminho é '
           + 'montar o recorte aqui e clicar em Salvar recorte.');
    });
  });

  sb.auth.getSession().then(function (r) {
    if (!(r.data && r.data.session)) { ir('login.html'); return; }

    return conferirMembro().then(function (res) {
      if (res.estado === 'sem_acesso') {
        // Login valido, mas nao e da Natiiva. Encerra a sessao para o navegador
        // nao ficar achando que esta dentro.
        return sb.auth.signOut().then(function () { ir('login.html'); });
      }

      $('#carregando').style.display = 'none';

      if (res.estado !== 'ok') {
        // Mostra a mensagem crua do banco. Sem ela, todo problema de
        // configuracao vira o mesmo aviso, e o diagnostico vira chute.
        var cru = $('#erro-cru');
        if (cru && res.detalhe) { cru.textContent = res.detalhe; cru.style.display = 'block'; }
        $('#aviso-banco').style.display = 'block';
        return;
      }

      var m = res.membro;
      // Ver contato e decisao comercial, gravada em natiiva.membros.liberado.
      // Quem e da casa entra liberado por padrao; cliente depende da liberacao.
      estado.liberado = m.liberado === true
                     || ['DONO', 'ADMIN', 'COMERCIAL'].indexOf(m.papel) >= 0;

      texto($('#conta'), m.nome || '');
      texto($('#sair'), (m.nome || '?').trim().charAt(0).toUpperCase());
      $('#btn-cta').textContent = estado.liberado ? 'Baixar CSV' : 'Liberar acesso';
      $('#aviso-amostra').style.display = estado.liberado ? 'none' : 'block';
      $('#app-corpo').style.display = 'flex';

      estado.admin = ['DONO', 'ADMIN'].indexOf(m.papel) >= 0;

      chips($('#chips-setor'),   SETORES,   'setor');
      chips($('#chips-porte'),   PORTES,    'porte');
      chips($('#chips-unid'),    UNIDADES,  'unidade');
      chips($('#chips-faixa'),   FAIXAS,    'faixa');
      chips($('#chips-contato'), CONTATOS,  'contato');

      // Situacao comercial e a aba de acessos sao visao de quem administra.
      // Cliente nao precisa saber o que ja foi vendido para outro.
      if (estado.admin) {
        $('#grupo-status').style.display = 'flex';
        chips($('#chips-status'), SITUACOES, 'situacao');
        $('#aba-acessos').style.display = 'inline-flex';
      }

      var sel = $('#busca-uf');
      UFS.forEach(function (u) {
        var o = document.createElement('option');
        o.value = u;
        o.textContent = u === 'EX' ? 'EX · exterior' : u;
        sel.appendChild(o);
      });
      sel.addEventListener('change', function () {
        estado.uf = sel.value; buscarLogo();
      });

      var cid = $('#busca-cidade');
      cid.addEventListener('input', function () {
        estado.cidade = cid.value.trim(); buscarLogo();
      });

      var slider = $('#score');
      slider.addEventListener('input', function () {
        estado.minScore = Number(slider.value);
        texto($('#score-valor'), estado.minScore);
        buscarLogo();
      });

      var cap = $('#capital');
      cap.addEventListener('input', function () {
        estado.capitalIdx = Number(cap.value);
        texto($('#capital-valor'), dinheiro(CAPITAIS[estado.capitalIdx]));
        buscarLogo();
      });

      var idade = $('#idade');
      idade.addEventListener('input', function () {
        estado.idadeMin = Number(idade.value);
        texto($('#idade-valor'), estado.idadeMin + (estado.idadeMin === 1 ? ' ano' : ' anos'));
        buscarLogo();
      });

      // Salvar recorte = criar uma base. O filtro vai junto, mas o que manda e
      // a lista congelada: quem esta atendendo nao pode ver o chao se mexer.
      //
      // As tres perguntas numa caixa so. Em tres prompts seguidos, quem se
      // arrepende do nome na segunda pergunta so tem o botao de cancelar, e
      // perde as outras duas respostas junto.
      $('#btn-criar-base').addEventListener('click', function () {
        dialogo({
          titulo: 'Criar base a partir deste recorte',
          texto: 'A lista congela agora. Quem estiver atendendo não vai ver a '
               + 'base mudar embaixo dele — e é por isso que o progresso e o '
               + 'resultado dela significam alguma coisa.',
          ok: 'Criar base',
          cancelar: 'Voltar ao filtro',
          campos: [
            { id: 'nome', tipo: 'texto', rotulo: 'Nome desta base',
              valor: descreverRecorte(),
              ajuda: 'É o nome que a equipe vai ver na lista de bases.' },
            { id: 'quantos', tipo: 'numero', rotulo: 'Quantas empresas entram',
              valor: 60, minimo: 1, maximo: 5000,
              ajuda: 'As de maior score entram primeiro. 60 por vendedor por '
                   + 'semana é o tamanho sugerido.' },
            { id: 'reservar', tipo: 'escolha', rotulo: 'Reservar estas empresas',
              valor: false,
              opcoes: [
                { valor: false, titulo: 'Deixar disponíveis',
                  detalhe: 'Continuam na vitrine e podem entrar na base de outro cliente.' },
                { valor: true, titulo: 'Reservar para esta base',
                  detalhe: 'Somem da vitrine e das bases dos outros. É a opção de quem vendeu exclusividade.' }
              ] }
          ]
        }).then(function (resp) {
          if (!resp) return;
          var b = $('#btn-criar-base');
          b.disabled = true; b.textContent = 'Criando...';
          sb.rpc('criar_base', {
            p_nome: resp.nome,
            p_filtro: {
              prefixos: prefixosAtuais(), uf: estado.uf === 'Todos' ? null : estado.uf,
              cidade: estado.cidade || null, porte: porteAtual(),
              unidade: valorDe(UNIDADES, estado.unidade), faixa: valorDe(FAIXAS, estado.faixa),
              score: estado.minScore, capital: CAPITAIS[estado.capitalIdx],
              idade: estado.idadeMin, contato: valorDe(CONTATOS, estado.contato),
              descricao: descreverRecorte()
            },
            p_limite: resp.quantos,
            p_reservar: !!resp.reservar
          }).then(function (r) {
            b.disabled = false; b.textContent = 'Salvar recorte';
            if (r.error) { avisar('Não consegui criar a base', r.error.message); return; }
            location.href = 'atender.html?base=' + r.data;
          });
        });
      });


      $('#limpar').addEventListener('click', function () {
        estado.setor = 'Todos'; estado.uf = 'Todos'; estado.cidade = '';
        estado.porte = 'Todos'; estado.unidade = 'Todos'; estado.faixa = 'Todas';
        estado.contato = 'Todos'; estado.situacao = 'Todas';
        estado.minScore = 0; estado.capitalIdx = 0; estado.idadeMin = 0;
        sel.value = 'Todos'; cid.value = ''; slider.value = 0; cap.value = 0; idade.value = 0;
        texto($('#score-valor'), 0);
        texto($('#capital-valor'), 'R$ 0');
        texto($('#idade-valor'), '0 anos');
        [['#chips-setor', SETORES, 'setor'], ['#chips-porte', PORTES, 'porte'],
         ['#chips-unid', UNIDADES, 'unidade'], ['#chips-faixa', FAIXAS, 'faixa'],
         ['#chips-contato', CONTATOS, 'contato'], ['#chips-status', SITUACOES, 'situacao']
        ].forEach(function (c) { if ($(c[0])) chips($(c[0]), c[1], c[2]); });
        buscar();
      });

      buscar();
    });
  });
})();
