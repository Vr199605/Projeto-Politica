/**
 * RADAR POLÍTICO - Application Logic v3.0
 * Layout fiel ao Wireframe:
 * - Linha 1: Doação / TOP 10 DONATE + LOGIN
 * - Linha 2: TOP 5 POLÍTICOS (com fotos reais e badges ao vivo)
 * - Linha 3: TOP 5 SITES DE NOTÍCIAS (com logos oficiais SVG)
 * - Abas: [ BUSCA ] | [ POLÍTICO ONLINE ]
 * - Grid: Esquerda (BUSCA / RESULTADOS) | Direita (ANUNCIANTES Skyscraper)
 * - Busca em tempo real (as-you-type debounced) e zero imagens quebradas/fictícias.
 */

// Estado global da aplicação
const state = {
  currentTab: 'search',
  currentUser: null,
  favoritePoliticianIds: new Set(),
  favoriteBlogIds: new Set(),
  articles: [],
  politicians: [],
  sites: [],
  socialPoliticians: [],
  donations: {
    topDonators: [],
    currentTotal: 0,
    goal: 10000,
    pixKey: 'pix@radarpolitico.com.br'
  },
  activeFilters: {
    politico: '',
    assunto: '',
    dataInicio: '',
    dataFim: '',
    source: ''
  },
  sortBy: 'recent',
  currentSocialFilter: 'all',
  currentFavTab: 'politicians',
  debounceSearchTimeout: null
};

// Inicialização ao carregar a página
document.addEventListener('DOMContentLoaded', () => {
  initAuth();
  initRealtimeSearch();
  loadDonations();
  loadPoliticiansRanking();
  loadSitesRanking();
  loadSocialStatus();
  runDefaultSearch(false);
});

// ========================================================
// 1. SISTEMA DE AUTENTICAÇÃO E SESSÃO
// ========================================================
function initAuth() {
  const savedUser = localStorage.getItem('rp_user');
  if (savedUser) {
    try {
      state.currentUser = JSON.parse(savedUser);
      updateHeaderAuthUI();
      loadUserFavorites();
    } catch (e) {
      localStorage.removeItem('rp_user');
    }
  } else {
    const localFavP = JSON.parse(localStorage.getItem('rp_fav_p') || '[]');
    const localFavB = JSON.parse(localStorage.getItem('rp_fav_b') || '[]');
    state.favoritePoliticianIds = new Set(localFavP);
    state.favoriteBlogIds = new Set(localFavB);
    updateFavBadge();
  }
}

function updateHeaderAuthUI() {
  const btnLogin = document.getElementById('btn-header-login');
  const userMenu = document.getElementById('user-profile-menu');
  const avatar = document.getElementById('user-header-avatar');
  const name = document.getElementById('user-header-name');

  if (state.currentUser) {
    if (btnLogin) btnLogin.classList.add('hidden');
    if (userMenu) userMenu.classList.remove('hidden');
    if (avatar) avatar.src = state.currentUser.avatar || '/assets/politicians/lula.jpg';
    if (name) name.textContent = state.currentUser.name.split(' ')[0];
  } else {
    if (btnLogin) btnLogin.classList.remove('hidden');
    if (userMenu) userMenu.classList.add('hidden');
  }
}

async function loadUserFavorites() {
  if (!state.currentUser) return;
  try {
    const res = await fetch(`/api/users/${state.currentUser.id}/favorites`);
    const data = await res.json();
    if (data.success) {
      state.favoritePoliticianIds = new Set(data.rawPoliticianIds || []);
      state.favoriteBlogIds = new Set(data.rawBlogIds || []);
      updateFavBadge();
      updateFavoriteButtonsUI();
    }
  } catch (err) {
    console.error('Erro ao carregar favoritos:', err);
  }
}

function updateFavBadge() {
  const badge = document.getElementById('fav-counter-badge');
  const total = state.favoritePoliticianIds.size + state.favoriteBlogIds.size;
  if (badge) badge.textContent = total;
}

function updateFavoriteButtonsUI() {
  document.querySelectorAll('.btn-fav-article').forEach(btn => {
    const polId = btn.dataset.politicianId;
    if (polId && state.favoritePoliticianIds.has(polId)) {
      btn.classList.add('text-rose-600');
      btn.querySelector('i')?.classList.replace('fa-regular', 'fa-solid');
    } else {
      btn.classList.remove('text-rose-600');
      btn.querySelector('i')?.classList.replace('fa-solid', 'fa-regular');
    }
  });
}

function openAuthModal(tab = 'login') {
  document.getElementById('modal-auth')?.classList.remove('hidden');
  switchAuthTab(tab);
}

function switchAuthTab(tab) {
  const loginForm = document.getElementById('form-auth-login');
  const regForm = document.getElementById('form-auth-register');
  const btnLogin = document.getElementById('auth-tab-btn-login');
  const btnReg = document.getElementById('auth-tab-btn-register');

  if (tab === 'login') {
    loginForm?.classList.remove('hidden');
    regForm?.classList.add('hidden');
    if (btnLogin) btnLogin.className = 'text-base font-black pb-1 border-b-2 border-blue-600 text-blue-600';
    if (btnReg) btnReg.className = 'text-base font-bold pb-1 text-slate-400 hover:text-slate-700';
  } else {
    loginForm?.classList.add('hidden');
    regForm?.classList.remove('hidden');
    if (btnLogin) btnLogin.className = 'text-base font-bold pb-1 text-slate-400 hover:text-slate-700';
    if (btnReg) btnReg.className = 'text-base font-black pb-1 border-b-2 border-emerald-600 text-emerald-600';
  }
}

