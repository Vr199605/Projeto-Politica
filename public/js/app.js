/**
 * RADAR POLÍTICO - Frontend Application Logic
 * MVP de Monitoramento de Notícias Políticas, Rankings e Monetização
 */

// Estado global da aplicação
const state = {
  currentTab: 'search',
  articles: [],
  politiciansTop10: [],
  sitesTop10: [],
  blogs: [],
  monetization: {},
  activeFilters: {
    politico: '',
    assunto: '',
    dataInicio: '',
    dataFim: '',
    source: ''
  },
  sortBy: 'recent',
  selectedBlogCategory: '',
  sponsoredOnlyBlogs: false,
  totalSearches: 0,
  totalClicks: 0
};

// Inicialização ao carregar a página
document.addEventListener('DOMContentLoaded', () => {
  initDatePresets();
  runDefaultSearch();
  loadPoliticiansRanking();
  loadSitesRanking();
  loadBlogsList();
  loadMonetizationStats();
});

// ========================================================
// 1. NAVEGAÇÃO ENTRE ABAS
// ========================================================
function switchTab(tabId) {
  state.currentTab = tabId;

  // Seções
  const sections = ['search', 'politicians', 'sites', 'blogs', 'monetization'];
  sections.forEach(id => {
    const el = document.getElementById(`section-${id}`);
    if (el) {
      if (id === tabId) {
        el.classList.remove('hidden');
        el.classList.add('animate-fadeIn');
      } else {
        el.classList.add('hidden');
      }
    }
  });

  // Atualizar botões Desktop
  sections.forEach(id => {
    const btn = document.getElementById(`nav-${id}`);
    if (btn) {
      if (id === tabId) {
        btn.className = 'nav-tab-btn active px-3.5 py-1.5 rounded-lg transition-all flex items-center gap-2 text-blue-700 bg-white shadow-sm';
      } else {
        btn.className = 'nav-tab-btn px-3.5 py-1.5 rounded-lg transition-all flex items-center gap-2 text-slate-600 hover:text-slate-900';
      }
    }
  });

  // Atualizar botões Mobile
  sections.forEach(id => {
    const mobBtn = document.getElementById(`mob-${id}`);
    if (mobBtn) {
      if (id === tabId) {
        mobBtn.className = 'mob-tab-btn active whitespace-nowrap px-3 py-1.5 rounded-md bg-blue-600 text-white flex items-center gap-1.5';
      } else {
        mobBtn.className = 'mob-tab-btn whitespace-nowrap px-3 py-1.5 rounded-md bg-white border border-slate-200 text-slate-700 flex items-center gap-1.5';
      }
    }
  });

  // Atualizações dinâmicas ao trocar de aba
  if (tabId === 'politicians') loadPoliticiansRanking();
  if (tabId === 'sites') loadSitesRanking();
  if (tabId === 'blogs') loadBlogsList();
  if (tabId === 'monetization') loadMonetizationStats();

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ========================================================
// 2. FUNÇÃO BASE 1: BUSCA DE NOTÍCIAS POLÍTICAS
// ========================================================
async function handleSearch(e) {
  if (e) e.preventDefault();

  const politico = document.getElementById('input-politico').value.trim();
  const assunto = document.getElementById('input-assunto').value.trim();
  const dataInicio = document.getElementById('input-data-inicio').value;
  const dataFim = document.getElementById('input-data-fim').value;

  state.activeFilters.politico = politico;
  state.activeFilters.assunto = assunto;
  state.activeFilters.dataInicio = dataInicio;
  state.activeFilters.dataFim = dataFim;

  await executeSearch();
}

async function executeSearch() {
  const btn = document.getElementById('btn-search-submit');
  const originalText = btn.innerHTML;
  btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> <span>Pesquisando...</span>`;
  btn.disabled = true;

  try {
    const params = new URLSearchParams();
    if (state.activeFilters.politico) params.append('politico', state.activeFilters.politico);
    if (state.activeFilters.assunto) params.append('assunto', state.activeFilters.assunto);
    if (state.activeFilters.dataInicio) params.append('dataInicio', state.activeFilters.dataInicio);
    if (state.activeFilters.dataFim) params.append('dataFim', state.activeFilters.dataFim);
    if (state.activeFilters.source) params.append('source', state.activeFilters.source);

    const res = await fetch(`/api/search?${params.toString()}`);
    const data = await res.json();

    if (data.success) {
      state.articles = data.results || [];
      renderNewsResults();
      renderActiveFilterTags();
      
      // Atualizar ranking de políticos se pesquisou um nome
      if (state.activeFilters.politico) {
        loadPoliticiansRanking(false);
      }
    } else {
      showToast('Erro ao realizar busca de notícias.', 'error');
    }
  } catch (err) {
    console.error('Erro na requisição de busca:', err);
    showToast('Falha na comunicação com o servidor de notícias.', 'error');
  } finally {
    btn.innerHTML = originalText;
    btn.disabled = false;
  }
}

// Renderiza os cards de notícias
function renderNewsResults() {
  const container = document.getElementById('news-results-grid');
  const emptyState = document.getElementById('news-empty-state');
  const countLabel = document.getElementById('results-count-label');

  if (!state.articles || state.articles.length === 0) {
    container.innerHTML = '';
    emptyState.classList.remove('hidden');
    countLabel.textContent = '0 notícias encontradas';
    return;
  }

  emptyState.classList.add('hidden');
  countLabel.textContent = `${state.articles.length} notícias encontradas`;

  // Ordenação
  const sortedArticles = [...state.articles];
  if (state.sortBy === 'recent') {
    sortedArticles.sort((a, b) => new Date(b.publishedDate).getTime() - new Date(a.publishedDate).getTime());
  }

  container.innerHTML = sortedArticles.map((article, index) => {
    const dateFormatted = formatDateBR(article.publishedDate);
    const timeAgo = formatTimeAgo(article.publishedDate);
    const sourceClass = getSourceBadgeClass(article.source);

    return `
      <article class="news-card bg-white rounded-2xl border border-slate-200/90 p-5 flex flex-col justify-between shadow-sm relative overflow-hidden">
        
        <div>
          <!-- Cabeçalho do Card: Fonte & Data -->
          <div class="flex items-center justify-between gap-2 mb-3">
            <span class="${sourceClass} text-[11px] font-bold px-2.5 py-0.5 rounded-md border flex items-center gap-1.5">
              <i class="fa-regular fa-newspaper text-[10px]"></i> ${escapeHtml(article.source || 'Portal')}
            </span>
            <span class="text-[11px] text-slate-500 font-medium flex items-center gap-1" title="${dateFormatted}">
              <i class="fa-regular fa-clock text-[10px]"></i> ${timeAgo}
            </span>
          </div>

          <!-- Título da Matéria -->
          <h3 class="text-sm font-bold text-slate-900 leading-snug line-clamp-2 hover:text-blue-600 transition">
            <a href="javascript:void(0)" onclick="trackSiteClick('${article.siteId || ''}', '${escapeHtml(article.source)}', '${article.url}')">
              ${escapeHtml(article.title)}
            </a>
          </h3>

          <!-- Trecho / Resumo -->
          <p class="text-xs text-slate-600 line-clamp-3 mt-2 leading-relaxed">
            ${escapeHtml(article.snippet)}
          </p>
        </div>

        <!-- Rodapé do Card: Tags e Botão de Ação -->
        <div class="pt-4 mt-3 border-t border-slate-100 flex flex-col gap-2.5">
          <div class="flex flex-wrap items-center gap-1.5">
            ${article.politician ? `
              <button onclick="quickSearchPolitico('${escapeHtml(article.politician)}')" class="inline-flex items-center gap-1 text-[10px] font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 px-2 py-0.5 rounded-full transition">
                <i class="fa-solid fa-user-tie text-[9px]"></i> ${escapeHtml(article.politician)}
              </button>
            ` : ''}
            ${article.subject ? `
              <span class="inline-flex items-center gap-1 text-[10px] font-medium text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full">
                <i class="fa-solid fa-tag text-[9px]"></i> ${escapeHtml(article.subject)}
              </span>
            ` : ''}
            ${article.isLive ? `
              <span class="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                <i class="fa-solid fa-bolt text-[9px]"></i> Ao Vivo
              </span>
            ` : ''}
          </div>

          <div class="flex items-center justify-between gap-2">
            <button 
              onclick="trackSiteClick('${article.siteId || ''}', '${escapeHtml(article.source)}', '${article.url}')" 
              class="w-full text-xs font-bold text-white bg-slate-900 hover:bg-blue-600 py-2 px-3 rounded-xl transition flex items-center justify-center gap-1.5 shadow-sm"
            >
              <span>Ler Matéria Completa</span>
              <i class="fa-solid fa-arrow-up-right-from-square text-[10px]"></i>
            </button>
            
            <button 
              onclick="copyNewsLink('${escapeHtml(article.title)}', '${article.url}')" 
              class="p-2 text-slate-400 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition shrink-0" 
              title="Copiar / Compartilhar"
            >
              <i class="fa-regular fa-share-from-square text-xs"></i>
            </button>
          </div>
        </div>

      </article>
    `;
  }).join('');
}

// Executa busca padrão inicial
function runDefaultSearch() {
  setDatePreset('30d');
  executeSearch();
}

// Pesquisa rápida ao clicar em um nome de político
function quickSearchPolitico(politicoName) {
  document.getElementById('input-politico').value = politicoName;
  state.activeFilters.politico = politicoName;
  switchTab('search');
  executeSearch();
  showToast(`Buscando notícias sobre: ${politicoName}`, 'info');
}

// Presets rápidos de data ("raio da notícia")
function setDatePreset(preset) {
  const inputInicio = document.getElementById('input-data-inicio');
  const inputFim = document.getElementById('input-data-fim');
  const now = new Date();

  const formatDateYMD = (d) => d.toISOString().split('T')[0];

  inputFim.value = formatDateYMD(now);

  if (preset === 'today') {
    inputInicio.value = formatDateYMD(now);
  } else if (preset === '7d') {
    const past = new Date();
    past.setDate(past.getDate() - 7);
    inputInicio.value = formatDateYMD(past);
  } else if (preset === '30d') {
    const past = new Date();
    past.setDate(past.getDate() - 30);
    inputInicio.value = formatDateYMD(past);
  } else if (preset === 'all') {
    inputInicio.value = '';
    inputFim.value = '';
  }

  state.activeFilters.dataInicio = inputInicio.value;
  state.activeFilters.dataFim = inputFim.value;
}

// Limpar todos os filtros da busca
function resetSearchFilters() {
  document.getElementById('input-politico').value = '';
  document.getElementById('input-assunto').value = '';
  document.getElementById('input-data-inicio').value = '';
  document.getElementById('input-data-fim').value = '';

  state.activeFilters = {
    politico: '',
    assunto: '',
    dataInicio: '',
    dataFim: '',
    source: ''
  };

  renderActiveFilterTags();
}

// Renderiza tags dos filtros ativos com botão para remover
function renderActiveFilterTags() {
  const container = document.getElementById('active-tags-container');
  container.innerHTML = '';

  if (state.activeFilters.politico) {
    container.innerHTML += `
      <span class="inline-flex items-center gap-1 bg-blue-100 text-blue-800 px-2 py-0.5 rounded text-[11px] font-semibold">
        Político: ${escapeHtml(state.activeFilters.politico)}
        <button onclick="removeFilter('politico')" class="hover:text-blue-950 font-bold ml-0.5">&times;</button>
      </span>
    `;
  }
  if (state.activeFilters.assunto) {
    container.innerHTML += `
      <span class="inline-flex items-center gap-1 bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded text-[11px] font-semibold">
        Assunto: ${escapeHtml(state.activeFilters.assunto)}
        <button onclick="removeFilter('assunto')" class="hover:text-indigo-950 font-bold ml-0.5">&times;</button>
      </span>
    `;
  }
  if (state.activeFilters.dataInicio || state.activeFilters.dataFim) {
    const dIni = state.activeFilters.dataInicio ? formatDateShort(state.activeFilters.dataInicio) : 'Início';
    const dFim = state.activeFilters.dataFim ? formatDateShort(state.activeFilters.dataFim) : 'Hoje';
    container.innerHTML += `
      <span class="inline-flex items-center gap-1 bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded text-[11px] font-semibold">
        Período: ${dIni} até ${dFim}
        <button onclick="removeFilter('dates')" class="hover:text-emerald-950 font-bold ml-0.5">&times;</button>
      </span>
    `;
  }
}

function removeFilter(type) {
  if (type === 'politico') {
    document.getElementById('input-politico').value = '';
    state.activeFilters.politico = '';
  } else if (type === 'assunto') {
    document.getElementById('input-assunto').value = '';
    state.activeFilters.assunto = '';
  } else if (type === 'dates') {
    document.getElementById('input-data-inicio').value = '';
    document.getElementById('input-data-fim').value = '';
    state.activeFilters.dataInicio = '';
    state.activeFilters.dataFim = '';
  }
  executeSearch();
}

function sortNewsResults() {
  const select = document.getElementById('select-sort');
  state.sortBy = select.value;
  renderNewsResults();
}

// ========================================================
// 3. FUNÇÃO BASE 4: TOP 10 POLÍTICOS MAIS BUSCADOS
// ========================================================
async function loadPoliticiansRanking(notify = false) {
  try {
    const res = await fetch('/api/rankings/politicians');
    const data = await res.json();

    if (data.success) {
      state.politiciansTop10 = data.top10 || [];
      state.totalSearches = data.totalSearches || 0;

      const counter = document.getElementById('total-searches-counter');
      if (counter) counter.textContent = state.totalSearches.toLocaleString('pt-BR');

      renderPoliticiansRanking();
      if (notify) showToast('Ranking de políticos atualizado!', 'success');
    }
  } catch (err) {
    console.error('Erro ao carregar ranking de políticos:', err);
  }
}

function renderPoliticiansRanking() {
  const podiumEl = document.getElementById('politicians-podium');
  const tableEl = document.getElementById('politicians-list-table');

  if (!state.politiciansTop10 || state.politiciansTop10.length === 0) return;

  const top3 = state.politiciansTop10.slice(0, 3);
  const rest = state.politiciansTop10.slice(3, 10);
  const maxSearches = state.politiciansTop10[0]?.searchCount || 1;

  // Renderiza Pódio (Top 3)
  const podiumMedalConfig = [
    { rank: 1, title: '1º Lugar', medal: '🥇', class: 'podium-gold', border: 'border-amber-400', badge: 'bg-amber-100 text-amber-900 border-amber-300' },
    { rank: 2, title: '2º Lugar', medal: '🥈', class: 'podium-silver', border: 'border-slate-300', badge: 'bg-slate-100 text-slate-800 border-slate-300' },
    { rank: 3, title: '3º Lugar', medal: '🥉', class: 'podium-bronze', border: 'border-orange-300', badge: 'bg-orange-100 text-orange-900 border-orange-300' }
  ];

  podiumEl.innerHTML = top3.map((pol, idx) => {
    const conf = podiumMedalConfig[idx] || podiumMedalConfig[0];
    const percent = Math.round((pol.searchCount / maxSearches) * 100);

    return `
      <div class="${conf.class} rounded-2xl p-5 border relative overflow-hidden flex flex-col justify-between">
        <div class="flex items-start justify-between gap-2">
          <div class="flex items-center gap-3">
            <div class="relative">
              <img src="${pol.avatar}" alt="${escapeHtml(pol.name)}" class="w-14 h-14 rounded-2xl object-cover border-2 ${conf.border} shadow-sm" onerror="this.src='https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=160'">
              <span class="absolute -bottom-1.5 -right-1 text-lg">${conf.medal}</span>
            </div>
            <div>
              <span class="${conf.badge} text-[10px] font-extrabold px-2 py-0.5 rounded border uppercase tracking-wider">
                ${conf.title}
              </span>
              <h3 class="text-base font-extrabold text-slate-900 mt-1">${escapeHtml(pol.popularName || pol.name)}</h3>
              <p class="text-xs text-slate-600 font-medium">${escapeHtml(pol.party)} &bull; ${escapeHtml(pol.office)}</p>
            </div>
          </div>
        </div>

        <div class="mt-4 pt-4 border-t border-slate-200/60">
          <div class="flex justify-between items-baseline mb-1">
            <span class="text-xs font-semibold text-slate-600">Volume de Buscas</span>
            <span class="text-base font-extrabold text-slate-900">${pol.searchCount.toLocaleString('pt-BR')} <span class="text-[11px] font-semibold text-slate-500">buscas</span></span>
          </div>
          
          <div class="w-full bg-slate-200/80 rounded-full h-2.5 overflow-hidden">
            <div class="bg-blue-600 h-2.5 rounded-full ranking-bar-fill" style="width: ${percent}%"></div>
          </div>

          <div class="flex items-center justify-between gap-2 mt-4">
            <button onclick="quickSearchPolitico('${escapeHtml(pol.popularName || pol.name)}')" class="flex-1 py-2 px-3 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-sm transition flex items-center justify-center gap-1.5">
              <i class="fa-solid fa-magnifying-glass text-[10px]"></i> Ver Notícias
            </button>
            <button onclick="incrementPoliticianSearch('${pol.id}')" class="py-2 px-3 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 font-bold text-xs rounded-xl transition shadow-sm" title="Simular +1 busca no teste do MVP">
              +1 Busca
            </button>
          </div>
        </div>
      </div>
    `;
  }).join('');

  // Renderiza Posições #4 a #10
  tableEl.innerHTML = rest.map((pol) => {
    const percent = Math.round((pol.searchCount / maxSearches) * 100);

    return `
      <div class="p-4 sm:px-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 hover:bg-slate-50/80 transition">
        
        <div class="flex items-center gap-3 w-full sm:w-auto">
          <span class="w-7 h-7 rounded-lg bg-slate-100 text-slate-700 font-extrabold text-xs flex items-center justify-center border border-slate-200 shrink-0">
            #${pol.rank}
          </span>
          <img src="${pol.avatar}" alt="${escapeHtml(pol.name)}" class="w-10 h-10 rounded-xl object-cover border border-slate-200" onerror="this.src='https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=160'">
          <div>
            <div class="flex items-center gap-2">
              <h4 class="text-sm font-bold text-slate-900">${escapeHtml(pol.popularName || pol.name)}</h4>
              <span class="bg-blue-50 text-blue-700 font-bold text-[10px] px-1.5 py-0.5 rounded border border-blue-200">${escapeHtml(pol.party)}</span>
            </div>
            <p class="text-xs text-slate-500">${escapeHtml(pol.office)}</p>
          </div>
        </div>

        <div class="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-end">
          <div class="text-right sm:min-w-[140px]">
            <span class="text-sm font-extrabold text-slate-900">${pol.searchCount.toLocaleString('pt-BR')}</span>
            <span class="text-[11px] text-slate-500 font-medium"> buscas</span>
            <div class="w-28 bg-slate-100 rounded-full h-1.5 mt-1 overflow-hidden ml-auto">
              <div class="bg-blue-500 h-1.5 rounded-full ranking-bar-fill" style="width: ${percent}%"></div>
            </div>
          </div>

          <div class="flex items-center gap-1.5">
            <button onclick="quickSearchPolitico('${escapeHtml(pol.popularName || pol.name)}')" class="px-3 py-1.5 bg-slate-100 hover:bg-blue-50 text-slate-700 hover:text-blue-700 font-bold text-xs rounded-lg border border-slate-200 transition">
              Pesquisar
            </button>
            <button onclick="incrementPoliticianSearch('${pol.id}')" class="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-xs rounded-lg transition" title="Incrementar +1">
              +1
            </button>
          </div>
        </div>

      </div>
    `;
  }).join('');
}

// Incremento de busca interativo
async function incrementPoliticianSearch(polId) {
  try {
    const res = await fetch('/api/rankings/politicians/increment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: polId })
    });
    const data = await res.json();
    if (data.success) {
      loadPoliticiansRanking(false);
      showToast(`+1 busca registrada para ${data.politician.popularName || data.politician.name}!`, 'success');
    }
  } catch (err) {
    console.error('Erro ao incrementar político:', err);
  }
}

// ========================================================
// 4. FUNÇÃO BASE 3: TOP 10 SITES MAIS ACESSADOS NO APP
// ========================================================
async function loadSitesRanking(notify = false) {
  try {
    const res = await fetch('/api/rankings/sites');
    const data = await res.json();

    if (data.success) {
      state.sitesTop10 = data.top10 || [];
      state.totalClicks = data.totalClicks || 0;

      const counter = document.getElementById('total-clicks-counter');
      if (counter) counter.textContent = state.totalClicks.toLocaleString('pt-BR');

      renderSitesRanking();
      if (notify) showToast('Ranking de sites atualizado!', 'success');
    }
  } catch (err) {
    console.error('Erro ao carregar ranking de sites:', err);
  }
}

function renderSitesRanking() {
  const grid = document.getElementById('sites-ranking-grid');
  if (!state.sitesTop10 || state.sitesTop10.length === 0) return;

  const maxClicks = state.sitesTop10[0]?.clicks || 1;

  grid.innerHTML = state.sitesTop10.map((site) => {
    const percent = Math.round((site.clicks / maxClicks) * 100);
    const isTop3 = site.rank <= 3;
    const rankBadgeClass = site.rank === 1 ? 'bg-amber-400 text-slate-950 font-black' :
                           site.rank === 2 ? 'bg-slate-300 text-slate-900 font-black' :
                           site.rank === 3 ? 'bg-orange-300 text-slate-900 font-black' :
                           'bg-slate-100 text-slate-700 font-bold';

    return `
      <div class="bg-white rounded-2xl border ${isTop3 ? 'border-indigo-200 shadow-sm' : 'border-slate-200'} p-5 flex flex-col justify-between hover:shadow-md transition">
        
        <div>
          <!-- Header do Site -->
          <div class="flex items-start justify-between gap-3">
            <div class="flex items-center gap-3">
              <span class="w-8 h-8 rounded-xl ${rankBadgeClass} text-xs flex items-center justify-center shadow-xs">
                #${site.rank}
              </span>
              <div class="w-10 h-10 rounded-xl bg-slate-100 text-slate-800 flex items-center justify-center text-xl shrink-0 border border-slate-200">
                ${site.logo || '🌐'}
              </div>
              <div>
                <div class="flex items-center gap-1.5">
                  <h3 class="text-sm font-bold text-slate-900">${escapeHtml(site.name)}</h3>
                  ${site.verified ? '<i class="fa-solid fa-circle-check text-blue-500 text-xs" title="Portal Verificado"></i>' : ''}
                </div>
                <span class="text-xs text-slate-500 font-medium">${escapeHtml(site.domain)}</span>
              </div>
            </div>

            ${site.badge ? `
              <span class="text-[10px] font-bold px-2 py-0.5 rounded-full ${site.isMonetizedPartner ? 'bg-amber-50 text-amber-800 border border-amber-200' : 'bg-slate-100 text-slate-600'}">
                ${escapeHtml(site.badge)}
              </span>
            ` : ''}
          </div>

          <div class="mt-3">
            <span class="text-[11px] font-semibold text-slate-500 bg-slate-50 px-2 py-1 rounded-md border border-slate-100">
              Categoria: ${escapeHtml(site.category || 'Jornalismo Político')}
            </span>
          </div>
        </div>

        <!-- Métricas de Tráfego & Cliques -->
        <div class="pt-4 mt-4 border-t border-slate-100">
          <div class="flex justify-between items-baseline mb-1.5">
            <span class="text-xs font-semibold text-slate-600">Cliques no Aplicativo</span>
            <span class="text-sm font-extrabold text-indigo-700">${site.clicks.toLocaleString('pt-BR')} <span class="text-[11px] font-medium text-slate-500">acessos</span></span>
          </div>

          <div class="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
            <div class="bg-indigo-600 h-2 rounded-full ranking-bar-fill" style="width: ${percent}%"></div>
          </div>

          <div class="flex items-center gap-2 mt-4">
            <button 
              onclick="trackSiteClick('${site.id}', '${escapeHtml(site.name)}', '${site.url}')" 
              class="flex-1 py-2 px-3 bg-indigo-50 hover:bg-indigo-100 text-indigo-800 font-bold text-xs rounded-xl transition flex items-center justify-center gap-1.5 border border-indigo-200"
            >
              <span>Acessar Portal</span>
              <i class="fa-solid fa-arrow-up-right-from-square text-[10px]"></i>
            </button>
            <button 
              onclick="simulateSiteClick('${site.id}')" 
              class="py-2 px-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition" 
              title="Testar +1 clique em tempo real"
            >
              +1 Clique
            </button>
          </div>
        </div>

      </div>
    `;
  }).join('');
}

// Rastrear clique externo e redirecionar / abrir aba
async function trackSiteClick(siteId, siteName, targetUrl) {
  try {
    // Registra clique no backend de forma assíncrona
    await fetch('/api/sites/click', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ siteId, siteName, targetUrl })
    });
    
    // Atualiza estatísticas locais
    loadSitesRanking(false);
  } catch (err) {
    console.warn('Erro ao registrar clique de site:', err);
  } finally {
    if (targetUrl && targetUrl !== '#' && !targetUrl.startsWith('javascript')) {
      window.open(targetUrl, '_blank', 'noopener,noreferrer');
    }
  }
}

// Simular clique rápido no botão de teste
async function simulateSiteClick(siteId) {
  try {
    const res = await fetch('/api/sites/click', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ siteId })
    });
    const data = await res.json();
    if (data.success) {
      loadSitesRanking(false);
      showToast(`+1 clique registrado para ${data.site.name}!`, 'success');
    }
  } catch (err) {
    console.error('Erro:', err);
  }
}

// ========================================================
// 5. FUNÇÃO BASE 2: BLOGS & NOTÍCIAS POLÍTICAS (MONETIZADO)
// ========================================================
async function loadBlogsList() {
  try {
    const params = new URLSearchParams();
    if (state.selectedBlogCategory) params.append('category', state.selectedBlogCategory);
    if (state.sponsoredOnlyBlogs) params.append('sponsoredOnly', 'true');

    const res = await fetch(`/api/blogs?${params.toString()}`);
    const data = await res.json();

    if (data.success) {
      state.blogs = data.blogs || [];
      renderBlogsGrid();
    }
  } catch (err) {
    console.error('Erro ao carregar blogs:', err);
  }
}

function renderBlogsGrid() {
  const grid = document.getElementById('blogs-grid');
  if (!state.blogs || state.blogs.length === 0) {
    grid.innerHTML = `
      <div class="col-span-full text-center py-10 bg-white rounded-2xl border border-dashed border-slate-300 p-6">
        <p class="text-sm font-bold text-slate-700">Nenhum blog encontrado para esta categoria.</p>
      </div>
    `;
    return;
  }

  grid.innerHTML = state.blogs.map((blog) => {
    return `
      <div class="bg-white rounded-2xl border ${blog.isSponsored ? 'border-amber-300 shadow-sm' : 'border-slate-200'} p-5 flex flex-col justify-between hover:shadow-md transition relative">
        
        ${blog.isSponsored ? `
          <div class="flex items-center justify-between mb-2">
            <span class="bg-amber-100 text-amber-900 border border-amber-300 text-[10px] font-extrabold px-2 py-0.5 rounded uppercase tracking-wider flex items-center gap-1">
              <i class="fa-solid fa-crown text-[10px]"></i> ${escapeHtml(blog.badgeText || 'Parceiro VIP')}
            </span>
            <span class="text-xs font-bold text-amber-600 flex items-center gap-1">
              <i class="fa-solid fa-star text-[11px]"></i> ${blog.rating || '4.9'}
            </span>
          </div>
        ` : ''}

        <div>
          <h3 class="text-base font-extrabold text-slate-900 mt-1">${escapeHtml(blog.name)}</h3>
          <p class="text-xs text-slate-500 font-medium">Por: ${escapeHtml(blog.author)} &bull; ${escapeHtml(blog.domain)}</p>

          <p class="text-xs text-slate-600 mt-2.5 leading-relaxed line-clamp-3">
            ${escapeHtml(blog.description)}
          </p>

          <!-- Selos e Modelo de Monetização -->
          <div class="mt-4 p-3 bg-slate-50 rounded-xl space-y-1.5 text-[11px] border border-slate-100">
            <div class="flex justify-between">
              <span class="text-slate-500 font-medium">Audiência Estimada:</span>
              <span class="font-bold text-slate-800">${escapeHtml(blog.monthlyAudience || 'Auditando')}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-slate-500 font-medium">Modelo Comercial:</span>
              <span class="font-semibold text-slate-800">${escapeHtml(blog.monetizationModel || 'Banners & Posts')}</span>
            </div>
            <div class="flex justify-between border-t border-slate-200/60 pt-1">
              <span class="text-slate-500 font-medium">Espaço de Anúncio:</span>
              <span class="font-extrabold text-emerald-600">${escapeHtml(blog.adSpotPrice || 'Sob Consulta')}</span>
            </div>
          </div>
        </div>

        <div class="flex items-center gap-2 mt-5 pt-3 border-t border-slate-100">
          <button 
            onclick="trackSiteClick('${blog.id}', '${escapeHtml(blog.name)}', '${blog.url}')" 
            class="flex-1 py-2 px-3 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl transition flex items-center justify-center gap-1.5"
          >
            <span>Acessar Blog</span>
            <i class="fa-solid fa-arrow-up-right-from-square text-[10px]"></i>
          </button>
          <button 
            onclick="openAdvertiserModal('Patrocínio: ${escapeHtml(blog.name)}')" 
            class="py-2 px-3 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 font-bold text-xs rounded-xl transition"
          >
            Patrocinar
          </button>
        </div>

      </div>
    `;
  }).join('');
}

function filterBlogsByCategory(category) {
  state.selectedBlogCategory = category;
  
  // Atualizar visual dos botões
  document.querySelectorAll('.blog-cat-btn').forEach(btn => {
    if ((!category && btn.textContent === 'Todas') || btn.textContent.includes(category)) {
      btn.className = 'blog-cat-btn active px-3 py-1 rounded-lg bg-slate-900 text-white font-semibold';
    } else {
      btn.className = 'blog-cat-btn px-3 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold';
    }
  });

  loadBlogsList();
}

// Cadastro de novo blog
async function handleRegisterBlog(e) {
  e.preventDefault();
  const name = document.getElementById('blog-input-name').value.trim();
  const author = document.getElementById('blog-input-author').value.trim();
  const category = document.getElementById('blog-input-category').value;
  const url = document.getElementById('blog-input-url').value.trim();
  const description = document.getElementById('blog-input-desc').value.trim();
  const isSponsored = document.getElementById('blog-input-sponsored').checked;

  try {
    const res = await fetch('/api/blogs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, author, category, url, description, isSponsored })
    });
    const data = await res.json();

    if (data.success) {
      showToast('Blog cadastrado com sucesso!', 'success');
      closeModal('modal-blog');
      document.getElementById('form-register-blog').reset();
      loadBlogsList();
      loadSitesRanking();
    } else {
      showToast(data.error || 'Erro ao cadastrar blog.', 'error');
    }
  } catch (err) {
    showToast('Falha na comunicação com o servidor.', 'error');
  }
}

// ========================================================
// 6. PAINEL DE MONETIZAÇÃO, ADS & LEADS
// ========================================================
async function loadMonetizationStats() {
  try {
    const res = await fetch('/api/monetization/stats');
    const data = await res.json();

    if (data.success && data.monetization) {
      const m = data.monetization;
      document.getElementById('monet-impressions').textContent = (m.totalImpressions || 0).toLocaleString('pt-BR');
      document.getElementById('monet-clicks').textContent = (m.totalClicks || 0).toLocaleString('pt-BR');
      document.getElementById('monet-ctr').textContent = m.ctr || '0.00%';
      document.getElementById('monet-revenue').textContent = `R$ ${(m.estimatedRevenueBRL || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
    }
  } catch (err) {
    console.error('Erro ao carregar dados de monetização:', err);
  }
}

async function simulateAdImpression() {
  try {
    await fetch('/api/monetization/log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'impression' })
    });
    loadMonetizationStats();
    showToast('+1 Impressão contabilizada no painel de receita!', 'info');
  } catch (err) {
    console.error(err);
  }
}

