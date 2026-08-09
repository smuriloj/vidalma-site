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

  function conferirMembro() {
    return sb.from('membros').select('nome, papel, ativo, liberado').limit(1)
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

    $('#btn-liberar').addEventListener('click', function () {
      var email = $('#novo-email').value.trim();
      var nome = $('#novo-nome').value.trim();
      var papel = $('#novo-papel').value;
      var msg = $('#msg-novo');
      if (!email) { msg.textContent = 'Falta o e-mail.'; return; }
      msg.textContent = 'Procurando o login...';
      // A funcao no banco resolve o e-mail para o usuario do auth e cadastra.
      // Feita assim porque auth.users nao e legivel pelo navegador — e nem
      // deveria ser.
      sb.rpc('liberar_membro', { p_email: email, p_nome: nome, p_papel: papel })
        .then(function (r) {
          if (r.error) { msg.textContent = 'Não consegui: ' + r.error.message; return; }
          if (r.data === false) {
            msg.textContent = 'Esse e-mail ainda não existe no login. '
                            + 'Crie em Authentication → Users e volte aqui.';
            return;
          }
          msg.textContent = 'Liberado.';
          $('#novo-email').value = ''; $('#novo-nome').value = '';
          listar();
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

  function numero(n) {
    return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
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
  function escapar(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
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