async function handleLoginSubmit(e) {
  e.preventDefault();
  const email = document.getElementById('login-input-email').value.trim();
  const password = document.getElementById('login-input-password').value;

  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    if (data.success) {
      state.currentUser = data.user;
      localStorage.setItem('rp_user', JSON.stringify(data.user));
      updateHeaderAuthUI();
      closeModal('modal-auth');
      await loadUserFavorites();
      showToast(`Bem-vindo, ${data.user.name}!`, 'success');
    } else {
      showToast(data.error || 'Credenciais inválidas.', 'error');
    }
  } catch (err) {
    showToast('Falha ao conectar ao servidor.', 'error');
  }
}

async function handleRegisterSubmit(e) {
  e.preventDefault();
  const name = document.getElementById('reg-input-name').value.trim();
  const email = document.getElementById('reg-input-email').value.trim();
  const password = document.getElementById('reg-input-password').value;

  try {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password })
    });
    const data = await res.json();
    if (data.success) {
      state.currentUser = data.user;
      localStorage.setItem('rp_user', JSON.stringify(data.user));
      updateHeaderAuthUI();
      closeModal('modal-auth');
      showToast(`Conta criada com sucesso! Olá, ${data.user.name}.`, 'success');
    } else {
      showToast(data.error || 'Erro ao cadastrar.', 'error');
    }
  } catch (err) {
    showToast('Falha no cadastro.', 'error');
  }
}

function handleLogout() {
  state.currentUser = null;
  localStorage.removeItem('rp_user');
  state.favoritePoliticianIds.clear();
  state.favoriteBlogIds.clear();
  updateHeaderAuthUI();
  updateFavBadge();
  updateFavoriteButtonsUI();
  showToast('Você saiu da sua conta.', 'info');
}

// ========================================================
// 2. LINHA 1: DOAÇÃO / TOP 10 DONATE
// ========================================================
async function loadDonations() {
  try {
    const res = await fetch('/api/donations');
    const data = await res.json();
    if (data.success && data.donations) {
      state.donations = data.donations;
      renderDonationTicker();
      renderModalDonatorsList();
    }
  } catch (err) {
    console.error('Erro ao carregar doações:', err);
  }
}