async function logAdClick(adId, targetUrl) {
  try {
    await fetch('/api/monetization/log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'click', adId })
    });
    loadMonetizationStats();
  } catch (err) {
    console.error(err);
  } finally {
    if (targetUrl && targetUrl !== '#') {
      window.open(targetUrl, '_blank');
    }
  }
}

// Formulário de Proposta Comercial / Lead de Anúncio
async function handleAdvertiserLead(e) {
  e.preventDefault();
  const name = document.getElementById('adv-input-name').value.trim();
  const email = document.getElementById('adv-input-email').value.trim();
  const company = document.getElementById('adv-input-company').value.trim();
  const plan = document.getElementById('adv-input-plan').value;
  const notes = document.getElementById('adv-input-notes').value.trim();

  try {
    const res = await fetch('/api/monetization/advertiser-request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, company, plan, notes })
    });
    const data = await res.json();

    if (data.success) {
      showToast('Solicitação enviada com sucesso! Proposta gerada.', 'success');
      closeModal('modal-advertiser');
      document.getElementById('form-advertiser').reset();
    } else {
      showToast(data.error || 'Erro ao enviar solicitação.', 'error');
    }
  } catch (err) {
    showToast('Falha ao enviar contato comercial.', 'error');
  }
}

// ========================================================
// 7. MODAIS E UTILITÁRIOS
// ========================================================
function openBlogRegisterModal() {
  document.getElementById('modal-blog').classList.remove('hidden');
}

