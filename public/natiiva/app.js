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
    return sb.from('membros').select('nome, papel, ativo').limit(1)
      .then(function (r) {
        if (r.error) {
          var m = (r.error.message || '') + ' ' + (r.error.code || '');
          // schema ausente ou nao exposto na API nao e o mesmo que sem
          // permissao, e a mensagem precisa dizer isso — senao a proxima pessoa
          // perde uma tarde procurando erro de senha.
          if (/schema|does not exist|42P01|PGRST106|PGRST205|404/i.test(m)) {
            return { estado: 'banco_ausente' };
          }
          return { estado: 'erro', detalhe: r.error.message };
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

    $('#esqueci').addEventListener('click', function (ev) {
      ev.preventDefault();
      mostrarErro('Para redefinir a senha, fale com a gente pelo WhatsApp aqui embaixo.');
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
  var UFS = ['Todos', 'SP', 'MG', 'SC', 'PR', 'RS'];
  // Os codigos de porte da Receita: 01 microempresa, 03 EPP, 05 demais.
  // O LEADS.py ja converte para texto; aqui so traduzimos o rotulo da tela.
  var PORTES = [
    { nome: 'Todos',   valor: null },
    { nome: 'Pequeno', valor: 'Microempresa' },
    { nome: 'Médio',   valor: 'EPP' },
    { nome: 'Grande',  valor: 'Demais (medio/grande)' }
  ];
  var TETO = 50;   // linhas por consulta

  var estado = { setor: 'Todos', uf: 'Todos', porte: 'Todos', minScore: 70,
                 aberto: null, liberado: false };

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
    var partes = [];
    partes.push(estado.setor === 'Todos' ? 'Toda a indústria' : estado.setor);
    if (estado.uf !== 'Todos') partes.push('em ' + estado.uf);
    if (estado.porte !== 'Todos') partes.push('· porte ' + estado.porte.toLowerCase());
    if (estado.minScore > 0) partes.push('· score ' + estado.minScore + '+');
    return partes.join(' ');
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

  function buscar() {
    texto($('#score-valor'), estado.minScore);
    texto($('#recorte-desc'), descreverRecorte());

    var fonte = estado.liberado ? 'leads_completo' : 'leads_amostra';
    var q = sb.from(fonte).select('*').gte('score', estado.minScore)
              .order('score', { ascending: false }).limit(TETO);

    var pref = prefixosAtuais();
    if (pref) q = q.in('cnae_prefixo', pref);
    if (estado.uf !== 'Todos') q = q.eq('uf', estado.uf);
    var porte = porteAtual();
    if (porte) q = q.eq('porte', porte);

    q.then(function (r) {
      if (r.error) { linhas = []; desenhar(); texto($('#contagem'), 'Não consegui ler a base.'); return; }
      linhas = (r.data || []).map(function (l, i) {
        // a view completa nao tem "id"; usamos o CNPJ, que e a chave
        if (!l.id) l.id = l.cnpj || String(i);
        return l;
      });
      desenhar();
    });

    // Contagem e media do recorte INTEIRO, nao da pagina de 50 linhas.
    sb.rpc('resumo_recorte', {
      p_prefixos: pref, p_uf: estado.uf === 'Todos' ? null : estado.uf,
      p_porte: porte, p_score: estado.minScore
    }).then(function (r) {
      var d = (r.data && r.data[0]) || r.data || {};
      var total = d.total != null ? Number(d.total) : null;
      texto($('#vivo-total'), total != null ? numero(total) : '—');
      texto($('#vivo-score'), d.score_medio != null ? d.score_medio : '—');
      if (total != null) {
        texto($('#contagem'), total > TETO
          ? 'Mostrando as ' + TETO + ' primeiras de ' + numero(total) + ' empresas'
          : numero(total) + ' empresas neste recorte');
      }
    });
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
        $('#aviso-banco').style.display = 'block';
        return;
      }

      var m = res.membro;
      // "Liberado" hoje sai do papel. Cliente pagante por recorte ainda nao esta
      // modelado no banco — e uma decisao de produto em aberto, nao um esquecimento.
      estado.liberado = ['DONO', 'ADMIN', 'COMERCIAL'].indexOf(m.papel) >= 0;

      texto($('#conta'), m.nome || '');
      texto($('#sair'), (m.nome || '?').trim().charAt(0).toUpperCase());
      $('#btn-cta').textContent = estado.liberado ? 'Baixar CSV' : 'Liberar acesso';
      $('#aviso-amostra').style.display = estado.liberado ? 'none' : 'block';
      $('#app-corpo').style.display = 'flex';

      chips($('#chips-setor'), SETORES, 'setor');
      chips($('#chips-uf'), UFS.map(function (u) { return { nome: u }; }), 'uf');
      chips($('#chips-porte'), PORTES, 'porte');

      var slider = $('#score');
      slider.addEventListener('input', function () {
        estado.minScore = Number(slider.value);
        estado.aberto = null;
        texto($('#score-valor'), estado.minScore);
      });
      slider.addEventListener('change', buscar);

      buscar();
    });
  });
})();