function renderDonationTicker() {
  const tickerEl = document.getElementById('ticker-top-donators');
  if (!tickerEl) return;

  const donators = state.donations.topDonators || [];
  if (donators.length === 0) {
    tickerEl.textContent = 'Seja o primeiro a apoiar a transparência política!';
    return;
  }

  // Monta ticker formatado dos 5 maiores apoiadores
  const topParts = donators.slice(0, 5).map((d, i) => {
    const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}º`;
    return `${medal} ${d.name}: R$ ${Number(d.amount).toLocaleString('pt-BR', { minimumFractionDigits: 0 })}`;
  });

  tickerEl.innerHTML = topParts.join(' <span class="text-slate-600 mx-1">•</span> ');
}

function openDonationModal() {
  document.getElementById('modal-donation')?.classList.remove('hidden');
  renderModalDonatorsList();
}

function renderModalDonatorsList() {
  const container = document.getElementById('modal-donators-list');
  const totalEl = document.getElementById('donation-current-total');
  if (totalEl) {
    totalEl.textContent = `Total: R$ ${Number(state.donations.currentTotal || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
  }
  if (!container) return;

  const donators = state.donations.topDonators || [];
  if (donators.length === 0) {
    container.innerHTML = '<p class="text-slate-500 text-center py-2">Nenhuma doação registrada ainda.</p>';
    return;
  }

  container.innerHTML = donators.map((d, index) => {
    const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `#${index + 1}`;
    return `
      <div class="py-2 flex items-center justify-between gap-2">
        <div class="flex items-center gap-2 overflow-hidden">
          <span class="font-black text-slate-800 w-6">${medal}</span>
          <div class="truncate">
            <span class="font-bold text-slate-900">${d.name}</span>
            <span class="text-[10px] text-slate-500 block truncate">"${d.message || 'Apoiador oficial'}"</span>
          </div>
        </div>
        <div class="text-right shrink-0">
          <span class="font-black text-emerald-700">R$ ${Number(d.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
          <span class="text-[9px] bg-emerald-100 text-emerald-800 font-extrabold px-1.5 py-0.2 rounded block">${d.badge || 'Apoiador'}</span>
        </div>
      </div>
    `;
  }).join('');
}

function setDonateAmount(val) {
  const input = document.getElementById('donate-input-amount');
  if (input) input.value = val;
}

function copyPixKey() {
  navigator.clipboard.writeText('pix@radarpolitico.com.br');
  showToast('Chave PIX copiada para a área de transferência!', 'success');
}

async function handleDonationSubmit(e) {
  e.preventDefault();
  const name = document.getElementById('donate-input-name').value.trim();
  const email = document.getElementById('donate-input-email').value.trim();
  const amount = document.getElementById('donate-input-amount').value;
  const message = document.getElementById('donate-input-msg').value.trim();

  try {
    const res = await fetch('/api/donations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, amount, message })
    });
    const data = await res.json();
    if (data.success) {
      state.donations.topDonators = data.topDonators;
      state.donations.currentTotal = data.currentTotal;
      renderDonationTicker();
      renderModalDonatorsList();
      showToast('Obrigado pelo apoio! Doação registrada com sucesso no Top 10.', 'success');
      document.getElementById('form-donate')?.reset();
    } else {
      showToast(data.error || 'Erro ao registrar doação.', 'error');
    }
  } catch (err) {
    showToast('Falha de conexão ao enviar doação.', 'error');
  }
}

// ========================================================
// 3. LINHA 2: TOP 5 POLÍTICOS MAIS BUSCADOS
// ========================================================
async function loadPoliticiansRanking() {
  try {
    const res = await fetch('/api/rankings/politicians');
    const data = await res.json();
    if (data.success) {
      state.politicians = data.top10 || [];
      renderTop5Politicians();
    }
  } catch (err) {
    console.error('Erro ao buscar ranking de políticos:', err);
  }
}

function renderTop5Politicians() {
  const container = document.getElementById('top5-politicians-container');
  if (!container) return;

  const top5 = state.politicians.slice(0, 5);

  container.innerHTML = top5.map((pol, index) => {
    const isLive = pol.socialStatus?.isLive;
    const rankNum = index + 1;
    const rankBadgeClass = rankNum === 1 ? 'bg-amber-500 text-slate-950 font-black' :
                           rankNum === 2 ? 'bg-slate-300 text-slate-900 font-bold' :
                           rankNum === 3 ? 'bg-amber-700 text-white font-bold' :
                           'bg-slate-100 text-slate-700 font-bold';

    const liveBadge = isLive ? `
      <span class="inline-flex items-center gap-1 bg-rose-600 text-white text-[9px] font-black px-1.5 py-0.2 rounded-full animate-pulse shadow-xs">
        <span class="w-1.5 h-1.5 rounded-full bg-white"></span> AO VIVO
      </span>
    ` : `
      <span class="text-[9px] text-emerald-700 font-bold flex items-center gap-0.5">
        <span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> ONLINE
      </span>
    `;

    return `
      <div 
        onclick="quickSearchPolitico('${pol.popularName || pol.name}')"
        class="bg-slate-50 hover:bg-blue-50/70 border border-slate-200 hover:border-blue-300 rounded-xl p-2.5 transition cursor-pointer group flex flex-col justify-between"
        title="Clique para pesquisar matérias de ${pol.popularName}"
      >
        <div class="flex items-start justify-between gap-1.5 mb-2">
          <span class="w-5 h-5 rounded-md text-[11px] flex items-center justify-center ${rankBadgeClass}">
            #${rankNum}
          </span>
          ${liveBadge}
        </div>

        <div class="flex items-center gap-2 mb-1.5">
          <img 
            src="${pol.avatar || '/assets/politicians/lula.jpg'}" 
            alt="${pol.name}"
            class="w-10 h-10 rounded-full object-cover border-2 ${isLive ? 'border-rose-500 ring-2 ring-rose-200' : 'border-white shadow-xs'}"
            onerror="this.src='/assets/themes/brasilia.jpg'"
          >
          <div class="truncate">
            <h4 class="text-xs font-black text-slate-900 group-hover:text-blue-700 transition leading-tight truncate">
              ${pol.popularName}
            </h4>
            <span class="text-[10px] text-slate-500 font-bold block truncate">
              ${pol.party} • ${pol.office ? pol.office.split(' ')[0] : 'Líder'}
            </span>
          </div>
        </div>

        <div class="pt-1.5 border-t border-slate-200/60 flex items-center justify-between text-[10px] text-slate-500 font-semibold">
          <span>${Number(pol.searchCount || 0).toLocaleString('pt-BR')} buscas</span>
          <span class="text-blue-600 font-bold group-hover:underline">Filtrar ↗</span>
        </div>
      </div>
    `;
  }).join('');
}

// ========================================================
// 4. LINHA 3: TOP 5 SITES DE NOTÍCIAS MAIS ACESSADOS
// ========================================================
async function loadSitesRanking() {
  try {
    const res = await fetch('/api/rankings/sites');
    const data = await res.json();
    if (data.success) {
      state.sites = data.top10 || [];
      renderTop5Sites();
    }
  } catch (err) {
    console.error('Erro ao buscar ranking de sites:', err);
  }
}

function getOfficialLogoForSite(siteName) {
  const norm = (siteName || '').toLowerCase();
  if (norm.includes('g1')) return '/assets/logos/g1.svg';
  if (norm.includes('folha')) return '/assets/logos/folha.svg';
  if (norm.includes('metropoles')) return '/assets/logos/metropoles.svg';
  if (norm.includes('poder360')) return '/assets/logos/poder360.svg';
  if (norm.includes('congresso')) return '/assets/logos/congresso.svg';
  if (norm.includes('cnn')) return '/assets/logos/cnn.svg';
  if (norm.includes('antagonista')) return '/assets/logos/antagonista.svg';
  if (norm.includes('estadao')) return '/assets/logos/estadao.svg';
  if (norm.includes('uol')) return '/assets/logos/uol.svg';
  if (norm.includes('agencia brasil') || norm.includes('ebc')) return '/assets/logos/agenciabrasil.svg';
  return '/assets/logos/g1.svg';
}

function renderTop5Sites() {
  const container = document.getElementById('top5-sites-container');
  if (!container) return;

  const top5 = state.sites.slice(0, 5);

  container.innerHTML = top5.map((site, index) => {
    const rankNum = index + 1;
    const rankBadgeClass = rankNum === 1 ? 'bg-slate-900 text-white font-black' :
                           rankNum === 2 ? 'bg-slate-700 text-white font-bold' :
                           rankNum === 3 ? 'bg-slate-600 text-white font-bold' :
                           'bg-slate-200 text-slate-800 font-bold';

    const logoSvg = getOfficialLogoForSite(site.name);

    return `
      <div 
        onclick="filterBySourceAndTrack('${site.name}', '${site.url}', '${site.id}')"
        class="bg-slate-50 hover:bg-slate-100/90 border border-slate-200 hover:border-slate-300 rounded-xl p-2.5 transition cursor-pointer group flex flex-col justify-between"
        title="Clique para filtrar notícias de ${site.name}"
      >
        <div class="flex items-center justify-between mb-2">
          <span class="w-5 h-5 rounded-md text-[11px] flex items-center justify-center ${rankBadgeClass}">
            #${rankNum}
          </span>
          <span class="text-[9px] bg-blue-50 text-blue-700 font-extrabold px-1.5 py-0.2 rounded border border-blue-200 flex items-center gap-1">
            <i class="fa-solid fa-circle-check text-[8px]"></i> Verificado
          </span>
        </div>

        <div class="flex items-center gap-2 mb-2">
          <div class="w-10 h-7 bg-white rounded-md border border-slate-200 p-1 flex items-center justify-center shrink-0">
            <img src="${logoSvg}" alt="${site.name}" class="max-h-full max-w-full object-contain">
          </div>
          <div class="truncate">
            <h4 class="text-xs font-black text-slate-900 leading-tight truncate">
              ${site.name}
            </h4>
            <span class="text-[10px] text-slate-500 font-medium truncate block">
              ${site.domain || 'Jornalismo'}
            </span>
          </div>
        </div>

        <div class="pt-1.5 border-t border-slate-200/60 flex items-center justify-between text-[10px] text-slate-500 font-semibold">
          <span>${Number(site.clicks || 0).toLocaleString('pt-BR')} acessos</span>
          <span class="text-slate-700 font-bold group-hover:text-blue-600">Acessar ↗</span>
        </div>
      </div>
    `;
  }).join('');
}

function filterBySourceAndTrack(siteName, targetUrl, siteId) {
  // Preenche a busca pelo veículo e executa imediatamente
  const inputAssunto = document.getElementById('input-assunto');
  if (inputAssunto) {
    inputAssunto.value = siteName;
  }
  state.activeFilters.source = siteName;
  runDefaultSearch(false);

  // Computa clique em segundo plano
  fetch('/api/sites/click', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ siteId, siteName, targetUrl })
  }).then(() => loadSitesRanking()).catch(() => {});
}