function openAdvertiserModal(planName = 'Plano Corporativo') {
  document.getElementById('adv-input-plan').value = planName;
  document.getElementById('modal-advertiser').classList.remove('hidden');
}

function closeModal(modalId) {
  document.getElementById(modalId).classList.add('hidden');
}

function copyNewsLink(title, url) {
  const text = `${title}\n${url}`;
  navigator.clipboard.writeText(text).then(() => {
    showToast('Link da notícia copiado para a área de transferência!', 'success');
  }).catch(() => {
    showToast('Não foi possível copiar o link.', 'info');
  });
}

// Feedback Toast
function showToast(msg, type = 'info') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  
  const bgClass = type === 'success' ? 'bg-emerald-600 text-white' :
                  type === 'error' ? 'bg-rose-600 text-white' :
                  'bg-slate-900 text-white';

  const iconClass = type === 'success' ? 'fa-circle-check' :
                    type === 'error' ? 'fa-triangle-exclamation' :
                    'fa-circle-info';

  toast.className = `toast-msg flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-lg text-xs font-semibold ${bgClass} pointer-events-auto transition-all`;
  toast.innerHTML = `<i class="fa-solid ${iconClass}"></i> <span>${escapeHtml(msg)}</span>`;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// Formatação de datas em Português
function formatDateBR(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatDateShort(dateStr) {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
  return dateStr;
}

function formatTimeAgo(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const now = new Date();
  const diffSec = Math.floor((now - date) / 1000);

  if (diffSec < 60) return 'Agora mesmo';
  if (diffSec < 3600) return `Há ${Math.floor(diffSec / 60)} min`;
  if (diffSec < 86400) return `Há ${Math.floor(diffSec / 3600)} h`;
  const diffDays = Math.floor(diffSec / 86400);
  if (diffDays === 1) return 'Ontem';
  if (diffDays < 30) return `Há ${diffDays} dias`;
  return formatDateBR(dateStr);
}

function getSourceBadgeClass(source) {
  const norm = (source || '').toLowerCase();
  if (norm.includes('g1')) return 'bg-red-50 text-red-700 border-red-200';
  if (norm.includes('folha')) return 'bg-blue-50 text-blue-700 border-blue-200';
  if (norm.includes('congresso')) return 'bg-amber-50 text-amber-800 border-amber-200';
  if (norm.includes('poder360')) return 'bg-indigo-50 text-indigo-700 border-indigo-200';
  if (norm.includes('metrópoles') || norm.includes('metropoles')) return 'bg-orange-50 text-orange-700 border-orange-200';
  if (norm.includes('antagonista')) return 'bg-slate-100 text-slate-800 border-slate-300';
  return 'bg-slate-50 text-slate-700 border-slate-200';
}

function escapeHtml(text) {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function initDatePresets() {
  const chk = document.getElementById('checkbox-sponsored-only');
  if (chk) {
    chk.addEventListener('change', (e) => {
      state.sponsoredOnlyBlogs = e.target.checked;
      loadBlogsList();
    });
  }
}
