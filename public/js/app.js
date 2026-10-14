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
  onlinePoliticians: [],
  verifiedStreams: [],
  sponsoredBlogs: [],
  themeSettings: {
    tabBuscaBg: '#0f172a',
    tabBuscaText: '#ffffff',
    tabOnlineBg: '#e11d48',
    tabOnlineText: '#ffffff'
  },
  onboardingSelectedParty: null,
  onboardingSelectedPoliticians: new Set(),
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
  loadThemeSettings();
  initAuth();
  initRealtimeSearch();
  loadDonations();
  loadPoliticiansRanking();
  loadSitesRanking();
  loadSponsoredBlogs();
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
    if (name) name.textContent = (state.currentUser.name || 'Usuário').split(' ')[0];
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
      
      // "Assim que a pessoa se cadastrar solicitar que seja informado um partido favorito e 5 políticos"
      setTimeout(() => {
        openOnboardingModal(data.user);
      }, 400);
    } else {
      showToast(data.error || 'Erro ao cadastrar.', 'error');
    }
  } catch (err) {
    showToast('Falha no cadastro.', 'error');
  }
}

// ========================================================
// 1.1 ONBOARDING PÓS-CADASTRO (PARTIDO E 5 POLÍTICOS)
// ========================================================
const BRAZILIAN_PARTIES = ['PL', 'PT', 'Republicanos', 'PSD', 'MDB', 'União Brasil', 'PP', 'PSOL', 'Novo', 'PSB', 'PDT', 'Podemos', 'Solidariedade', 'Avante', 'Rede'];

function openOnboardingModal(user = null) {
  if (user) state.currentUser = user;
  state.onboardingSelectedParty = state.currentUser?.favoriteParty || null;
  state.onboardingSelectedPoliticians = new Set(state.currentUser?.favoritePoliticians || []);

  renderOnboardingParties();
  renderOnboardingPoliticians();
  updateOnboardingCounter();

  document.getElementById('modal-onboarding')?.classList.remove('hidden');
}

function renderOnboardingParties() {
  const container = document.getElementById('onboarding-parties-list');
  if (!container) return;

  container.innerHTML = BRAZILIAN_PARTIES.map(party => {
    const isSelected = state.onboardingSelectedParty === party;
    const activeClass = isSelected 
      ? 'bg-blue-600 text-white border-blue-600 shadow-xs' 
      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-blue-50 hover:border-blue-300';
    return `
      <button 
        type="button" 
        onclick="selectOnboardingParty('${party}')"
        class="px-3 py-1.5 rounded-xl border text-xs font-bold transition flex items-center gap-1.5 ${activeClass}"
      >
        <span>${party}</span>
        ${isSelected ? '<i class="fa-solid fa-check text-[10px]"></i>' : ''}
      </button>
    `;
  }).join('');
}

function selectOnboardingParty(party) {
  state.onboardingSelectedParty = party;
  renderOnboardingParties();
}

function renderOnboardingPoliticians() {
  const container = document.getElementById('onboarding-politicians-grid');
  if (!container) return;

  const list = state.politicians.length > 0 ? state.politicians : [];

  container.innerHTML = list.map(pol => {
    const isSelected = state.onboardingSelectedPoliticians.has(pol.id);
    const borderClass = isSelected 
      ? 'border-blue-600 bg-blue-50/80 ring-2 ring-blue-300' 
      : 'border-slate-200 bg-slate-50 hover:bg-slate-100';

    return `
      <div 
        onclick="toggleOnboardingPolitician('${pol.id}')"
        class="p-2 rounded-xl border cursor-pointer transition flex items-center gap-2 select-none ${borderClass}"
      >
        <img 
          src="${pol.avatar || '/assets/themes/brasilia.jpg'}" 
          alt="${pol.popularName}" 
          class="w-8 h-8 rounded-full object-cover shrink-0 border border-white shadow-2xs"
          onerror="this.src='/assets/themes/brasilia.jpg'"
        >
        <div class="truncate flex-1">
          <h5 class="text-xs font-black text-slate-900 leading-tight truncate">${pol.popularName}</h5>
          <span class="text-[10px] text-slate-500 font-bold block truncate">${pol.party}</span>
        </div>
        ${isSelected ? '<i class="fa-solid fa-circle-check text-blue-600 text-xs shrink-0"></i>' : '<i class="fa-regular fa-circle text-slate-300 text-xs shrink-0"></i>'}
      </div>
    `;
  }).join('');
}