// ========================================================
// 5. ABAS PRINCIPAIS: [ BUSCA ] | [ POLÍTICO ONLINE ]
// ========================================================
function switchTab(tab) {
  state.currentTab = tab;
  const viewBusca = document.getElementById('view-busca');
  const viewOnline = document.getElementById('view-online');
  const btnBusca = document.getElementById('tab-btn-busca');
  const btnOnline = document.getElementById('tab-btn-online');

  if (tab === 'search') {
    viewBusca?.classList.remove('hidden');
    viewOnline?.classList.add('hidden');

    if (btnBusca) {
      btnBusca.className = 'flex-1 sm:flex-initial px-4 sm:px-6 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 bg-slate-900 text-white shadow-xs';
    }
    if (btnOnline) {
      btnOnline.className = 'flex-1 sm:flex-initial px-4 sm:px-6 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 text-slate-700 hover:text-slate-950 hover:bg-slate-200';
    }
  } else if (tab === 'social') {
    viewBusca?.classList.add('hidden');
    viewOnline?.classList.remove('hidden');

    if (btnBusca) {
      btnBusca.className = 'flex-1 sm:flex-initial px-4 sm:px-6 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 text-slate-700 hover:text-slate-950 hover:bg-slate-200';
    }
    if (btnOnline) {
      btnOnline.className = 'flex-1 sm:flex-initial px-4 sm:px-6 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 bg-rose-600 text-white shadow-xs';
    }

    loadSocialStatus(true);
  }
}

// ========================================================
// 6. BUSCA DE NOTÍCIAS EM TEMPO REAL (AS-YOU-TYPE)
// ========================================================
function initRealtimeSearch() {
  const inputs = ['input-politico', 'input-assunto', 'input-data-inicio', 'input-data-fim'];
  
  inputs.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;

    el.addEventListener('input', () => {
      clearTimeout(state.debounceSearchTimeout);
      const statusEl = document.getElementById('search-realtime-status');
      if (statusEl) {
        statusEl.innerHTML = '<i class="fa-solid fa-spinner fa-spin text-blue-600"></i> Buscando em tempo real...';
        statusEl.className = 'text-[11px] font-semibold text-blue-600 flex items-center gap-1';
      }

      state.debounceSearchTimeout = setTimeout(() => {
        runDefaultSearch(true);
      }, 350);
    });
  });
}

