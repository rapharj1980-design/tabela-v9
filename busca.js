/* ===== BUSCA MCELL =====
   Lê as tabelas (.produto-row) das páginas já existentes, monta um índice
   e leva o cliente direto à linha do produto. Não precisa manter lista de produtos. */
(() => {
  'use strict';

  /* ---------- 1. CONFIGURAÇÃO (só isto muda quando criar página nova) ---------- */
  const VERSAO = 'v1';          // troque (v2, v3...) para forçar atualização do índice
  const VALIDADE_MIN = 60;      // por quanto tempo o índice fica guardado no navegador

  const GRUPOS = {
    tela: { nome: 'Telas', chaves: 'tela display frontal lcd touch' },
    bateria: { nome: 'Baterias', chaves: 'bateria bat celula' },
    conector: { nome: 'Conectores', chaves: 'conector dock carga' },
    tampa: { nome: 'Tampas', chaves: 'tampa traseira' },
    flex: { nome: 'Flex', chaves: 'flex auricular sensor' },
  };

  // tipo = texto extra que aparece como "título" da tabela (ex.: bateria - sem mensagem)
  const PAGINAS = [
    { url: 'telaip.html', grupo: 'tela', sub: 'iPhone / iPad' },
    { url: 'telassam.html', grupo: 'tela', sub: 'Samsung' },
    { url: 'telaxiaomi.html', grupo: 'tela', sub: 'Xiaomi / Poco / Redmi' },
    { url: 'tabetelamoto.html', grupo: 'tela', sub: 'Motorola' },
    { url: 'telaslg.html', grupo: 'tela', sub: 'LG' },
    { url: 'batgen.html', grupo: 'bateria', sub: 'iPhone', tipo: 'Genuína Apple (sem mensagem)' },
    { url: 'batkbs.html', grupo: 'bateria', sub: 'iPhone', tipo: 'Premium KBS' },
    { url: 'batsemflex.html', grupo: 'bateria', sub: 'iPhone', tipo: 'Sem flex' },
    { url: 'batDeji.html', grupo: 'bateria', sub: 'iPhone', tipo: 'Deji homologada Anatel' },
    { url: 'batIpad.html', grupo: 'bateria', sub: 'iPad' },
    { url: 'tablets.html', grupo: 'bateria', sub: 'Tablet Samsung / iPad' },
    { url: 'conectoresip.html', grupo: 'conector', sub: 'iPhone', tipo: 'Premium' },
    { url: 'conectOrig.html', grupo: 'conector', sub: 'iPhone', tipo: 'Original' },
    { url: 'tampaIphone.html', grupo: 'tampa', sub: 'iPhone' },
    { url: 'flex_sensor.html', grupo: 'flex', sub: 'iPhone', tipo: 'Auricular + Sensor de presença' },
  ];

  const MAX_RESULTADOS = 80;

  /* ---------- 2. UTILIDADES ---------- */
  const limpa = (s) => (s || '').replace(/\s+/g, ' ').trim();
  const norm = (s) =>
    (s || '')
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/\bc\s*\/\s*aro\b/g, 'com aro')
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
  const chave = (s) => (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');

  // mesmas linhas, na mesma ordem, tanto no índice quanto na página de destino
  const linhasDe = (raiz) =>
    [...raiz.querySelectorAll('tr.produto-row')].filter((tr) => tr.querySelectorAll('td').length >= 2);

  /* ---------- 3. INDEXAÇÃO ---------- */
  function tituloDaTabela(tabela) {
    const partes = [];
    const sec = tabela.closest('section');
    const h2 = sec && sec.querySelector('h2');
    if (h2) partes.push(limpa(h2.textContent));
    tabela.querySelectorAll('th').forEach((th) => {
      const t = limpa(th.textContent);
      if (t && !/^(pre[cç]o|produto|modelo)$/i.test(t)) partes.push(t);
    });
    const unicas = [];
    partes.forEach((p) => {
      const n = norm(p);
      if (!n || partes.some((o) => o !== p && norm(o).includes(n) && norm(o).length > n.length)) return;
      if (!unicas.some((u) => norm(u) === n)) unicas.push(p);
    });
    return unicas.join(' · ');
  }

  async function lerPagina(p) {
    try {
      const resp = await fetch(p.url);
      if (!resp.ok) return [];
      const doc = new DOMParser().parseFromString(await resp.text(), 'text/html');
      doc.querySelectorAll('br').forEach((b) => b.replaceWith(' '));
      return linhasDe(doc).map((tr, i) => {
        const td = tr.querySelectorAll('td');
        const tabela = tr.closest('table');
        const titulo = [p.sub, p.tipo, tabela ? tituloDaTabela(tabela) : ''].filter(Boolean).join(' · ');
        return [limpa(td[0].textContent), limpa(td[1].textContent), p.grupo, p.sub, titulo, p.url, i];
      });
    } catch (e) {
      return [];
    }
  }

  let indice = null;
  let carregando = null;

  function montar(dados) {
    indice = dados.map(([n, p, g, s, t, u, i]) => ({
      n, p, g, s, t, u, i,
      nn: ' ' + norm(n) + ' ',
      h: ' ' + norm([n, GRUPOS[g].nome, GRUPOS[g].chaves, s, t].join(' ')) + ' ',
    }));
  }

  function carregarIndice() {
    if (indice) return Promise.resolve();
    if (carregando) return carregando;
    const CH = 'mcellBusca_' + VERSAO;
    try {
      const salvo = JSON.parse(localStorage.getItem(CH) || 'null');
      if (salvo && Date.now() - salvo.t < VALIDADE_MIN * 60000) {
        montar(salvo.d);
        return Promise.resolve();
      }
    } catch (e) { /* segue sem cache */ }

    carregando = Promise.all(PAGINAS.map(lerPagina)).then((r) => {
      const dados = r.flat();
      if (!dados.length) throw new Error('vazio');
      montar(dados);
      try { localStorage.setItem(CH, JSON.stringify({ t: Date.now(), d: dados })); } catch (e) { /* cheio */ }
    });
    carregando.catch(() => { carregando = null; });
    return carregando;
  }
  /* ---------- 4. BUSCA ---------- */
  function buscar(q, grupo, tabela) {
    let lista = indice;
    if (grupo) lista = lista.filter((r) => r.g === grupo);
    if (tabela) lista = lista.filter((r) => r.t === tabela);
    const tokens = norm(q).split(' ').filter(Boolean);
    if (!tokens.length) return grupo || tabela ? lista : [];
    return lista
      .filter((r) => tokens.every((t) => r.h.includes(' ' + t)))
      .map((r) => ({ r, pts: tokens.filter((t) => r.nn.includes(' ' + t)).length }))
      .sort((a, b) => b.pts - a.pts)
      .map((x) => x.r);
  }

  const hrefDe = (r) => `${r.u}?busca=${encodeURIComponent(r.n)}&lin=${r.i}`;





  /* ---------- 5. INTERFACE ---------- */
  let overlay, input, chips, selTabela, status, lista;
  let grupoAtual = '';

  function criarPainel() {
    overlay = document.createElement('div');
    overlay.id = 'mb-overlay';
    overlay.hidden = true;
    overlay.innerHTML = `
      <div id="mb-painel" role="dialog" aria-modal="true" aria-label="Buscar produto">
        <div class="mb-topo">
          <input id="mb-input" type="search" autocomplete="off" placeholder="Ex.: tela iphone 11, bateria g7, tampa 14 com aro">
          <button type="button" id="mb-fechar" aria-label="Fechar busca">✕</button>
        </div>
        <div id="mb-chips"></div>
        <select id="mb-tabela" aria-label="Filtrar por tabela"></select>
        <div id="mb-status" aria-live="polite"></div>
        <div id="mb-lista"></div>
      </div>`;
    document.body.appendChild(overlay);

    input = overlay.querySelector('#mb-input');
    chips = overlay.querySelector('#mb-chips');
    selTabela = overlay.querySelector('#mb-tabela');
    status = overlay.querySelector('#mb-status');
    lista = overlay.querySelector('#mb-lista');

    const opcoes = [['', 'Todos']].concat(Object.entries(GRUPOS).map(([k, v]) => [k, v.nome]));
    opcoes.forEach(([k, nome]) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'mb-chip';
      b.dataset.grupo = k;
      b.textContent = nome;
      b.setAttribute('aria-pressed', k === '' ? 'true' : 'false');
      chips.appendChild(b);
    });

    chips.addEventListener('click', (e) => {
      const b = e.target.closest('.mb-chip');
      if (!b) return;
      grupoAtual = b.dataset.grupo;
      chips.querySelectorAll('.mb-chip').forEach((c) => c.setAttribute('aria-pressed', String(c === b)));
      preencherTabelas();
      atualizar();
      input.focus();
    });
    selTabela.addEventListener('change', atualizar);
    input.addEventListener('input', atualizar);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const primeiro = lista.querySelector('a.mb-item');
        if (primeiro) location.href = primeiro.href;
      }
    });
    overlay.querySelector('#mb-fechar').addEventListener('click', fechar);
    overlay.addEventListener('mousedown', (e) => { if (e.target === overlay) fechar(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !overlay.hidden) fechar(); });
  }

  function preencherTabelas() {
    const titulos = [];
    (indice || []).forEach((r) => {
      if ((!grupoAtual || r.g === grupoAtual) && !titulos.includes(r.t)) titulos.push(r.t);
    });
    selTabela.innerHTML = '';
    selTabela.add(new Option('Todas as tabelas', ''));
    titulos.forEach((t) => selTabela.add(new Option(t, t)));
  }

  function atualizar() {
    if (!indice) return;
    const q = input.value;
    const res = buscar(q, grupoAtual, selTabela.value);
    lista.innerHTML = '';
    if (!res.length) {
      status.textContent = norm(q) || grupoAtual || selTabela.value
        ? 'Nada encontrado. Tente menos palavras (ex.: "iphone 11") ou outro filtro.'
        : 'Digite o nome do produto ou escolha um filtro.';
      return;
    }
    status.textContent = res.length > MAX_RESULTADOS
      ? `Mostrando ${MAX_RESULTADOS} de ${res.length}. Digite mais detalhes para refinar.`
      : `${res.length} resultado${res.length > 1 ? 's' : ''}`;
    const frag = document.createDocumentFragment();
    res.slice(0, MAX_RESULTADOS).forEach((r, k) => {
      const a = document.createElement('a');
      a.className = 'mb-item' + (k === 0 ? ' mb-primeiro' : '');
      a.href = hrefDe(r);
      const esq = document.createElement('span');
      const n = document.createElement('span');
      n.className = 'mb-nome';
      n.textContent = r.n;
      const o = document.createElement('span');
      o.className = 'mb-onde';
      o.textContent = `${GRUPOS[r.g].nome} · ${r.t}`;
      esq.append(n, o);
      const p = document.createElement('span');
      p.className = 'mb-preco';
      p.textContent = r.p;
      a.append(esq, p);
      frag.appendChild(a);
    });
    lista.appendChild(frag);
  }

  async function abrir(textoInicial) {
    if (!overlay) criarPainel();
    overlay.hidden = false;
    document.body.style.overflow = 'hidden';
    if (typeof textoInicial === 'string') input.value = textoInicial;
    input.focus();
    if (!indice) {
      status.textContent = 'Carregando tabelas...';
      try {
        await carregarIndice();
      } catch (e) {
        status.textContent = location.protocol === 'file:'
          ? 'A busca só funciona no site publicado (ou em servidor local), não abrindo o arquivo direto.'
          : 'Não foi possível carregar as tabelas agora. Tente novamente.';
        return;
      }
    }
    preencherTabelas();
    atualizar();
  }

  function fechar() {
    overlay.hidden = true;
    document.body.style.overflow = '';
  }

  function iniciarUI() {
    const lupa = document.createElement('button');
    lupa.type = 'button';
    lupa.id = 'mb-lupa';
    lupa.setAttribute('aria-label', 'Buscar produto');
    lupa.textContent = '🔍';
    lupa.addEventListener('click', () => abrir());
    document.body.appendChild(lupa);

    // barra grande no index (ou onde existir <div id="mcell-busca"></div>)
    let alvo = document.getElementById('mcell-busca');
    const ehIndex = /(^|\/)(index\.html)?$/.test(location.pathname);
    if (!alvo && ehIndex) {
      const header = document.querySelector('header');
      if (header) {
        alvo = document.createElement('div');
        header.after(alvo);
      }
    }
    if (alvo) {
      alvo.id = 'mb-inline';
      alvo.innerHTML = '<input type="search" aria-label="Buscar produto" placeholder="🔍 Buscar produto (ex.: tela iphone 11)" autocomplete="off">';
      const campo = alvo.firstElementChild;
      const entrar = () => { const v = campo.value; campo.value = ''; abrir(v); };
      campo.addEventListener('focus', entrar);
      campo.addEventListener('click', entrar);
    }
  }

  /* ---------- 6. DESTAQUE NA PÁGINA DE DESTINO ---------- */
  function destacar() {
    const sp = new URLSearchParams(location.search);
    const nome = sp.get('busca');
    if (!nome) return;
    const linhas = linhasDe(document);
    const igual = (tr) => chave(tr.cells[0].textContent) === chave(nome);
    let alvo = linhas[parseInt(sp.get('lin'), 10)];
    if (!alvo || !igual(alvo)) alvo = linhas.find(igual);
    history.replaceState(null, '', location.pathname + location.hash);
    if (!alvo) return;
    alvo.classList.add('mb-destaque');
    const ir = (modo) => alvo.scrollIntoView({ block: 'center', behavior: modo });
    ir('auto');
    setTimeout(() => ir('smooth'), 400);   // reajusta após o layout das seções
    setTimeout(() => alvo.classList.remove('mb-destaque'), 10000);
  }

  /* ---------- INÍCIO ---------- */
  iniciarUI();
  destacar();
})();