function toggleOnboardingPolitician(polId) {
  if (state.onboardingSelectedPoliticians.has(polId)) {
    state.onboardingSelectedPoliticians.delete(polId);
  } else {
    if (state.onboardingSelectedPoliticians.size >= 5) {
      showToast('Você já selecionou 5 políticos! Desmarque um para selecionar outro.', 'info');
      return;
    }
    state.onboardingSelectedPoliticians.add(polId);
  }
  renderOnboardingPoliticians();
  updateOnboardingCounter();
}

function updateOnboardingCounter() {
  const badge = document.getElementById('onboarding-counter-badge');
  const count = state.onboardingSelectedPoliticians.size;
  if (badge) {
    badge.textContent = `${count} de 5 selecionados`;
    if (count === 5) {
      badge.className = 'text-xs font-black px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300';
    } else {
      badge.className = 'text-xs font-black px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700';
    }
  }
}

async function submitOnboardingPreferences() {
  if (!state.currentUser) {
    closeModal('modal-onboarding');
    return;
  }

  if (!state.onboardingSelectedParty) {
    showToast('Por favor, selecione seu partido favorito.', 'error');
    return;
  }

  if (state.onboardingSelectedPoliticians.size < 5) {
    showToast(`Por favor, selecione 5 políticos (faltam ${5 - state.onboardingSelectedPoliticians.size}).`, 'info');
    return;
  }

  const payload = {
    userId: state.currentUser.id,
    favoriteParty: state.onboardingSelectedParty,
    favoritePoliticianIds: Array.from(state.onboardingSelectedPoliticians)
  };

  try {
    const res = await fetch('/api/users/preferences', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (data.success) {
      state.currentUser = data.user;
      localStorage.setItem('rp_user', JSON.stringify(data.user));
      payload.favoritePoliticianIds.forEach(id => state.favoritePoliticianIds.add(id));
      updateFavBadge();
      updateFavoriteButtonsUI();
      closeModal('modal-onboarding');
      showToast('Preferências salvas com sucesso! Seu feed foi personalizado.', 'success');
      runDefaultSearch(false);
    } else {
      showToast(data.error || 'Erro ao salvar preferências.', 'error');
    }
  } catch (err) {
    showToast('Falha na comunicação com o servidor.', 'error');
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
// ========================================================
// 3. LINHA 2: TOP 5 POLÍTICOS MAIS BUSCADOS (EXPOSTOS NA HOME)
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

function toggleTop5Disclaimer() {
  const panel = document.getElementById('top5-disclaimer-panel');
  const chevron = document.getElementById('top5-disclaimer-chevron');
  if (!panel) return;
  const isHidden = panel.classList.contains('hidden');
  if (isHidden) {
    panel.classList.remove('hidden');
    if (chevron) chevron.style.transform = 'rotate(180deg)';
  } else {
    panel.classList.add('hidden');
    if (chevron) chevron.style.transform = 'rotate(0deg)';
  }
}

// ========================================================
// 3.5 BLOGS E FONTES PATROCINADAS (EXPOSTOS NA HOME)
// SOMENTE O NOME E A LOGO COM O LINK SOBRE A LOGO
// ========================================================
async function loadSponsoredBlogs() {
  try {
    const res = await fetch('/api/blogs?sponsoredOnly=true');
    const data = await res.json();
    if (data.success) {
      state.sponsoredBlogs = data.blogs || [];
      renderSponsoredBlogs();
    }
  } catch (err) {
    console.error('Erro ao carregar blogs patrocinados:', err);
  }
}

function renderSponsoredBlogs() {
  const container = document.getElementById('sponsored-blogs-grid');
  if (!container) return;

  const blogs = state.sponsoredBlogs || [];
  if (blogs.length === 0) {
    container.innerHTML = '<p class="text-xs text-slate-500 col-span-full py-2">Carregando parceiros oficiais...</p>';
    return;
  }

  // "Colocar a lista dos blogs patrocinados / Colocar somente o nome e a logo dos blogs onde o hiperlink do blog fique sobre a logo."
  container.innerHTML = blogs.map(blog => {
    const logoSvg = blog.logoSvg || getOfficialLogoForSite(blog.name);
    return `
      <div class="flex flex-col items-center justify-center text-center p-2.5 bg-slate-50 hover:bg-amber-50/50 border border-slate-200 hover:border-amber-300 rounded-xl transition group shadow-2xs">
        <a 
          href="${blog.url}" 
          target="_blank" 
          onclick="trackSiteClickOnly('${blog.id || blog.domain}')"
          class="w-12 h-12 rounded-xl bg-slate-950 p-2 flex items-center justify-center shadow-xs border border-slate-700 group-hover:scale-105 group-hover:border-amber-400 transition"
          title="Acessar ${blog.name} (abre em nova guia)"
        >
          <img src="${logoSvg}" alt="${blog.name}" class="max-w-full max-h-full object-contain">
        </a>
        <span class="text-[11px] font-bold text-slate-800 mt-2 truncate w-full" title="${blog.name}">
          ${blog.name}
        </span>
      </div>
    `;
  }).join('');
}

function renderTop5Politicians() {
  const container = document.getElementById('top5-politicians-container');
  const compactContainer = document.getElementById('top5-compact-pills');
  if (!container) return;

  const top5 = state.politicians.slice(0, 5);

  // 1. Renderiza mini-pills para a barra compacta retrátil
  if (compactContainer) {
    compactContainer.innerHTML = top5.map((pol, idx) => `
      <span 
        onclick="event.stopPropagation(); quickSearchPolitico('${pol.popularName || pol.name}')"
        class="inline-flex items-center gap-1.5 bg-white hover:bg-amber-100/80 border border-slate-200 hover:border-amber-400 rounded-full py-0.5 px-2 text-[10px] font-bold text-slate-800 transition cursor-pointer shrink-0 shadow-2xs"
        title="Clique para filtrar notícias de ${pol.popularName}"
      >
        <span class="text-amber-600 font-black">#${idx + 1}</span>
        <img src="${pol.avatar || '/assets/themes/brasilia.jpg'}" alt="${pol.popularName}" class="w-3.5 h-3.5 rounded-full object-cover">
        <span>${pol.popularName}</span>
      </span>
    `).join('');
  }

  // 2. Renderiza os cards completos na área expandida (com fotos reais oficiais e sem fake live)
  container.innerHTML = top5.map((pol, index) => {
    const rankNum = index + 1;
    const rankBadgeClass = rankNum === 1 ? 'bg-amber-500 text-slate-950 font-black shadow-2xs' :
                           rankNum === 2 ? 'bg-slate-300 text-slate-900 font-bold' :
                           rankNum === 3 ? 'bg-amber-700 text-white font-bold' :
                           'bg-slate-100 text-slate-700 font-bold';

    return `
      <div 
        onclick="quickSearchPolitico('${pol.popularName || pol.name}')"
        class="bg-slate-50 hover:bg-blue-50/70 border border-slate-200 hover:border-blue-300 rounded-xl p-2.5 transition cursor-pointer group flex flex-col justify-between shadow-2xs"
        title="Clique para pesquisar matérias de ${pol.popularName}"
      >
        <div class="flex items-start justify-between gap-1.5 mb-2">
          <span class="w-5 h-5 rounded-md text-[11px] flex items-center justify-center ${rankBadgeClass}">
            #${rankNum}
          </span>
          <span class="text-[9px] bg-slate-200/90 text-slate-700 font-extrabold px-1.5 py-0.2 rounded">
            ${pol.trend || '+15%'}
          </span>
        </div>

        <div class="flex items-center gap-2 mb-1.5">
          <img 
            src="${pol.avatar || '/assets/themes/brasilia.jpg'}" 
            alt="${pol.name}"
            class="w-10 h-10 rounded-full object-cover border-2 border-white shadow-xs"
            onerror="this.src='/assets/themes/brasilia.jpg'"
          >
          <div class="truncate">
            <h4 class="text-xs font-black text-slate-900 group-hover:text-blue-700 transition leading-tight truncate">
              ${pol.popularName || pol.name || 'Líder Político'}
            </h4>
            <span class="text-[10px] text-slate-500 font-bold block truncate">
              ${pol.party || 'POL'} • ${(pol.office || 'Líder').split(' ')[0]}
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
// 4. LINHA 3: TOP 5 SITES DE NOTÍCIAS MAIS ACESSADOS (FILETINHO DE AÇÕES)
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
  if (norm.includes('gazeta')) return '/assets/logos/gazetadopovo.svg';
  if (norm.includes('jovem')) return '/assets/logos/jovempan.svg';
  if (norm.includes('carta')) return '/assets/logos/cartacapital.svg';
  if (norm.includes('conjur')) return '/assets/logos/conjur.svg';
  if (norm.includes('brasil 247') || norm.includes('brasil247')) return '/assets/logos/brasil247.svg';
  return '/assets/logos/g1.svg';
}

function renderTop5Sites() {
  const ticker = document.getElementById('top5-sites-ticker');
  if (!ticker) return;

  const top5 = state.sites.slice(0, 5);

  // "somente o nome e ter apenas o link, não ter os números de acesso, tipo um filetinho mostrando as ações."
  ticker.innerHTML = top5.map((site) => {
    const logoSvg = getOfficialLogoForSite(site.name);

    return `
      <a 
        href="${site.url}" 
        target="_blank"
        onclick="trackSiteClickOnly('${site.id}')"
        class="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-50 hover:bg-blue-50 border border-slate-200 hover:border-blue-300 rounded-lg text-xs font-bold text-slate-800 hover:text-blue-700 transition shrink-0 group shadow-2xs"
        title="Acessar ${site.name} diretamente"
      >
        <span class="w-4 h-4 rounded bg-white border border-slate-200 p-0.5 flex items-center justify-center shrink-0">
          <img src="${logoSvg}" alt="${site.name}" class="max-w-full max-h-full object-contain">
        </span>
        <span class="whitespace-nowrap">${site.name}</span>
        <i class="fa-solid fa-arrow-up-right-from-square text-[9px] text-slate-400 group-hover:text-blue-600 transition"></i>
      </a>
    `;
  }).join(' <span class="text-slate-300 select-none">•</span> ');
}

function trackSiteClickOnly(siteId) {
  fetch('/api/sites/click', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ siteId })
  }).catch(() => {});
}

// ========================================================
// 5. ABAS PRINCIPAIS & PERSONALIZAÇÃO DE CORES (ADMINISTRADOR)
// ========================================================
async function loadThemeSettings() {
  try {
    const saved = localStorage.getItem('rp_tab_theme');
    if (saved) {
      state.themeSettings = JSON.parse(saved);
      applyTheme(state.themeSettings);
    }
    const res = await fetch('/api/admin/theme');
    const data = await res.json();
    if (data.success && data.theme) {
      state.themeSettings = data.theme;
      localStorage.setItem('rp_tab_theme', JSON.stringify(data.theme));
      applyTheme(state.themeSettings);
    }
  } catch (err) {
    console.warn('Usando tema padrão local:', err);
    applyTheme(state.themeSettings);
  }
}

function applyTheme(theme) {
  if (!theme) return;
  state.themeSettings = theme;

  document.documentElement.style.setProperty('--tab-busca-bg', theme.tabBuscaBg || '#0f172a');
  document.documentElement.style.setProperty('--tab-busca-text', theme.tabBuscaText || '#ffffff');
  document.documentElement.style.setProperty('--tab-online-bg', theme.tabOnlineBg || '#e11d48');
  document.documentElement.style.setProperty('--tab-online-text', theme.tabOnlineText || '#ffffff');

  updateTabStyles();
}

function updateTabStyles() {
  const btnBusca = document.getElementById('tab-btn-busca');
  const btnOnline = document.getElementById('tab-btn-online');
  const theme = state.themeSettings || {
    tabBuscaBg: '#0f172a',
    tabBuscaText: '#ffffff',
    tabOnlineBg: '#e11d48',
    tabOnlineText: '#ffffff'
  };

  if (!btnBusca || !btnOnline) return;

  if (state.currentTab === 'search') {
    btnBusca.style.backgroundColor = theme.tabBuscaBg;
    btnBusca.style.color = theme.tabBuscaText;
    btnBusca.className = 'flex-1 sm:flex-initial px-4 sm:px-6 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-xs';

    btnOnline.style.backgroundColor = 'transparent';
    btnOnline.style.color = '#334155';
    btnOnline.className = 'flex-1 sm:flex-initial px-4 sm:px-6 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 hover:bg-slate-200';
  } else {
    btnOnline.style.backgroundColor = theme.tabOnlineBg;
    btnOnline.style.color = theme.tabOnlineText;
    btnOnline.className = 'flex-1 sm:flex-initial px-4 sm:px-6 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-xs';

    btnBusca.style.backgroundColor = 'transparent';
    btnBusca.style.color = '#334155';
    btnBusca.className = 'flex-1 sm:flex-initial px-4 sm:px-6 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 hover:bg-slate-200';
  }
}

function switchTab(tab) {
  state.currentTab = tab;
  const viewBusca = document.getElementById('view-busca');
  const viewOnline = document.getElementById('view-online');

  if (tab === 'search') {
    viewBusca?.classList.remove('hidden');
    viewOnline?.classList.add('hidden');
  } else if (tab === 'social') {
    viewBusca?.classList.add('hidden');
    viewOnline?.classList.remove('hidden');
    loadSocialStatus(true);
  }

  updateTabStyles();
}

function openTabColorCustomizer() {
  const theme = state.themeSettings || {
    tabBuscaBg: '#0f172a',
    tabBuscaText: '#ffffff',
    tabOnlineBg: '#e11d48',
    tabOnlineText: '#ffffff'
  };

  const bBg = document.getElementById('input-color-busca-bg');
  const bBgHex = document.getElementById('input-color-busca-bg-hex');
  const bTxt = document.getElementById('input-color-busca-text');
  const bTxtHex = document.getElementById('input-color-busca-text-hex');
  const oBg = document.getElementById('input-color-online-bg');
  const oBgHex = document.getElementById('input-color-online-bg-hex');
  const oTxt = document.getElementById('input-color-online-text');
  const oTxtHex = document.getElementById('input-color-online-text-hex');

  if (bBg) bBg.value = theme.tabBuscaBg;
  if (bBgHex) bBgHex.value = theme.tabBuscaBg;
  if (bTxt) bTxt.value = theme.tabBuscaText;
  if (bTxtHex) bTxtHex.value = theme.tabBuscaText;
  if (oBg) oBg.value = theme.tabOnlineBg;
  if (oBgHex) oBgHex.value = theme.tabOnlineBg;
  if (oTxt) oTxt.value = theme.tabOnlineText;
  if (oTxtHex) oTxtHex.value = theme.tabOnlineText;

  updateTabColorPreview();
  document.getElementById('modal-tab-colors')?.classList.remove('hidden');
}

function updateTabColorPreview() {
  const buscaBg = document.getElementById('input-color-busca-bg')?.value || '#0f172a';
  const buscaText = document.getElementById('input-color-busca-text')?.value || '#ffffff';
  const onlineBg = document.getElementById('input-color-online-bg')?.value || '#e11d48';
  const onlineText = document.getElementById('input-color-online-text')?.value || '#ffffff';

  const bHex = document.getElementById('input-color-busca-bg-hex');
  const btHex = document.getElementById('input-color-busca-text-hex');
  const oHex = document.getElementById('input-color-online-bg-hex');
  const otHex = document.getElementById('input-color-online-text-hex');

  if (bHex) bHex.value = buscaBg;
  if (btHex) btHex.value = buscaText;
  if (oHex) oHex.value = onlineBg;
  if (otHex) otHex.value = onlineText;

  const prevBusca = document.getElementById('preview-tab-busca');
  const prevOnline = document.getElementById('preview-tab-online');

  if (prevBusca) {
    prevBusca.style.backgroundColor = buscaBg;
    prevBusca.style.color = buscaText;
  }
  if (prevOnline) {
    prevOnline.style.backgroundColor = onlineBg;
    prevOnline.style.color = onlineText;
  }
}

function syncHexToPicker(field) {
  const hexInput = document.getElementById(`input-color-${field}-hex`);
  const picker = document.getElementById(`input-color-${field}`);
  if (!hexInput || !picker) return;

  const val = hexInput.value.trim();
  if (/^#[0-9A-Fa-f]{6}$/.test(val)) {
    picker.value = val;
    updateTabColorPreview();
  }
}

function applyPresetTheme(buscaBg, buscaText, onlineBg, onlineText) {
  const bBg = document.getElementById('input-color-busca-bg');
  const bTxt = document.getElementById('input-color-busca-text');
  const oBg = document.getElementById('input-color-online-bg');
  const oTxt = document.getElementById('input-color-online-text');

  if (bBg) bBg.value = buscaBg;
  if (bTxt) bTxt.value = buscaText;
  if (oBg) oBg.value = onlineBg;
  if (oTxt) oTxt.value = onlineText;

  updateTabColorPreview();
}

async function saveAdminTabColors() {
  const buscaBg = document.getElementById('input-color-busca-bg')?.value || '#0f172a';
  const buscaText = document.getElementById('input-color-busca-text')?.value || '#ffffff';
  const onlineBg = document.getElementById('input-color-online-bg')?.value || '#e11d48';
  const onlineText = document.getElementById('input-color-online-text')?.value || '#ffffff';

  const theme = {
    tabBuscaBg: buscaBg,
    tabBuscaText: buscaText,
    tabOnlineBg: onlineBg,
    tabOnlineText: onlineText
  };

  try {
    const res = await fetch('/api/admin/theme', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(theme)
    });
    const data = await res.json();
    if (data.success) {
      applyTheme(data.theme || theme);
      localStorage.setItem('rp_tab_theme', JSON.stringify(data.theme || theme));
      closeModal('modal-tab-colors');
      showToast('Cores das abas salvas com sucesso pelo administrador!', 'success');
    } else {
      showToast('Erro ao salvar tema no servidor.', 'error');
    }
  } catch (err) {
    applyTheme(theme);
    localStorage.setItem('rp_tab_theme', JSON.stringify(theme));
    closeModal('modal-tab-colors');
    showToast('Cores das abas salvas localmente!', 'info');
  }
}

function restoreDefaultTabColors() {
  const defaultTheme = {
    tabBuscaBg: '#0f172a',
    tabBuscaText: '#ffffff',
    tabOnlineBg: '#e11d48',
    tabOnlineText: '#ffffff'
  };
  applyPresetTheme(defaultTheme.tabBuscaBg, defaultTheme.tabBuscaText, defaultTheme.tabOnlineBg, defaultTheme.tabOnlineText);
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
    const isMetropoles = (art.source || '').toLowerCase().includes('metropoles');
    const isPoder360 = (art.source || '').toLowerCase().includes('poder360');
    const isFolha = (art.source || '').toLowerCase().includes('folha');

    const badgeBg = isG1 ? 'bg-[#c4170c] ring-2 ring-white/50 text-white' :
                    isMetropoles ? 'bg-[#0f172a] ring-2 ring-amber-400 text-amber-300' :
                    isPoder360 ? 'bg-blue-900 ring-2 ring-blue-300 text-white' :
                    isFolha ? 'bg-slate-950 ring-2 ring-slate-300 text-white' :
                    'bg-slate-950/90 text-white';

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

          <!-- Logo do Veículo em Alto Destaque (G1, Folha, Metrópoles, etc.) -->
          <div class="absolute top-2.5 left-2.5 ${badgeBg} backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/40 shadow-lg flex items-center gap-2">
            <img src="${logoSvg}" alt="${art.source}" class="h-4 sm:h-5 max-w-[75px] object-contain">
            <span class="text-xs font-black uppercase tracking-wider">${art.source}</span>
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
                href="/api/sites/click?siteName=${encodeURIComponent(art.source || 'Portal')}&targetUrl=${encodeURIComponent(art.url || '#')}" 
                target="_blank"
                class="inline-flex items-center gap-1 bg-slate-900 hover:bg-blue-600 text-white font-bold text-[10px] px-2.5 py-1 rounded-lg transition"
              >
                <span>Ler no ${(art.source || 'Portal').split(' ')[0]}</span>
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
// 7. ABA 2: RADAR SOCIAL & POLÍTICOS ONLINE
// ========================================================
async function loadSocialStatus(force = false) {
  try {
    const res = await fetch('/api/politicians/social-status');
    const data = await res.json();
    if (data.success) {
      state.verifiedStreams = data.verifiedStreams || [];
      state.socialPoliticians = data.livePoliticians || (data.politicians || []).filter(p => p.socialStatus?.isLive);
      state.onlinePoliticians = data.onlinePoliticians || data.politicians || [];

      const totalLive = (state.verifiedStreams.length || 0) + (state.socialPoliticians.length || 0);

      // Atualiza badges globais com a contagem verdadeira de líderes online
      const onlineBadge = document.getElementById('politicians-online-count-badge');
      const badgeLive = document.getElementById('badge-live-total-pill');
      if (onlineBadge) onlineBadge.textContent = state.onlinePoliticians.length;
      if (badgeLive) badgeLive.textContent = `${state.socialPoliticians.length || 0} AO VIVO`;

      renderOnlinePoliticiansGrid();
    }
  } catch (err) {
    console.error('Erro ao buscar status social:', err);
  }
}


function renderOnlinePoliticiansGrid() {
  const container = document.getElementById('politicians-online-grid');
  const countLabel = document.getElementById('politicians-online-count');
  if (!container) return;

  const rawList = state.onlinePoliticians || [];
  // Exibir ESTRITAMENTE líderes com presença online verificada
  const list = rawList.filter(pol => {
    const hasOnlineNet = Array.isArray(pol.socialStatus?.onlineNetworks) && pol.socialStatus.onlineNetworks.length > 0;
    return (pol.socialStatus?.status === 'online' || pol.socialStatus?.isLive) && hasOnlineNet;
  });

  if (countLabel) {
    countLabel.textContent = `${list.length} Líderes Online Agora`;
  }

  if (list.length === 0) {
    container.innerHTML = '<p class="text-xs text-slate-500 col-span-full py-6 text-center font-bold">Nenhum político online no momento.</p>';
    return;
  }

  // Demonstrativo do Político Online:
  // - Foto do político como fundo do card
  // - Pequeno quadrado no canto superior esquerdo em vermelho "Ao Vivo"
  // - Três quadrados com as logos na base da imagem representando as 3 redes (Instagram, YouTube, TikTok)
  // - Logo da rede online ILUMINADA e rede offline APAGADA
  container.innerHTML = list.map(pol => {
    const isLive = Boolean(pol.socialStatus?.isLive);
    const profiles = pol.socialStatus?.profiles || {};
    const onlineNetworks = Array.isArray(pol.socialStatus?.onlineNetworks) ? pol.socialStatus.onlineNetworks : [];
    const isFav = state.favoritePoliticianIds.has(pol.id);

    const popularName = pol.popularName || pol.name || 'Líder Político';
    const party = pol.party || 'POL';
    const office = pol.office || 'Líder Político';
    const avatar = pol.avatar || '/assets/themes/brasilia.jpg';

    // 3 Redes Oficiais Verificadas (SEM fallbacks falsos para evitar páginas aleatórias)
    const instagramUrl = profiles.instagram || null;
    const youtubeUrl = (isLive && pol.socialStatus?.liveUrl) ? pol.socialStatus.liveUrl : (profiles.youtube || null);
    const tiktokUrl = profiles.tiktok || null;

    const isInstagramOnline = Boolean(instagramUrl && onlineNetworks.includes('instagram'));
    const isYoutubeOnline = Boolean(youtubeUrl && onlineNetworks.includes('youtube'));
    const isTiktokOnline = Boolean(tiktokUrl && onlineNetworks.includes('tiktok'));

    return `
      <div class="relative bg-slate-900 rounded-2xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 border border-slate-200/90 group flex flex-col justify-between aspect-[3/4] sm:aspect-[4/5]">
        <!-- Foto Oficial do Político em Alta Definição -->
        <img 
          src="${avatar}" 
          alt="${popularName}" 
          class="absolute inset-0 w-full h-full object-cover object-top group-hover:scale-105 transition-transform duration-500"
          onerror="this.src='/assets/themes/brasilia.jpg'"
        />
        
        <!-- Gradientes para Máxima Legibilidade dos Elementos -->
        <div class="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/45 to-slate-950/20 pointer-events-none"></div>

        <!-- Canto Superior: Pequeno Quadrado Vermelho 'Ao Vivo' no Canto Superior Esquerdo -->
        <div class="relative z-10 p-2.5 sm:p-3 flex items-start justify-between">
          <div class="bg-red-600 text-white text-[10px] sm:text-[11px] font-black uppercase tracking-wider px-2 py-0.5 rounded shadow-md flex items-center gap-1.5 border border-red-500/50">
            <span class="w-1.5 h-1.5 rounded-full bg-white animate-pulse"></span>
            <span>Ao Vivo</span>
          </div>

          <!-- Botão Favoritar Discreto no Canto Superior Direito -->
          <button 
            onclick="toggleFavoritePolitician('${pol.id}')" 
            class="w-7 h-7 rounded-full bg-black/50 hover:bg-black/80 backdrop-blur-xs text-white/90 hover:text-rose-400 flex items-center justify-center transition border border-white/20 shadow-xs"
            title="Favoritar ${popularName}"
          >
            <i class="${isFav ? 'fa-solid text-rose-500' : 'fa-regular'} fa-heart text-xs"></i>
          </button>
        </div>

        <!-- Base da Imagem: Identificação + Três Quadrados com as Logos (Instagram, YouTube, TikTok) -->
        <div class="relative z-10 p-2.5 sm:p-3 space-y-2 mt-auto">
          <!-- Nome Nítido e Cargo -->
          <div>
            <h4 class="text-sm sm:text-base font-black text-white leading-tight drop-shadow-md truncate">
              ${popularName}
            </h4>
            <p class="text-[11px] font-bold text-slate-300 drop-shadow-xs truncate mt-0.5">
              <span class="text-amber-400 font-extrabold">${party}</span> • ${(office).split(' ')[0]}
            </p>
          </div>

          <!-- Três Quadrados das Redes Sociais: Online = ILUMINADA | Offline = APAGADA -->
          <div class="grid grid-cols-3 gap-1.5 sm:gap-2 pt-1.5 border-t border-white/15">
            <!-- 1. Instagram -->
            ${isInstagramOnline ? `
              <a 
                href="${instagramUrl}" 
                target="_blank" 
                rel="noopener noreferrer"
                class="h-11 sm:h-12 rounded-xl bg-gradient-to-tr from-amber-500 via-rose-500 to-purple-600 text-white flex flex-col items-center justify-center shadow-lg shadow-rose-950/60 ring-2 ring-white/90 hover:scale-105 active:scale-95 transition-all group/net" 
                title="Instagram de ${popularName} (Online - Clique para acessar)"
              >
                <i class="fa-brands fa-instagram text-base sm:text-lg leading-none"></i>
                <span class="text-[8px] font-black uppercase tracking-tight text-white/95 mt-0.5">Online</span>
              </a>
            ` : `
              <div 
                class="h-11 sm:h-12 rounded-xl bg-slate-950/80 border border-slate-800/60 text-slate-500 opacity-25 filter grayscale flex flex-col items-center justify-center select-none cursor-not-allowed" 
                title="Instagram (Offline no momento)"
              >
                <i class="fa-brands fa-instagram text-base sm:text-lg leading-none"></i>
                <span class="text-[8px] font-bold uppercase tracking-tight text-slate-500 mt-0.5">Offline</span>
              </div>
            `}

            <!-- 2. YouTube -->
            ${isYoutubeOnline ? `
              <a 
                href="${youtubeUrl}" 
                target="_blank" 
                rel="noopener noreferrer"
                class="h-11 sm:h-12 rounded-xl bg-red-600 text-white flex flex-col items-center justify-center shadow-lg shadow-red-950/60 ring-2 ring-white/90 hover:scale-105 active:scale-95 transition-all group/net" 
                title="YouTube de ${popularName} (Online - Clique para acessar)"
              >
                <i class="fa-brands fa-youtube text-base sm:text-lg leading-none"></i>
                <span class="text-[8px] font-black uppercase tracking-tight text-white/95 mt-0.5">${isLive ? 'Ao Vivo' : 'Online'}</span>
              </a>
            ` : `
              <div 
                class="h-11 sm:h-12 rounded-xl bg-slate-950/80 border border-slate-800/60 text-slate-500 opacity-25 filter grayscale flex flex-col items-center justify-center select-none cursor-not-allowed" 
                title="YouTube (Offline no momento)"
              >
                <i class="fa-brands fa-youtube text-base sm:text-lg leading-none"></i>
                <span class="text-[8px] font-bold uppercase tracking-tight text-slate-500 mt-0.5">Offline</span>
              </div>
            `}

            <!-- 3. TikTok -->
            ${isTiktokOnline ? `
              <a 
                href="${tiktokUrl}" 
                target="_blank" 
                rel="noopener noreferrer"
                class="h-11 sm:h-12 rounded-xl bg-black text-cyan-300 border border-cyan-400/80 flex flex-col items-center justify-center shadow-lg shadow-cyan-950/60 ring-2 ring-white/90 hover:scale-105 active:scale-95 transition-all group/net" 
                title="TikTok de ${popularName} (Online - Clique para acessar)"
              >
                <i class="fa-brands fa-tiktok text-base sm:text-lg leading-none text-white drop-shadow-[0_0_3px_#06b6d4]"></i>
                <span class="text-[8px] font-black uppercase tracking-tight text-cyan-300 mt-0.5">Online</span>
              </a>
            ` : `
              <div 
                class="h-11 sm:h-12 rounded-xl bg-slate-950/80 border border-slate-800/60 text-slate-500 opacity-25 filter grayscale flex flex-col items-center justify-center select-none cursor-not-allowed" 
                title="TikTok (Offline no momento)"
              >
                <i class="fa-brands fa-tiktok text-base sm:text-lg leading-none"></i>
                <span class="text-[8px] font-bold uppercase tracking-tight text-slate-500 mt-0.5">Offline</span>
              </div>
            `}
          </div>
        </div>
      </div>
    `;
  }).join('');
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