function handleSearch(e) {
  if (e) e.preventDefault();
  runDefaultSearch(false);
}

function quickSearchPolitico(name) {
  const input = document.getElementById('input-politico');
  if (input) {
    input.value = name;
  }
  switchTab('search');
  runDefaultSearch(false);
}

function setDatePreset(type) {
  const startEl = document.getElementById('input-data-inicio');
  const endEl = document.getElementById('input-data-fim');
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];

  if (type === 'today') {
    startEl.value = todayStr;
    endEl.value = todayStr;
  } else if (type === '7d') {
    const past7 = new Date();
    past7.setDate(past7.getDate() - 7);
    startEl.value = past7.toISOString().split('T')[0];
    endEl.value = todayStr;
  } else if (type === '30d') {
    const past30 = new Date();
    past30.setDate(past30.getDate() - 30);
    startEl.value = past30.toISOString().split('T')[0];
    endEl.value = todayStr;
  } else if (type === 'all') {
    startEl.value = '';
    endEl.value = '';
  }

  runDefaultSearch(false);
}

function resetSearchFilters() {
  const p = document.getElementById('input-politico');
  const a = document.getElementById('input-assunto');
  const di = document.getElementById('input-data-inicio');
  const df = document.getElementById('input-data-fim');
  if (p) p.value = '';
  if (a) a.value = '';
  if (di) di.value = '';
  if (df) df.value = '';
  state.activeFilters.source = '';
  runDefaultSearch(false);
}

async function runDefaultSearch(isSilent = false) {
  const politico = document.getElementById('input-politico')?.value.trim() || '';
  const assunto = document.getElementById('input-assunto')?.value.trim() || '';
  const dataInicio = document.getElementById('input-data-inicio')?.value || '';
  const dataFim = document.getElementById('input-data-fim')?.value || '';
  const source = state.activeFilters.source || '';

  const params = new URLSearchParams();
  if (politico) params.append('politico', politico);
  if (assunto) params.append('assunto', assunto);
  if (dataInicio) params.append('dataInicio', dataInicio);
  if (dataFim) params.append('dataFim', dataFim);
  if (source) params.append('source', source);

  const countLabel = document.getElementById('results-count-label');
  const statusEl = document.getElementById('search-realtime-status');

  try {
    const res = await fetch(`/api/search?${params.toString()}`);
    const data = await res.json();

    if (statusEl) {
      statusEl.innerHTML = '<i class="fa-solid fa-bolt text-emerald-500"></i> Busca ao vivo ativa';
      statusEl.className = 'text-[11px] font-semibold text-emerald-600 flex items-center gap-1';
    }

    if (data.success) {
      state.articles = data.results || [];
      renderActiveTags({ politico, assunto, dataInicio, dataFim, source });
      renderNewsGrid();

      if (countLabel) {
        countLabel.textContent = `${state.articles.length} matérias encontradas em tempo real`;
      }
    }
  } catch (err) {
    console.error('Erro na busca:', err);
    if (statusEl) {
      statusEl.textContent = 'Erro ao consultar feed ao vivo';
    }
  }
}

function renderActiveTags(filters) {
  const container = document.getElementById('active-tags-container');
  if (!container) return;

  const tags = [];
  if (filters.politico) {
    tags.push(`<span class="bg-blue-100 text-blue-800 font-extrabold px-2 py-0.5 rounded text-[10px]">Político: ${filters.politico}</span>`);
  }
  if (filters.assunto) {
    tags.push(`<span class="bg-indigo-100 text-indigo-800 font-extrabold px-2 py-0.5 rounded text-[10px]">Assunto: ${filters.assunto}</span>`);
  }
  if (filters.dataInicio || filters.dataFim) {
    tags.push(`<span class="bg-emerald-100 text-emerald-800 font-extrabold px-2 py-0.5 rounded text-[10px]">Período: ${filters.dataInicio || 'Início'} até ${filters.dataFim || 'Hoje'}</span>`);
  }

  container.innerHTML = tags.join(' ');
}

function formatRelativeTime(dateString) {
  if (!dateString) return 'Hoje';
  const now = new Date();
  const date = new Date(dateString);
  const diffMinutes = Math.floor((now - date) / (1000 * 60));

  if (diffMinutes < 5) return 'Agora mesmo';
  if (diffMinutes < 60) return `Há ${diffMinutes} min`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `Há ${diffHours} h`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return 'Ontem';
  if (diffDays < 7) return `Há ${diffDays} dias`;
  return date.toLocaleDateString('pt-BR');
}

