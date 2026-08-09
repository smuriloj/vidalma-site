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
      if (r.data && r.data.session) ir('app.html');
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
          ir('app.html');
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

  /* =========================================================================
     MINHAS BASES
     ========================================================================= */
  if (tela === 'bases') {
    $('#sair').addEventListener('click', function () {
      sb.auth.signOut().then(function () { ir('login.html'); });
    });
    var abaDown = $('#aba-downloads');
    if (abaDown) abaDown.addEventListener('click', function () {
      alert('Ainda não construído.');
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
    $('#btn-pular').addEventListener('click', function () {
      if (!atual) return;
      sb.from('base_leads')
        .update({ ordem: 999999 + (atual.ordem || 0) })
        .eq('base_id', idBase).eq('lead_cnpj', atual.cnpj)
        .then(function (r) {
          if (r.error) { $('#msg').textContent = 'Não consegui pular: ' + r.error.message; return; }
          return proxima();
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
    var PAPEIS = ['DONO', 'ADMIN', 'COMERCIAL', 'CLIENTE'];

    $('#sair').addEventListener('click', function () {
      sb.auth.signOut().then(function () { ir('login.html'); });
    });
    $$('#aba-listas, #aba-downloads').forEach(function (b) {
      b.addEventListener('click', function () {
        alert('Ainda não construído. Vem depois de a base estar carregada.');
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
      papel.style.cssText = 'width:120px;flex:none';
      var sel = document.createElement('select');
      sel.className = 'campo-sel';
      sel.style.cssText = 'padding:7px 8px;font-size:13px';
      PAPEIS.forEach(function (x) {
        var o = document.createElement('option');
        o.value = x; o.textContent = x.charAt(0) + x.slice(1).toLowerCase();
        if (x === p.papel) o.selected = true;
        sel.appendChild(o);
      });
      sel.addEventListener('change', function () {
        gravar(p.usuario_id, { papel: sel.value });
      });
      papel.appendChild(sel);

      linha.appendChild(quem);
      linha.appendChild(papel);
      linha.appendChild(chave(p, 'ativo', 'Entra', 150));
      linha.appendChild(chave(p, 'liberado', 'Vê contato', 180));

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
        if (!confirm('Remover o acesso de ' + (p.nome || p.email) + '?\n\n'
                   + 'O login continua existindo — so o acesso a Natiiva sai.\n'
                   + 'Se for temporario, desligue "Entra" em vez de remover.')) return;
        sb.rpc('remover_membro', { p_email: p.email }).then(function (r) {
          if (r.error) { alert('Nao consegui remover: ' + r.error.message); return; }
          listar();
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
          alert('Não consegui salvar: ' + (r.error.message || ''));
          if (depois) depois(false);
          return;
        }
        if (depois) depois(true);
      });
    }

    function listar() {
      sb.from('membros')
        .select('usuario_id, nome, email, papel, ativo, liberado')
        .order('papel').order('nome')
        .then(function (r) {
          if (r.error) { alert('Não consegui ler a lista: ' + r.error.message); return; }
          var pessoas = r.data || [];
          var caixa = $('#pessoas');
          caixa.innerHTML = '';
          pessoas.forEach(function (p) { caixa.appendChild(pintarPessoa(p)); });
          var ativos = pessoas.filter(function (p) { return p.ativo; }).length;
          texto($('#resumo-acessos'),
                pessoas.length + ' cadastrados · ' + ativos + ' com entrada liberada');
        });
    }

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
    // O login e criado pelo cadastro publico do Supabase, e nao pela API de
    // administracao: esta ultima exige a chave service_role, que abre o banco
    // inteiro e nunca pode chegar ao navegador.
    //
    // O cadastro usa uma segunda conexao, com guarda propria e sem gravar
    // sessao. Sem isso, criar um usuario derrubaria a sua sessao e voce sairia
    // do sistema a cada cadastro — o Supabase entra automaticamente com quem
    // acabou de se cadastrar.
    var sbCadastro = window.supabase.createClient(cfg.url, cfg.chave, {
      auth: { storageKey: 'natiiva-cadastro', persistSession: false,
              autoRefreshToken: false, detectSessionInUrl: false }
    });

    $('#btn-liberar').addEventListener('click', function () {
      var email = $('#novo-email').value.trim();
      var nome = $('#novo-nome').value.trim();
      var senha = $('#nova-senha').value;
      var papel = $('#novo-papel').value;
      var liberado = $('#novo-liberado').checked;
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

      sbCadastro.auth.signUp({ email: email, password: senha })
        .then(function (r) {
          // "ja cadastrado" nao e erro aqui: e o caso de quem ja tem login da
          // area do cliente da Vidalma e so precisa do acesso a Natiiva.
          var m = (r.error && r.error.message || '').toLowerCase();
          if (r.error && !/already|registered|exists/.test(m)) {
            throw new Error(r.error.message);
          }
          msg.textContent = 'Liberando o acesso...';
          return sb.rpc('liberar_membro', {
            p_email: email, p_nome: nome, p_papel: papel, p_liberado: liberado
          });
        })
        .then(function (r) {
          botao.disabled = false; botao.textContent = 'Criar e liberar acesso';
          if (r.error) { msg.textContent = 'Não consegui: ' + r.error.message; return; }
          if (r.data === false) {
            msg.textContent = 'O login foi criado, mas o Supabase ainda não o '
                            + 'confirmou. Espere alguns segundos e clique de novo.';
            return;
          }
          msg.textContent = '';
          texto($('#pronta-email'), email);
          texto($('#pronta-senha'), senha);
          $('#senha-pronta').style.display = 'flex';
          $('#novo-email').value = ''; $('#novo-nome').value = '';
          $('#nova-senha').value = '';
          listar();
        })
        .catch(function (e) {
          botao.disabled = false; botao.textContent = 'Criar e liberar acesso';
          msg.textContent = 'Não consegui: ' + (e && e.message || e);
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
      alert('Ainda não construído. Vem depois de a base estar carregada.');
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

    // Salvar recorte = criar uma base. O filtro vai junto, mas o que manda e a
      // lista congelada: quem esta atendendo nao pode ver o chao se mexer.
      $('#btn-criar-base').addEventListener('click', function () {
        var nome = prompt('Nome desta base\n\nExemplo: "Metalurgia SP - semana 1"',
                          descreverRecorte());
        if (!nome) return;
        var quantos = parseInt(prompt('Quantas empresas entram nesta base?\n\n'
                      + 'As de maior score entram primeiro. Uma base e uma lista de '
                      + 'trabalho — 60 por vendedor por semana e o tamanho sugerido.',
                      '60') || '0', 10);
        if (!quantos || quantos < 1) return;
        var reservar = confirm('Reservar estas empresas?\n\nOK = elas somem da vitrine '
                      + 'e das bases dos outros clientes.\nCancelar = ficam disponiveis '
                      + 'para todo mundo.');

        var b = $('#btn-criar-base');
        b.disabled = true; b.textContent = 'Criando...';
        sb.rpc('criar_base', {
          p_nome: nome,
          p_filtro: {
            prefixos: prefixosAtuais(), uf: estado.uf === 'Todos' ? null : estado.uf,
            cidade: estado.cidade || null, porte: porteAtual(),
            unidade: valorDe(UNIDADES, estado.unidade), faixa: valorDe(FAIXAS, estado.faixa),
            score: estado.minScore, capital: CAPITAIS[estado.capitalIdx],
            idade: estado.idadeMin, contato: valorDe(CONTATOS, estado.contato),
            descricao: descreverRecorte()
          },
          p_limite: quantos,
          p_reservar: !!reservar
        }).then(function (r) {
          b.disabled = false; b.textContent = 'Salvar recorte';
          if (r.error) { alert('Nao consegui criar: ' + r.error.message); return; }
          location.href = 'atender.html?base=' + r.data;
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
