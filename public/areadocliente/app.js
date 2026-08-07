/* Área do Cliente Vidalma — liga as telas ao banco (Supabase).
   As telas continuam as mesmas do pacote da marca; este arquivo só
   preenche os dados e cuida do login por link mágico.
   Regra da casa: nenhum erro técnico aparece para o cliente. */
(function () {
  'use strict';

  var cfg = window.VIDALMA_SUPABASE;
  var sb = window.supabase.createClient(cfg.url, cfg.chave);

  // ---------------- utilidades ----------------
  function q(sel, raiz) { return (raiz || document).querySelector(sel); }
  function abs(pagina) { return new URL(pagina, window.location.href).href; }
  function param(nome) { return new URLSearchParams(window.location.search).get(nome); }
  function el(html) {
    var t = document.createElement('template');
    t.innerHTML = html.trim();
    return t.content.firstElementChild;
  }
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  var MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
    'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  function dataCurta(iso) { // "2026-08-04" -> "4 de agosto"
    if (!iso) return '';
    var d = new Date(iso.length <= 10 ? iso + 'T12:00:00' : iso);
    return d.getDate() + ' de ' + MESES[d.getMonth()];
  }
  function dataHora(iso) { // -> "4 de agosto, 09:12"
    var d = new Date(iso);
    var h = ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2);
    return d.getDate() + ' de ' + MESES[d.getMonth()] + ', ' + h;
  }
  function dinheiro(cent) { // 340000 -> "R$ 3.400" · 60050 -> "R$ 600,50"
    var reais = Math.floor(cent / 100), c = cent % 100;
    var s = String(reais).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return 'R$ ' + s + (c ? ',' + ('0' + c).slice(-2) : '');
  }
  function diasAte(iso) {
    var hoje = new Date(); hoje.setHours(0, 0, 0, 0);
    var v = new Date(iso + 'T12:00:00'); v.setHours(0, 0, 0, 0);
    return Math.round((v - hoje) / 86400000);
  }

  // ---------------- pedaços de tela (fiéis aos protótipos) ----------------
  var FONTE_TXT = "'DM Sans'";
  var FONTE_TIT = "'Chivo'";

  var ETIQUETA = {
    aberta: { cor: '#E9EBEA', texto: 'Aberta' },
    em_andamento: { cor: '#E9EBEA', texto: 'Em andamento' },
    aguardando_voce: { cor: '#F2C230', texto: 'Aguardando você' }
  };
  function etiqueta(estado, margem) {
    var e = ETIQUETA[estado] || ETIQUETA.aberta;
    return '<span style="align-self:flex-start;background:#101418;color:' + e.cor +
      ';font:500 12px ' + FONTE_TXT + ';letter-spacing:.06em;text-transform:uppercase;' +
      'padding:7px 12px;border-radius:3px' + (margem ? ';margin-top:4px' : '') + '">' +
      e.texto + '</span>';
  }

  var TIPO_NOME = { site: 'Site', aplicativo: 'Aplicativo', design: 'Design', automacao: 'Automação' };
  var PROJ_ESTADO = { em_producao: 'Em produção', no_ar: 'No ar', entregue: 'Entregue', pausado: 'Pausado' };
  function iconeModulo(tipo, tam) {
    var m = { superior: '#454C55', direito: '#454C55', inferior: '#454C55', esquerdo: '#454C55' };
    var mapa = { site: 'superior', aplicativo: 'direito', design: 'inferior', automacao: 'esquerdo' };
    m[mapa[tipo] || 'superior'] = '#F2C230';
    return '<svg viewBox="0 0 100 100" width="' + tam + '" height="' + tam + '" style="display:block;flex:none">' +
      '<path d="M16 16H62V34H16Z" fill="' + m.superior + '"></path>' +
      '<path d="M66 16H84V62H66Z" fill="' + m.direito + '"></path>' +
      '<path d="M38 66H84V84H38Z" fill="' + m.inferior + '"></path>' +
      '<path d="M16 38H30L34 43V84H16Z" fill="' + m.esquerdo + '"></path></svg>';
  }

  function avisoErro(recipiente) {
    recipiente.innerHTML = '';
    recipiente.appendChild(el('<p style="font:400 16px/1.55 ' + FONTE_TXT + ';color:#454C55;margin:0;padding:16px">' +
      'Não consegui carregar agora. Recarregue a página; se seguir assim, me chama no ' +
      '<a href="https://instagram.com/vidalmastudio" style="color:#101418">direct</a>.</p>'));
  }

  var VAZIO_SOLICITACOES =
    '<div style="background:#FFFFFF;border:1.5px solid #E9EBEA;border-top:4px solid #101418;padding:24px;display:flex;flex-direction:column;gap:16px">' +
    '<span style="font:700 21px/1.2 ' + FONTE_TIT + ';letter-spacing:-.02em;color:#101418">Você ainda não pediu nada.</span>' +
    '<p style="font:400 16px/1.55 ' + FONTE_TXT + ';color:#454C55;margin:0">Dá para pedir troca de texto ou de foto, preço novo, horário de funcionamento, uma página a mais — ou qualquer coisa que você olhou e não gostou.</p>' +
    '<p style="font:400 16px/1.55 ' + FONTE_TXT + ';color:#454C55;margin:0">Escreve do seu jeito. Eu entendo e respondo com prazo.</p>' +
    '<a href="nova-solicitacao.html" style="height:48px;background:#F2C230;border-radius:3px;display:flex;align-items:center;justify-content:center;font:700 16px ' + FONTE_TIT + ';color:#101418;text-decoration:none">Pedir alteração</a></div>';

  var VAZIO_PAGAMENTOS =
    '<div style="background:#FFFFFF;border:1.5px solid #E9EBEA;border-top:4px solid #101418;padding:24px;display:flex;flex-direction:column;gap:16px">' +
    '<svg viewBox="0 0 100 100" width="48" height="48" style="display:block"><path d="M16 16H62V34H16Z" fill="#454C55"></path><path d="M66 16H84V62H66Z" fill="#454C55"></path><path d="M38 66H84V84H38Z" fill="#454C55"></path><path d="M16 38H30L34 43V84H16Z" fill="#454C55"></path></svg>' +
    '<span style="font:700 21px/1.2 ' + FONTE_TIT + ';letter-spacing:-.02em;color:#101418">Você não tem nenhuma cobrança.</span>' +
    '<p style="font:400 16px/1.55 ' + FONTE_TXT + ';color:#454C55;margin:0">Quando eu emitir uma, ela aparece aqui com o valor e a data de vencimento. Você fica sabendo antes de vencer.</p></div>';

  // ---------------- sessão ----------------
  function exigirSessao() {
    return sb.auth.getSession().then(function (r) {
      var s = r.data ? r.data.session : null;
      if (!s) { window.location.replace('entrar.html'); return null; }
      return s;
    });
  }
  function ligarSair() {
    document.querySelectorAll('a[href="entrar.html"]').forEach(function (a) {
      a.addEventListener('click', function (ev) {
        ev.preventDefault();
        sb.auth.signOut().then(function () { window.location.replace('entrar.html'); },
          function () { window.location.replace('entrar.html'); });
      });
    });
  }

  // ---------------- telas ----------------
  function telaEntrar() {
    var form = q('#form-entrar');
    var email = q('#email');
    var lembrado = param('email');
    if (lembrado && !email.value) email.value = lembrado;
    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var botao = form.querySelector('button');
      botao.disabled = true;
      botao.textContent = 'Enviando…';
      var end = email.value.trim();
      sb.auth.signInWithOtp({
        email: end,
        options: { shouldCreateUser: false, emailRedirectTo: abs('inicio.html') }
      }).then(function (r) {
        if (r.error) {
          window.location.href = 'entrar-erro.html?email=' + encodeURIComponent(end);
        } else {
          window.location.href = 'entrar-link-enviado.html?email=' + encodeURIComponent(end);
        }
      }, function () {
        window.location.href = 'entrar-erro.html?email=' + encodeURIComponent(end);
      });
    });
  }

  function telaLinkEnviado() {
    var email = param('email');
    var destino = q('#email-destino');
    if (destino && email) destino.textContent = email;
    var voltar = q('a[href="entrar.html"]');
    if (voltar && email) voltar.href = 'entrar.html?email=' + encodeURIComponent(email);
  }

  function telaInicio(sessao) {
    var uid = sessao.user.id;

    sb.from('clientes').select('nome').eq('id', uid).single().then(function (r) {
      if (r.data && r.data.nome) q('#ola').textContent = 'Olá, ' + r.data.nome + '.';
    });

    sb.from('pagamentos').select('valor_centavos,vencimento').eq('pago', false)
      .order('vencimento', { ascending: true }).limit(1).then(function (r) {
        var p = r.data && r.data[0];
        if (!p) return;
        q('#aviso-valor').textContent = dinheiro(p.valor_centavos);
        var dd = diasAte(p.vencimento);
        q('#aviso-texto').textContent = (dd < 0 ? 'Venceu em ' : 'Vence em ') + dataCurta(p.vencimento) + '.';
        q('#aviso').style.display = 'flex';
      });

    sb.from('projetos').select('*').order('criado_em').then(function (r) {
      var sec = q('#sec-projetos');
      if (r.error) return avisoErro(sec);
      if (!r.data.length) { sec.style.display = 'none'; return; }
      var alvo = q('#projetos') || sec; // grade em telas largas
      r.data.forEach(function (p) { alvo.appendChild(cardProjeto(p)); });
    });

    sb.from('solicitacoes').select('id,titulo,estado,concluida_em')
      .order('criada_em', { ascending: false }).limit(3).then(function (r) {
        var bloco = q('#bloco-ultimas');
        if (r.error || !r.data.length) { bloco.style.display = 'none'; return; }
        var lista = q('#ultimas');
        r.data.forEach(function (s, i) {
          var rodape = s.estado === 'concluida'
            ? '<span style="font:500 14px ' + FONTE_TXT + ';color:#454C55">Concluída' + (s.concluida_em ? ' em ' + dataCurta(s.concluida_em) : '') + '</span>'
            : etiqueta(s.estado, false);
          var cor = s.estado === 'concluida' ? '#454C55' : '#101418';
          var borda = i === r.data.length - 1 ? '' : 'border-bottom:1.5px solid #E9EBEA;';
          lista.appendChild(el('<a href="solicitacao.html?id=' + s.id + '" style="padding:16px;display:flex;flex-direction:column;gap:8px;' + borda + 'text-decoration:none">' +
            '<span style="font:500 16px ' + FONTE_TXT + ';color:' + cor + '">' + esc(s.titulo) + '</span>' + rodape + '</a>'));
        });
      });
  }

  function cardProjeto(p) {
    var extra = '';
    if (p.estado === 'no_ar' && p.link) {
      var url = /^https?:\/\//.test(p.link) ? p.link : 'https://' + p.link;
      extra = '<a href="' + esc(url) + '" style="min-height:44px;display:flex;align-items:center;font:400 16px ' + FONTE_TXT + ';color:#101418">' +
        esc(p.link.replace(/^https?:\/\//, '')) + '</a>';
    } else if (p.previsao) {
      extra = '<span style="font:400 16px ' + FONTE_TXT + ';color:#454C55">Previsão: ' + dataCurta(p.previsao) + '.</span>';
    }
    return el('<div style="background:#FFFFFF;border:1.5px solid #E9EBEA;border-top:4px solid #101418;padding:16px;display:flex;flex-direction:column;gap:16px">' +
      '<div style="display:flex;align-items:center;gap:12px">' + iconeModulo(p.tipo, 40) +
      '<span style="font:500 12px ' + FONTE_TXT + ';letter-spacing:.1em;text-transform:uppercase;color:#454C55">' + (TIPO_NOME[p.tipo] || '') + '</span></div>' +
      '<div style="display:flex;flex-direction:column;gap:12px">' +
      '<span style="font:700 21px/1.2 ' + FONTE_TIT + ';letter-spacing:-.02em;color:#101418">' + esc(p.nome) + '</span>' +
      '<span style="align-self:flex-start;background:#101418;color:#E9EBEA;font:500 12px ' + FONTE_TXT + ';letter-spacing:.06em;text-transform:uppercase;padding:7px 12px;border-radius:3px">' + (PROJ_ESTADO[p.estado] || '') + '</span>' +
      extra + '</div>' +
      '<a href="nova-solicitacao.html?projeto=' + p.id + '" style="height:48px;border:2px solid #101418;border-radius:3px;box-sizing:border-box;display:flex;align-items:center;justify-content:center;font:700 15px ' + FONTE_TIT + ';color:#101418;text-decoration:none">Pedir alteração</a></div>');
  }

  function telaSolicitacoes() {
    sb.from('solicitacoes').select('id,titulo,estado,criada_em,concluida_em,projetos(nome)')
      .order('criada_em', { ascending: false }).then(function (r) {
        var lista = q('#lista');
        if (r.error) return avisoErro(lista);
        if (!r.data.length) {
          var btn = q('#btn-pedir');
          if (btn) btn.style.display = 'none';
          lista.replaceWith(el(VAZIO_SOLICITACOES));
          return;
        }
        r.data.forEach(function (s, i) {
          var borda = i === r.data.length - 1 ? '' : 'border-bottom:1.5px solid #E9EBEA;';
          var cor = s.estado === 'concluida' ? '#454C55' : '#101418';
          var rodape = s.estado === 'concluida'
            ? '<span style="font:500 14px ' + FONTE_TXT + ';color:#454C55;margin-top:4px">Concluída' + (s.concluida_em ? ' em ' + dataCurta(s.concluida_em) : '') + '</span>'
            : etiqueta(s.estado, true);
          var meta = (s.projetos && s.projetos.nome ? esc(s.projetos.nome) + ' · ' : '') + dataCurta(s.criada_em);
          lista.appendChild(el('<a href="solicitacao.html?id=' + s.id + '" style="padding:16px;display:flex;flex-direction:column;gap:8px;' + borda + 'text-decoration:none">' +
            '<span style="font:500 16px ' + FONTE_TXT + ';color:' + cor + '">' + esc(s.titulo) + '</span>' +
            '<span style="font:400 14px ' + FONTE_TXT + ';color:#454C55">' + meta + '</span>' + rodape + '</a>'));
        });
      });
  }

  function telaPagamentos() {
    sb.from('pagamentos').select('*').then(function (r) {
      var lista = q('#lista');
      if (r.error) return avisoErro(lista);
      if (!r.data.length) {
        q('#resumo').style.display = 'none';
        lista.replaceWith(el(VAZIO_PAGAMENTOS));
        return;
      }
      var total = 0, pago = 0;
      r.data.forEach(function (p) { total += p.valor_centavos; if (p.pago) pago += p.valor_centavos; });
      q('#res-contratado').textContent = dinheiro(total);
      q('#res-pago').textContent = dinheiro(pago);
      q('#res-aberto').textContent = dinheiro(total - pago);
      var abertos = r.data.filter(function (p) { return !p.pago; })
        .sort(function (a, b) { return a.vencimento < b.vencimento ? -1 : 1; });
      var pagos = r.data.filter(function (p) { return p.pago; })
        .sort(function (a, b) { return (b.pago_em || '') < (a.pago_em || '') ? -1 : 1; });
      abertos.concat(pagos).forEach(function (p) { lista.appendChild(cardPagamento(p)); });
    });
  }

  function cardPagamento(p) {
    var nome = esc(p.descricao);
    var valor = dinheiro(p.valor_centavos);
    if (p.pago) {
      return el('<div style="background:#FFFFFF;border:1.5px solid #E9EBEA;padding:16px;display:flex;flex-direction:column;gap:8px">' +
        '<div style="display:flex;justify-content:space-between;align-items:baseline;gap:12px">' +
        '<span style="font:500 16px ' + FONTE_TXT + ';color:#454C55">' + nome + '</span>' +
        '<span style="font:700 18px ' + FONTE_TIT + ';letter-spacing:-.02em;color:#454C55;white-space:nowrap">' + valor + '</span></div>' +
        '<span style="font:400 15px ' + FONTE_TXT + ';color:#454C55">Pago' + (p.pago_em ? ' em ' + dataCurta(p.pago_em) : '') + '.</span></div>');
    }
    var dd = diasAte(p.vencimento);
    if (dd < 0) {
      return el('<div style="background:#101418;padding:16px;display:flex;flex-direction:column;gap:8px">' +
        '<div style="display:flex;justify-content:space-between;align-items:baseline;gap:12px">' +
        '<span style="font:500 16px ' + FONTE_TXT + ';color:#E9EBEA">' + nome + '</span>' +
        '<span style="font:800 20px ' + FONTE_TIT + ';letter-spacing:-.02em;color:#F2C230;white-space:nowrap">' + valor + '</span></div>' +
        '<span style="font:500 15px ' + FONTE_TXT + ';color:#E9EBEA">Venceu em ' + dataCurta(p.vencimento) + '.</span></div>');
    }
    if (dd <= 7) {
      var quando = dd === 0 ? 'Vence hoje' : dd === 1 ? 'Vence amanhã' : 'Vence em ' + dd + ' dias';
      return el('<div style="background:#FFFFFF;border:1.5px solid #E9EBEA;padding:16px;display:flex;flex-direction:column;gap:12px">' +
        '<div style="display:flex;justify-content:space-between;align-items:baseline;gap:12px">' +
        '<span style="font:500 16px ' + FONTE_TXT + ';color:#101418">' + nome + '</span>' +
        '<span style="font:700 18px ' + FONTE_TIT + ';letter-spacing:-.02em;color:#101418;white-space:nowrap">' + valor + '</span></div>' +
        '<span style="align-self:flex-start;background:#101418;color:#F2C230;font:500 12px ' + FONTE_TXT + ';letter-spacing:.06em;text-transform:uppercase;padding:7px 12px;border-radius:3px">' + quando + '</span></div>');
    }
    return el('<div style="background:#FFFFFF;border:1.5px solid #E9EBEA;padding:16px;display:flex;flex-direction:column;gap:8px">' +
      '<div style="display:flex;justify-content:space-between;align-items:baseline;gap:12px">' +
      '<span style="font:500 16px ' + FONTE_TXT + ';color:#101418">' + nome + '</span>' +
      '<span style="font:700 18px ' + FONTE_TIT + ';letter-spacing:-.02em;color:#101418;white-space:nowrap">' + valor + '</span></div>' +
      '<span style="font:400 15px ' + FONTE_TXT + ';color:#454C55">Vence em ' + dataCurta(p.vencimento) + '.</span></div>');
  }

  function telaNova(sessao) {
    var select = q('#projeto');
    sb.from('projetos').select('id,nome').order('criado_em').then(function (r) {
      select.innerHTML = '';
      (r.data || []).forEach(function (p) {
        var o = document.createElement('option');
        o.value = p.id;
        o.textContent = p.nome;
        select.appendChild(o);
      });
      var pre = param('projeto');
      if (pre) select.value = pre;
    });
    q('#form-nova').addEventListener('submit', function (ev) {
      ev.preventDefault();
      var botao = q('#form-nova button');
      botao.disabled = true;
      botao.textContent = 'Enviando…';
      var falhou = function () {
        botao.disabled = false;
        botao.textContent = 'Enviar pedido';
        q('#nota').textContent = 'Não consegui enviar agora. Tenta de novo em instantes; se seguir assim, me chama no direct.';
      };
      sb.from('solicitacoes').insert({
        cliente_id: sessao.user.id,
        projeto_id: select.value,
        titulo: q('#titulo').value.trim(),
        estado: 'aberta'
      }).select('id').single().then(function (r) {
        if (r.error || !r.data) return falhou();
        var id = r.data.id;
        var seguir = function () { window.location.href = 'solicitacao.html?id=' + id; };
        var detalhes = q('#detalhes').value.trim();
        if (detalhes) {
          sb.from('mensagens').insert({ solicitacao_id: id, autor: 'cliente', texto: detalhes }).then(seguir, seguir);
        } else seguir();
      }, falhou);
    });
  }

  function telaSolicitacao(sessao) {
    var id = param('id');
    if (!id) { window.location.replace('solicitacoes.html'); return; }
    var nomeCliente = 'Você';

    function cabecalho() {
      sb.from('solicitacoes').select('titulo,estado,criada_em,concluida_em,projetos(nome)')
        .eq('id', id).single().then(function (r) {
          if (r.error || !r.data) { window.location.replace('solicitacoes.html'); return; }
          var s = r.data;
          q('#s-titulo').textContent = s.titulo;
          document.title = s.titulo + ' · Vidalma';
          q('#s-meta').textContent = (s.projetos && s.projetos.nome ? s.projetos.nome + ' · ' : '') + dataCurta(s.criada_em);
          var alvo = q('#s-etiqueta');
          var novo = s.estado === 'concluida'
            ? el('<span id="s-etiqueta" style="font:500 14px ' + FONTE_TXT + ';color:#454C55">Concluída' + (s.concluida_em ? ' em ' + dataCurta(s.concluida_em) : '') + '</span>')
            : el(etiqueta(s.estado, false).replace('<span ', '<span id="s-etiqueta" '));
          alvo.replaceWith(novo);
        });
    }

    function conversa() {
      return sb.from('mensagens').select('*').eq('solicitacao_id', id)
        .order('criada_em').then(function (r) {
          var caixa = q('#conversa');
          if (r.error) return avisoErro(caixa);
          caixa.innerHTML = '';
          r.data.forEach(function (m) {
            if (m.autor === 'cliente') {
              caixa.appendChild(el('<div style="align-self:flex-end;max-width:88%;display:flex;flex-direction:column;gap:8px;align-items:flex-end">' +
                '<span style="font:500 12px ' + FONTE_TXT + ';color:#454C55">' + esc(nomeCliente) + ' · ' + dataHora(m.criada_em) + '</span>' +
                '<div style="background:#FFFFFF;border:1.5px solid #E9EBEA;padding:16px;font:400 16px/1.55 ' + FONTE_TXT + ';color:#101418">' + esc(m.texto) + '</div></div>'));
            } else {
              caixa.appendChild(el('<div style="align-self:flex-start;max-width:88%;display:flex;flex-direction:column;gap:8px">' +
                '<span style="font:500 12px ' + FONTE_TXT + ';color:#454C55">Vidalma · ' + dataHora(m.criada_em) + '</span>' +
                '<div style="background:#E9EBEA;padding:16px;font:400 16px/1.55 ' + FONTE_TXT + ';color:#101418">' + esc(m.texto) + '</div></div>'));
            }
          });
        });
    }

    sb.from('clientes').select('nome').eq('id', sessao.user.id).single().then(function (r) {
      if (r.data && r.data.nome) nomeCliente = r.data.nome;
      cabecalho();
      conversa();
    });

    q('#form-resposta').addEventListener('submit', function (ev) {
      ev.preventDefault();
      var campo = q('#resposta');
      var texto = campo.value.trim();
      if (!texto) { campo.focus(); return; }
      var botao = q('#form-resposta button');
      botao.disabled = true;
      botao.textContent = 'Enviando…';
      sb.from('mensagens').insert({ solicitacao_id: id, autor: 'cliente', texto: texto })
        .then(function (r) {
          botao.disabled = false;
          botao.textContent = 'Responder';
          if (r.error) return; // o texto fica no campo, nada se perde
          campo.value = '';
          cabecalho(); // o estado pode ter voltado para "Em andamento"
          conversa();
        }, function () {
          botao.disabled = false;
          botao.textContent = 'Responder';
        });
    });
  }

  // ---------------- roteador ----------------
  var raiz = q('[data-screen-label]');
  var tela = raiz ? raiz.getAttribute('data-screen-label') : '';

  if (tela.indexOf('00 ') === 0) {
    // porta da pasta: é aqui que o link mágico chega (Site URL do Supabase).
    // a biblioteca lê o token do endereço e cria a sessão; daí é só encaminhar.
    sb.auth.getSession().then(function (r) {
      window.location.replace(r.data && r.data.session ? 'inicio.html' : 'entrar.html');
    });
  } else if (tela.indexOf('01 Entrar') === 0 || tela.indexOf('03 Erro') === 0) {
    sb.auth.getSession().then(function (r) {
      if (r.data && r.data.session) window.location.replace('inicio.html');
      else telaEntrar();
    });
  } else if (tela.indexOf('02 Link') === 0) {
    telaLinkEnviado();
  } else {
    exigirSessao().then(function (s) {
      if (!s) return;
      ligarSair();
      if (tela.indexOf('04 Inicio') === 0) telaInicio(s);
      else if (tela.indexOf('07 Solicitacoes') === 0) telaSolicitacoes();
      else if (tela.indexOf('05 Pagamentos') === 0) telaPagamentos();
      else if (tela.indexOf('09 Nova') === 0) telaNova(s);
      else if (tela.indexOf('10 Solicitacao') === 0) telaSolicitacao(s);
    });
  }
})();