function renderNewsGrid() {
  const container = document.getElementById('news-results-grid');
  const emptyState = document.getElementById('news-empty-state');
  if (!container) return;

  if (state.articles.length === 0) {
    container.innerHTML = '';
    emptyState?.classList.remove('hidden');
    return;
  }

  emptyState?.classList.add('hidden');

  container.innerHTML = state.articles.map(art => {
    const timeFormatted = formatRelativeTime(art.publishedDate);
    const logoSvg = art.sourceLogo || getOfficialLogoForSite(art.source);
    const imageUrl = art.imageUrl || '/assets/themes/brasilia.jpg';
    const isG1 = (art.source || '').toLowerCase().includes('g1');

    return `
      <article class="bg-white rounded-2xl border border-slate-200/90 shadow-xs hover:shadow-md transition overflow-hidden flex flex-col justify-between group">
        
        <!-- Foto de Destaque 16:9 com Logo Oficial Sobreposto -->
        <div class="relative aspect-video w-full bg-slate-900 overflow-hidden">
          <img 
            src="${imageUrl}" 
            alt="${art.title}"
            class="w-full h-full object-cover group-hover:scale-105 transition duration-300"
            onerror="this.src='/assets/themes/brasilia.jpg'"
          >
          <div class="absolute inset-0 bg-gradient-to-t from-slate-950/70 via-transparent to-transparent"></div>

          <!-- Logo do Veículo com Efeito Vidro Fosco em Alto Destaque (G1, Folha, etc.) -->
          <div class="absolute top-2.5 left-2.5 ${isG1 ? 'bg-[#c4170c]' : 'bg-slate-950/85'} backdrop-blur-md px-2.5 py-1 rounded-lg border border-white/30 shadow-md flex items-center gap-1.5">
            <img src="${logoSvg}" alt="${art.source}" class="h-3.5 object-contain">
            <span class="text-white text-[10px] font-black uppercase tracking-wider">${art.source}</span>
          </div>

          <!-- Pílula de Tempo -->
          <div class="absolute top-2.5 right-2.5 bg-slate-950/75 backdrop-blur-md px-2 py-0.5 rounded-full text-white text-[10px] font-bold">
            ${timeFormatted}
          </div>
        </div>

        <!-- Conteúdo Textual da Notícia -->
        <div class="p-3.5 flex-1 flex flex-col justify-between space-y-2">
          
          <div>
            <!-- Linha da Fonte e Verificação -->
            <div class="flex items-center justify-between text-[11px] text-slate-500 mb-1">
              <span class="font-extrabold text-slate-800 flex items-center gap-1">
                <i class="fa-solid fa-circle-check text-blue-600 text-[10px]"></i> ${art.source}
              </span>
              <span class="text-slate-400 font-semibold">${art.subject || 'Política'}</span>
            </div>

            <!-- Manchete -->
            <h3 class="text-xs sm:text-sm font-black text-slate-900 group-hover:text-blue-700 transition leading-snug line-clamp-2">
              ${art.title}
            </h3>

            <!-- Resumo -->
            <p class="text-[11px] text-slate-600 mt-1 line-clamp-2 leading-relaxed">
              ${art.snippet || 'Clique para ler os desdobramentos completos da matéria jornalística.'}
            </p>
          </div>

          <!-- Tags e Botão de Leitura Direta com Rastreamento de Cliques -->
          <div class="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
            <div class="flex items-center gap-1 overflow-hidden">
              <span class="bg-slate-100 text-slate-700 text-[10px] font-bold px-1.5 py-0.5 rounded truncate">
                ${art.politician || 'Geral'}
              </span>
            </div>

            <div class="flex items-center gap-1.5 shrink-0">
              <button 
                onclick="toggleFavoritePolitician('${art.politician || 'pol'}')" 
                class="btn-fav-article text-slate-400 hover:text-rose-600 p-1" 
                title="Favoritar"
              >
                <i class="fa-regular fa-heart text-xs"></i>
              </button>

              <a 
                href="/api/sites/click?siteName=${encodeURIComponent(art.source)}&targetUrl=${encodeURIComponent(art.url)}" 
                target="_blank"
                class="inline-flex items-center gap-1 bg-slate-900 hover:bg-blue-600 text-white font-bold text-[10px] px-2.5 py-1 rounded-lg transition"
              >
                <span>Ler no ${art.source.split(' ')[0]}</span>
                <i class="fa-solid fa-arrow-up-right-from-square text-[9px]"></i>
              </a>
            </div>
          </div>

        </div>

      </article>
    `;
  }).join('');
}

function sortNewsResults() {
  const sel = document.getElementById('select-sort')?.value;
  if (sel === 'recent') {
    state.articles.sort((a, b) => new Date(b.publishedDate).getTime() - new Date(a.publishedDate).getTime());
  } else {
    // Relevância
    state.articles.sort((a, b) => (b.title.length) - (a.title.length));
  }
  renderNewsGrid();
}

// ========================================================
// 7. ABA 2: RADAR SOCIAL (POLÍTICOS ONLINE & LIVES)
// ========================================================
async function loadSocialStatus(force = false) {
  try {
    const res = await fetch('/api/politicians/social-status');
    const data = await res.json();
    if (data.success) {
      state.socialPoliticians = data.politicians || [];

      // Atualiza badges globais
      const liveStat = document.getElementById('social-live-count-stat');
      const badgeLive = document.getElementById('badge-live-total-pill');
      if (liveStat) liveStat.textContent = data.totalLive || '0';
      if (badgeLive) badgeLive.textContent = `${data.totalLive || 0} AO VIVO`;

      renderSocialGrid();
    }
  } catch (err) {
    console.error('Erro ao buscar status social:', err);
  }
}

function filterSocialList(filter) {
  state.currentSocialFilter = filter;
  ['all', 'live', 'online'].forEach(f => {
    const btn = document.getElementById(`social-filter-${f}`);
    if (btn) {
      if (f === filter) {
        btn.className = 'social-tab-btn active px-2.5 py-1 rounded-lg bg-slate-900 text-white';
      } else {
        btn.className = 'social-tab-btn px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200';
      }
    }
  });
  renderSocialGrid();
}

function renderSocialGrid() {
  const container = document.getElementById('social-status-detailed-grid');
  if (!container) return;

  let list = [...state.socialPoliticians];
  if (state.currentSocialFilter === 'live') {
    list = list.filter(p => p.socialStatus?.isLive);
  } else if (state.currentSocialFilter === 'online') {
    list = list.filter(p => !p.socialStatus?.isLive);
  }

  container.innerHTML = list.map(pol => {
    const isLive = pol.socialStatus?.isLive;
    const platform = pol.socialStatus?.livePlatform || 'YouTube';
    const platformIcon = platform.toLowerCase().includes('insta') ? 'fa-brands fa-instagram text-rose-500' :
                         platform.toLowerCase().includes('tik') ? 'fa-brands fa-tiktok text-slate-900' :
                         platform.toLowerCase().includes('x') ? 'fa-brands fa-x-twitter text-slate-900' :
                         'fa-brands fa-youtube text-red-600';

    return `
      <div class="bg-white rounded-2xl border ${isLive ? 'border-rose-400 ring-2 ring-rose-100' : 'border-slate-200/90'} p-3.5 shadow-xs space-y-3 flex flex-col justify-between">
        
        <div class="space-y-2">
          <div class="flex items-center justify-between gap-2">
            <div class="flex items-center gap-2">
              <img 
                src="${pol.avatar || '/assets/politicians/lula.jpg'}" 
                alt="${pol.name}"
                class="w-12 h-12 rounded-full object-cover border-2 ${isLive ? 'border-rose-600' : 'border-slate-200'}"
                onerror="this.src='/assets/themes/brasilia.jpg'"
              >
              <div>
                <h4 class="text-xs font-black text-slate-900">${pol.popularName}</h4>
                <span class="text-[10px] text-slate-500 font-bold block">${pol.party} • ${pol.office}</span>
              </div>
            </div>

            <div>
              ${isLive ? `
                <span class="inline-flex items-center gap-1 bg-rose-600 text-white font-black text-[9px] px-2 py-0.5 rounded-full animate-pulse shadow-sm">
                  <span class="w-1.5 h-1.5 rounded-full bg-white"></span> AO VIVO
                </span>
              ` : `
                <span class="inline-flex items-center gap-1 bg-emerald-100 text-emerald-800 font-extrabold text-[9px] px-2 py-0.5 rounded-full">
                  <span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> ONLINE
                </span>
              `}
            </div>
          </div>

          <!-- Detalhe da Live ou Post Recente -->
          ${isLive ? `
            <div class="bg-rose-50 border border-rose-200/80 rounded-xl p-2.5 text-xs space-y-1">
              <div class="flex items-center justify-between">
                <span class="font-extrabold text-rose-900 flex items-center gap-1 text-[11px]">
                  <i class="${platformIcon}"></i> Transmitindo no ${platform}
                </span>
                <span class="text-[10px] text-rose-700 font-bold">Ao Vivo</span>
              </div>
              <p class="text-[11px] text-slate-800 font-bold leading-tight">
                "${pol.socialStatus?.liveTitle || 'Pronunciamento oficial e agenda em tempo real.'}"
              </p>
              <a 
                href="${pol.socialStatus?.liveUrl || 'https://youtube.com'}" 
                target="_blank"
                class="mt-1 block text-center py-1 bg-rose-600 hover:bg-rose-700 text-white font-black text-[10px] rounded-lg transition"
              >
                Assistir Transmissão Ao Vivo ↗
              </a>
            </div>
          ` : `
            <div class="bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs">
              <span class="text-[10px] font-bold text-slate-500 block">Atividade Recente:</span>
              <p class="text-[11px] text-slate-700 mt-0.5 leading-snug">
                ${pol.socialStatus?.recentPost || 'Agenda pública e comunicados parlamentares.'}
              </p>
            </div>
          `}
        </div>

        <!-- Botão de Teste / Simulação de Live em Tempo Real -->
        <div class="pt-2 border-t border-slate-100 flex items-center justify-between">
          <span class="text-[10px] text-slate-400 font-medium">Seguidores: ${pol.socialStatus?.followersTotal || '1M+'}</span>
          <button 
            onclick="toggleLiveSimulation('${pol.id}', ${!isLive})" 
            class="text-[10px] font-bold px-2 py-0.5 rounded ${isLive ? 'bg-slate-200 text-slate-700 hover:bg-slate-300' : 'bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100'} transition"
          >
            ${isLive ? 'Finalizar Live' : 'Iniciar Live (Teste)'}
          </button>
        </div>

      </div>
    `;
  }).join('');
}

async function toggleLiveSimulation(polId, newLiveStatus) {
  try {
    const res = await fetch(`/api/politicians/${polId}/social-status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        isLive: newLiveStatus,
        livePlatform: 'YouTube',
        liveTitle: newLiveStatus ? 'Transmissão Coletiva: Entrevista Exclusiva ao Vivo' : ''
      })
    });
    const data = await res.json();
    if (data.success) {
      showToast(`Status de ${data.politician.popularName} atualizado em tempo real!`, 'success');
      loadSocialStatus(true);
      loadPoliticiansRanking();
    }
  } catch (err) {
    showToast('Erro ao atualizar status de transmissão.', 'error');
  }
}

// ========================================================
// 8. FAVORITOS & MODAIS
// ========================================================
async function toggleFavoritePolitician(polNameOrId) {
  if (!state.currentUser) {
    openAuthModal('login');
    showToast('Faça login para salvar seus favoritos.', 'info');
    return;
  }

  try {
    const res = await fetch('/api/users/favorites/politician', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: state.currentUser.id,
        politicianId: polNameOrId
      })
    });
    const data = await res.json();
    if (data.success) {
      if (data.isFavorited) {
        state.favoritePoliticianIds.add(polNameOrId);
        showToast('Adicionado aos favoritos!', 'success');
      } else {
        state.favoritePoliticianIds.delete(polNameOrId);
        showToast('Removido dos favoritos.', 'info');
      }
      updateFavBadge();
      updateFavoriteButtonsUI();
    }
  } catch (err) {
    showToast('Erro ao atualizar favorito.', 'error');
  }
}

function openFavoritesModal() {
  document.getElementById('modal-favorites')?.classList.remove('hidden');
  renderFavoritesList();
}

function switchFavTab(tab) {
  state.currentFavTab = tab;
  const btnPol = document.getElementById('fav-tab-pol');
  const btnBlog = document.getElementById('fav-tab-blog');
  if (tab === 'politicians') {
    if (btnPol) btnPol.className = 'px-3 py-1 rounded-lg bg-slate-900 text-white';
    if (btnBlog) btnBlog.className = 'px-3 py-1 rounded-lg bg-slate-100 text-slate-700';
  } else {
    if (btnPol) btnPol.className = 'px-3 py-1 rounded-lg bg-slate-100 text-slate-700';
    if (btnBlog) btnBlog.className = 'px-3 py-1 rounded-lg bg-slate-900 text-white';
  }
  renderFavoritesList();
}

function renderFavoritesList() {
  const container = document.getElementById('favorites-list-container');
  if (!container) return;

  if (state.currentFavTab === 'politicians') {
    const favs = Array.from(state.favoritePoliticianIds);
    if (favs.length === 0) {
      container.innerHTML = '<p class="text-slate-500 text-center py-4">Nenhum político favoritado ainda.</p>';
      return;
    }
    container.innerHTML = favs.map(id => `
      <div class="p-2.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
        <span class="font-bold text-slate-900">${id}</span>
        <button onclick="toggleFavoritePolitician('${id}')" class="text-rose-600 font-bold hover:underline">Remover</button>
      </div>
    `).join('');
  } else {
    container.innerHTML = '<p class="text-slate-500 text-center py-4">Nenhum blog favoritado ainda.</p>';
  }
}

function openAdvertiserModal(plan = 'Sidebar Anunciantes') {
  document.getElementById('modal-advertiser')?.classList.remove('hidden');
  const inputPlan = document.getElementById('ad-target-plan');
  if (inputPlan) inputPlan.value = plan;
}

async function handleAdvertiserSubmit(e) {
  e.preventDefault();
  const name = document.getElementById('ad-input-name').value.trim();
  const email = document.getElementById('ad-input-email').value.trim();
  const company = document.getElementById('ad-input-company').value.trim();
  const plan = document.getElementById('ad-target-plan').value;
  const notes = document.getElementById('ad-input-notes').value.trim();

  try {
    const res = await fetch('/api/monetization/advertiser-request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, company, plan, notes })
    });
    const data = await res.json();
    if (data.success) {
      closeModal('modal-advertiser');
      showToast('Solicitação recebida com sucesso! Enviamos a proposta por e-mail.', 'success');
      document.getElementById('form-advertiser')?.reset();
    }
  } catch (err) {
    showToast('Erro ao enviar solicitação comercial.', 'error');
  }
}

function openBlogRegisterModal() {
  document.getElementById('modal-blog-register')?.classList.remove('hidden');
}

async function handleBlogRegisterSubmit(e) {
  e.preventDefault();
  const name = document.getElementById('blog-input-name').value.trim();
  const url = document.getElementById('blog-input-url').value.trim();
  const author = document.getElementById('blog-input-author').value.trim();

  try {
    const res = await fetch('/api/blogs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, url, author })
    });
    const data = await res.json();
    if (data.success) {
      closeModal('modal-blog-register');
      showToast('Blog cadastrado com sucesso no Radar Político!', 'success');
      document.getElementById('form-blog-register')?.reset();
    }
  } catch (err) {
    showToast('Erro ao cadastrar blog.', 'error');
  }
}

function openAllPoliticiansModal() {
  quickSearchPolitico('');
  showToast('Mostrando todos os políticos e matérias relacionadas.', 'info');
}

function openAllSitesModal() {
  showToast('Todos os portais são monitorados na busca em tempo real.', 'info');
}

function closeModal(id) {
  document.getElementById(id)?.classList.add('hidden');
}

// Toast Notification
function showToast(msg, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  const bg = type === 'success' ? 'bg-emerald-600 text-white' :
             type === 'error' ? 'bg-rose-600 text-white' :
             'bg-slate-900 text-white';

  toast.className = `toast-msg px-4 py-2.5 rounded-xl shadow-lg font-bold text-xs pointer-events-auto flex items-center gap-2 ${bg}`;
  toast.innerHTML = `<span>${msg}</span>`;

  container.appendChild(toast);
  setTimeout(() => {
    toast.remove();
  }, 3500);
}
