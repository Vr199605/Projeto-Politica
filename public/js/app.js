/**
 * RADAR POLÍTICO - Frontend Application Logic v2.0
 * Funcionalidades: Busca temporal, Top 3 & Top 10, Blogs VIP na Home,
 * Radar Social / Lives em tempo real, Autenticação e Sistema de Favoritos.
 */

// Estado global da aplicação
const state = {
  currentTab: 'search',
  currentUser: null, // { id, name, email, avatar }
  favoritePoliticianIds: new Set(),
  favoriteBlogIds: new Set(),
  articles: [],
  politiciansTop10: [],
  sitesTop10: [],
  blogs: [],
  socialPoliticians: [],
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
  totalClicks: 0,
  currentFavTab: 'politicians',
  currentSocialFilter: 'all'
};

// Inicialização ao carregar a página
document.addEventListener('DOMContentLoaded', () => {
  initAuth();
  initDatePresets();
  runDefaultSearch();
  loadPoliticiansRanking();
  loadSitesRanking();
  loadBlogsList();
  loadSocialStatus();
  loadMonetizationStats();
});

// ========================================================
// 1. SISTEMA DE AUTENTICAÇÃO E SESSÃO DO USUÁRIO
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
    // Carregar favoritos locais se houver
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
  const prompt = document.getElementById('home-login-prompt');

  if (state.currentUser) {
    if (btnLogin) btnLogin.classList.add('hidden');
    if (userMenu) userMenu.classList.remove('hidden');
    if (avatar) avatar.src = state.currentUser.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=160';
    if (name) name.textContent = state.currentUser.name.split(' ')[0];
    if (prompt) prompt.classList.add('hidden');
  } else {
    if (btnLogin) btnLogin.classList.remove('hidden');
    if (userMenu) userMenu.classList.add('hidden');
    if (prompt) prompt.classList.remove('hidden');
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
      renderHomeTop3();
      renderHomeSponsoredBlogs();
    }
  } catch (err) {
    console.error('Erro ao carregar favoritos do usuário:', err);
  }
}

function updateFavBadge() {
  const badge = document.getElementById('fav-counter-badge');
  const total = state.favoritePoliticianIds.size + state.favoriteBlogIds.size;
  if (badge) badge.textContent = total;
}

function openAuthModal(tab = 'login') {
  document.getElementById('modal-auth').classList.remove('hidden');
  switchAuthTab(tab);
}

function switchAuthTab(tab) {
  const loginForm = document.getElementById('form-auth-login');
  const regForm = document.getElementById('form-auth-register');
  const btnLogin = document.getElementById('auth-tab-btn-login');
  const btnReg = document.getElementById('auth-tab-btn-register');

  if (tab === 'login') {
    loginForm.classList.remove('hidden');
    regForm.classList.add('hidden');
    btnLogin.className = 'text-base font-extrabold pb-1 border-b-2 border-blue-600 text-blue-600 transition';
    btnReg.className = 'text-base font-bold pb-1 text-slate-400 hover:text-slate-700 transition';
  } else {
    loginForm.classList.add('hidden');
    regForm.classList.remove('hidden');
    btnLogin.className = 'text-base font-bold pb-1 text-slate-400 hover:text-slate-700 transition';
    btnReg.className = 'text-base font-extrabold pb-1 border-b-2 border-emerald-600 text-emerald-600 transition';
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
      showToast(`Bem-vindo de volta, ${data.user.name}!`, 'success');
    } else {
      showToast(data.error || 'Credenciais inválidas.', 'error');
    }
  } catch (err) {
    showToast('Falha na comunicação com o servidor.', 'error');
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
      showToast(data.error || 'Erro ao criar conta.', 'error');
    }
  } catch (err) {
    showToast('Erro ao criar conta.', 'error');
  }
}

function handleLogout() {
  state.currentUser = null;
  localStorage.removeItem('rp_user');
  state.favoritePoliticianIds.clear();
  state.favoriteBlogIds.clear();
  updateHeaderAuthUI();
  updateFavBadge();
  renderHomeTop3();
  renderHomeSponsoredBlogs();
  showToast('Você saiu da sua conta.', 'info');
}

// ========================================================
// 2. SISTEMA DE FAVORITOS (POLÍTICOS E BLOGS)
// ========================================================
async function toggleFavoritePolitician(polId, event) {
  if (event) event.stopPropagation();

  if (!state.currentUser) {
    showToast('Faça login ou crie sua conta para salvar favoritos!', 'info');
    openAuthModal('login');
    return;
  }

  try {
    const res = await fetch('/api/users/favorites/politician', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: state.currentUser.id, politicianId: polId })
    });
    const data = await res.json();

    if (data.success) {
      if (data.isFavorited) {
        state.favoritePoliticianIds.add(polId);
        showToast('Político adicionado aos seus favoritos! ❤️', 'success');
      } else {
        state.favoritePoliticianIds.delete(polId);
        showToast('Político removido dos favoritos.', 'info');
      }
      updateFavBadge();
      renderHomeTop3();
      renderPoliticiansRanking();
      if (!document.getElementById('modal-favorites').classList.contains('hidden')) {
        renderFavoritesModalList();
      }
    }
  } catch (err) {
    console.error('Erro ao favoritar político:', err);
  }
}

async function toggleFavoriteBlog(blogId, event) {
  if (event) event.stopPropagation();

  if (!state.currentUser) {
    showToast('Faça login para salvar seus blogs favoritos!', 'info');
    openAuthModal('login');
    return;
  }

  try {
    const res = await fetch('/api/users/favorites/blog', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: state.currentUser.id, blogId: blogId })
    });
    const data = await res.json();

    if (data.success) {
      if (data.isFavorited) {
        state.favoriteBlogIds.add(blogId);
        showToast('Blog salvo nos seus favoritos! ⭐', 'success');
      } else {
        state.favoriteBlogIds.delete(blogId);
        showToast('Blog removido dos favoritos.', 'info');
      }
      updateFavBadge();
      renderHomeSponsoredBlogs();
      renderBlogsGrid();
      if (!document.getElementById('modal-favorites').classList.contains('hidden')) {
        renderFavoritesModalList();
      }
    }
  } catch (err) {
    console.error('Erro ao favoritar blog:', err);
  }
}

function openFavoritesModal() {
  document.getElementById('modal-favorites').classList.remove('hidden');
  renderFavoritesModalList();
}

function switchFavTab(tab) {
  state.currentFavTab = tab;
  const btnP = document.getElementById('fav-tab-politicians');
  const btnB = document.getElementById('fav-tab-blogs');

  if (tab === 'politicians') {
    btnP.className = 'px-3 py-1.5 rounded-lg bg-blue-600 text-white font-bold';
    btnB.className = 'px-3 py-1.5 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 font-bold';
  } else {
    btnP.className = 'px-3 py-1.5 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 font-bold';
    btnB.className = 'px-3 py-1.5 rounded-lg bg-blue-600 text-white font-bold';
  }
  renderFavoritesModalList();
}

function renderFavoritesModalList() {
  const container = document.getElementById('favorites-content-list');
  const countP = document.getElementById('fav-count-politicians');
  const countB = document.getElementById('fav-count-blogs');

  if (countP) countP.textContent = state.favoritePoliticianIds.size;
  if (countB) countB.textContent = state.favoriteBlogIds.size;

  if (state.currentFavTab === 'politicians') {
    if (state.favoritePoliticianIds.size === 0) {
      container.innerHTML = `
        <div class="text-center py-8 text-slate-500 text-xs">
          <i class="fa-regular fa-heart text-2xl text-slate-300 mb-2 block"></i>
          Nenhum político favoritado ainda. Clique no coração ❤️ em qualquer político para salvar.
        </div>
      `;
      return;
    }

    const favList = (state.politiciansTop10 || []).filter(p => state.favoritePoliticianIds.has(p.id));
    container.innerHTML = favList.map(pol => `
      <div class="flex items-center justify-between p-3 bg-slate-50 rounded-2xl border border-slate-200">
        <div class="flex items-center gap-3">
          <img src="${pol.avatar}" class="w-10 h-10 rounded-xl object-cover border border-slate-200">
          <div>
            <h4 class="text-xs font-bold text-slate-900">${escapeHtml(pol.popularName || pol.name)}</h4>
            <span class="text-[11px] text-slate-500">${escapeHtml(pol.party)} &bull; ${escapeHtml(pol.office)}</span>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <button onclick="quickSearchPolitico('${escapeHtml(pol.popularName || pol.name)}'); closeModal('modal-favorites');" class="px-3 py-1.5 bg-blue-600 text-white font-bold text-xs rounded-xl hover:bg-blue-700 transition">
            Ver Notícias
          </button>
          <button onclick="toggleFavoritePolitician('${pol.id}', event)" class="p-2 text-rose-600 hover:bg-rose-50 rounded-xl transition" title="Remover">
            <i class="fa-solid fa-heart"></i>
          </button>
        </div>
      </div>
    `).join('');
  } else {
    if (state.favoriteBlogIds.size === 0) {
      container.innerHTML = `
        <div class="text-center py-8 text-slate-500 text-xs">
          <i class="fa-regular fa-star text-2xl text-slate-300 mb-2 block"></i>
          Nenhum blog ou portal favoritado. Clique na estrela ⭐ nos blogs para salvar seu canal favorito.
        </div>
      `;
      return;
    }

    const favBlogs = (state.blogs || []).filter(b => state.favoriteBlogIds.has(b.id) || state.favoriteBlogIds.has(b.domain));
    container.innerHTML = favBlogs.map(blog => `
      <div class="flex items-center justify-between p-3 bg-slate-50 rounded-2xl border border-slate-200">
        <div>
          <h4 class="text-xs font-bold text-slate-900">${escapeHtml(blog.name)}</h4>
          <span class="text-[11px] text-slate-500">${escapeHtml(blog.domain)} &bull; ${escapeHtml(blog.category)}</span>
        </div>
        <div class="flex items-center gap-2">
          <button onclick="trackSiteClick('${blog.id}', '${escapeHtml(blog.name)}', '${blog.url}')" class="px-3 py-1.5 bg-slate-900 text-white font-bold text-xs rounded-xl hover:bg-slate-800 transition">
            Acessar
          </button>
          <button onclick="toggleFavoriteBlog('${blog.id}', event)" class="p-2 text-amber-500 hover:bg-amber-50 rounded-xl transition" title="Remover">
            <i class="fa-solid fa-star"></i>
          </button>
        </div>
      </div>
    `).join('');
  }
}

// ========================================================
// 3. NOVO NA HOME: TOP 3 POLÍTICOS & PORTAIS NA HOME
// ========================================================
function renderHomeTop3() {
  const containerPoliticians = document.getElementById('home-top3-politicians');
  const containerSites = document.getElementById('home-top3-sites');

  // Top 3 Políticos
  if (containerPoliticians && state.politiciansTop10.length > 0) {
    const top3P = state.politiciansTop10.slice(0, 3);
    const medals = ['🥇', '🥈', '🥉'];
    const ranks = ['1º Lugar', '2º Lugar', '3º Lugar'];

    containerPoliticians.innerHTML = top3P.map((pol, idx) => {
      const isFav = state.favoritePoliticianIds.has(pol.id);
      return `
        <div class="flex items-center justify-between p-3 rounded-2xl bg-slate-50/80 hover:bg-slate-100/90 border border-slate-200/90 transition group">
          <div class="flex items-center gap-3">
            <span class="text-xl shrink-0">${medals[idx]}</span>
            <img src="${pol.avatar}" alt="${escapeHtml(pol.name)}" class="w-10 h-10 rounded-xl object-cover border border-slate-200 shadow-xs" onerror="this.src='https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=160'">
            <div>
              <div class="flex items-center gap-1.5">
                <h4 class="text-xs font-bold text-slate-900 group-hover:text-blue-600 transition">${escapeHtml(pol.popularName || pol.name)}</h4>
                <span class="bg-blue-50 text-blue-700 text-[10px] font-extrabold px-1.5 py-0.2 rounded border border-blue-200">${escapeHtml(pol.party)}</span>
              </div>
              <p class="text-[11px] text-slate-500 font-medium">${pol.searchCount.toLocaleString('pt-BR')} buscas registradas</p>
            </div>
          </div>

          <div class="flex items-center gap-1.5">
            <button 
              onclick="toggleFavoritePolitician('${pol.id}', event)" 
              class="p-2 rounded-xl border border-slate-200 bg-white hover:bg-rose-50 transition text-xs ${isFav ? 'text-rose-600' : 'text-slate-400 hover:text-rose-500'}" 
              title="${isFav ? 'Remover dos favoritos' : 'Favoritar este político'}"
            >
              <i class="${isFav ? 'fa-solid' : 'fa-regular'} fa-heart"></i>
            </button>
            <button 
              onclick="quickSearchPolitico('${escapeHtml(pol.popularName || pol.name)}')" 
              class="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs transition"
            >
              Pesquisar
            </button>
          </div>
        </div>
      `;
    }).join('');

    const lbl = document.getElementById('home-politicians-total-searches');
    if (lbl) lbl.textContent = `${state.totalSearches.toLocaleString('pt-BR')} buscas totais`;
  }

  // Top 3 Portais
  if (containerSites && state.sitesTop10.length > 0) {
    const top3S = state.sitesTop10.slice(0, 3);
    const badges = [
      'bg-amber-400 text-slate-950 font-black',
      'bg-slate-300 text-slate-900 font-black',
      'bg-orange-300 text-slate-900 font-black'
    ];

    containerSites.innerHTML = top3S.map((site, idx) => {
      const isFav = state.favoriteBlogIds.has(site.id) || state.favoriteBlogIds.has(site.domain);
      return `
        <div class="flex items-center justify-between p-3 rounded-2xl bg-slate-50/80 hover:bg-indigo-50/50 border border-slate-200/90 transition group">
          <div class="flex items-center gap-3">
            <span class="w-7 h-7 rounded-lg ${badges[idx]} text-xs flex items-center justify-center shrink-0">
              #${idx + 1}
            </span>
            <div class="w-9 h-9 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-lg shrink-0">
              ${site.logo || '🌐'}
            </div>
            <div>
              <div class="flex items-center gap-1.5">
                <h4 class="text-xs font-bold text-slate-900 group-hover:text-indigo-600 transition">${escapeHtml(site.name)}</h4>
                ${site.verified ? '<i class="fa-solid fa-circle-check text-blue-500 text-[10px]" title="Verificado"></i>' : ''}
              </div>
              <p class="text-[11px] text-indigo-700 font-bold">${site.clicks.toLocaleString('pt-BR')} cliques no app</p>
            </div>
          </div>

          <div class="flex items-center gap-1.5">
            <button 
              onclick="toggleFavoriteBlog('${site.id}', event)" 
              class="p-2 rounded-xl border border-slate-200 bg-white hover:bg-amber-50 transition text-xs ${isFav ? 'text-amber-500' : 'text-slate-400 hover:text-amber-500'}" 
              title="${isFav ? 'Remover dos favoritos' : 'Favoritar este portal'}"
            >
              <i class="${isFav ? 'fa-solid' : 'fa-regular'} fa-star"></i>
            </button>
            <button 
              onclick="trackSiteClick('${site.id}', '${escapeHtml(site.name)}', '${site.url}')" 
              class="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs transition flex items-center gap-1"
            >
              <span>Acessar</span>
              <i class="fa-solid fa-arrow-up-right-from-square text-[9px]"></i>
            </button>
          </div>
        </div>
      `;
    }).join('');

    const lbl = document.getElementById('home-sites-total-clicks');
    if (lbl) lbl.textContent = `${state.totalClicks.toLocaleString('pt-BR')} cliques computados`;
  }
}

// ========================================================
// 4. NOVO NA HOME: BLOGS E FONTES PATROCINADORAS VIP
// ========================================================
function renderHomeSponsoredBlogs() {
  const container = document.getElementById('home-sponsored-blogs-grid');
  if (!container || !state.blogs) return;

  // Filtrar os blogs patrocinados ou de destaque
  const sponsored = state.blogs.filter(b => b.isSponsored).slice(0, 3);
  const displayBlogs = sponsored.length > 0 ? sponsored : state.blogs.slice(0, 3);

  container.innerHTML = displayBlogs.map(blog => {
    const isFav = state.favoriteBlogIds.has(blog.id) || state.favoriteBlogIds.has(blog.domain);
    return `
      <div class="bg-white rounded-2xl border border-amber-200/90 p-4 flex flex-col justify-between shadow-xs hover:shadow-md transition relative">
        <div class="flex items-center justify-between mb-2">
          <span class="bg-amber-100 text-amber-900 border border-amber-300 text-[10px] font-extrabold px-2 py-0.5 rounded uppercase tracking-wider flex items-center gap-1">
            <i class="fa-solid fa-crown text-[10px]"></i> ${escapeHtml(blog.badgeText || 'Parceiro VIP')}
          </span>
          <button onclick="toggleFavoriteBlog('${blog.id}', event)" class="text-xs ${isFav ? 'text-amber-500' : 'text-slate-300 hover:text-amber-500'} transition">
            <i class="${isFav ? 'fa-solid' : 'fa-regular'} fa-star"></i>
          </button>
        </div>

        <div>
          <h3 class="text-sm font-extrabold text-slate-900 leading-snug">${escapeHtml(blog.name)}</h3>
          <p class="text-[11px] text-slate-500 font-medium">${escapeHtml(blog.author)} &bull; ${escapeHtml(blog.domain)}</p>
          <p class="text-xs text-slate-600 mt-2 line-clamp-2 leading-relaxed">
            ${escapeHtml(blog.description)}
          </p>
        </div>

        <div class="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between">
          <span class="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
            ${escapeHtml(blog.category)}
          </span>
          <button 
            onclick="trackSiteClick('${blog.id}', '${escapeHtml(blog.name)}', '${blog.url}')" 
            class="px-3 py-1.5 bg-slate-900 hover:bg-blue-600 text-white font-extrabold text-xs rounded-xl transition flex items-center gap-1"
          >
            <span>Visitar Fonte</span>
            <i class="fa-solid fa-arrow-up-right-from-square text-[9px]"></i>
          </button>
        </div>
      </div>
    `;
  }).join('');
}

// ========================================================
// 5. NOVO NA HOME & ABA: RADAR SOCIAL (STATUS AO VIVO)
// ========================================================
async function loadSocialStatus(notify = false) {
  try {
    const res = await fetch('/api/politicians/social-status');
    const data = await res.json();

    if (data.success) {
      state.socialPoliticians = data.politicians || [];

      // Atualizar contadores
      const liveBadge = document.getElementById('badge-live-count');
      const liveStat = document.getElementById('social-live-count-stat');
      if (liveBadge) {
        liveBadge.textContent = data.totalLive;
        if (data.totalLive > 0) liveBadge.classList.remove('hidden');
      }
      if (liveStat) liveStat.textContent = data.totalLive;

      renderHomeSocialStatus();
      renderDetailedSocialStatus(state.currentSocialFilter);

      if (notify) showToast('Status social dos políticos atualizado!', 'success');
    }
  } catch (err) {
    console.error('Erro ao carregar status social:', err);
  }
}

function renderHomeSocialStatus() {
  const container = document.getElementById('home-social-status-grid');
  if (!container || !state.socialPoliticians) return;

  const topSocial = state.socialPoliticians.slice(0, 4);

  container.innerHTML = topSocial.map(pol => {
    const s = pol.socialStatus || {};
    const isLive = s.isLive;
    const isFav = state.favoritePoliticianIds.has(pol.id);

    return `
      <div class="p-3.5 rounded-2xl border ${isLive ? 'border-rose-300 bg-rose-50/30 live-glow' : 'border-slate-200 bg-slate-50/60'} flex flex-col justify-between hover:shadow-xs transition">
        <div>
          <div class="flex items-center justify-between mb-2">
            <span class="inline-flex items-center gap-1 text-[10px] font-extrabold px-2 py-0.5 rounded-full ${isLive ? 'bg-rose-100 text-rose-700 animate-pulse' : 'bg-emerald-100 text-emerald-800'}">
              <span class="w-1.5 h-1.5 rounded-full ${isLive ? 'bg-rose-600' : 'bg-emerald-500'}"></span>
              ${isLive ? 'AO VIVO AGORA' : escapeHtml(s.statusLabel || 'ONLINE')}
            </span>
            <button onclick="toggleFavoritePolitician('${pol.id}', event)" class="text-xs ${isFav ? 'text-rose-600' : 'text-slate-300 hover:text-rose-500'}">
              <i class="${isFav ? 'fa-solid' : 'fa-regular'} fa-heart"></i>
            </button>
          </div>

          <div class="flex items-center gap-2.5">
            <img src="${pol.avatar}" class="w-9 h-9 rounded-xl object-cover border border-slate-200">
            <div>
              <h4 class="text-xs font-bold text-slate-900 leading-tight">${escapeHtml(pol.popularName || pol.name)}</h4>
              <span class="text-[10px] text-slate-500 font-medium">${escapeHtml(pol.party)} &bull; ${escapeHtml(s.lastActivity || 'Hoje')}</span>
            </div>
          </div>

          <p class="text-[11px] text-slate-600 mt-2 line-clamp-2">
            ${isLive ? `🔴 <strong>${escapeHtml(s.liveTitle || 'Transmissão em andamento')}</strong>` : escapeHtml(s.recentPost || 'Atividades parlamentares.')}
          </p>
        </div>

        <div class="mt-3 pt-2 border-t border-slate-200/60 flex items-center justify-between">
          <span class="text-[10px] font-bold text-slate-500">
            ${isLive ? `<i class="fa-brands fa-${(s.livePlatform || 'youtube').toLowerCase()} text-rose-600"></i> ${escapeHtml(s.livePlatform || 'Live')}` : '<i class="fa-brands fa-x-twitter"></i> Redes'}
          </span>
          <button 
            onclick="${isLive ? `window.open('${s.liveUrl}', '_blank')` : `quickSearchPolitico('${escapeHtml(pol.popularName || pol.name)}')`}" 
            class="text-[11px] font-bold ${isLive ? 'bg-rose-600 hover:bg-rose-700 text-white' : 'bg-slate-900 hover:bg-blue-600 text-white'} px-2.5 py-1 rounded-lg transition"
          >
            ${isLive ? 'Assistir Live ↗' : 'Ver Matérias'}
          </button>
        </div>
      </div>
    `;
  }).join('');
}

function filterSocialList(filter) {
  state.currentSocialFilter = filter;
  document.querySelectorAll('.social-tab-btn').forEach(b => {
    b.className = 'social-tab-btn px-3 py-1 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 font-bold';
  });
  const activeBtn = document.getElementById(`social-filter-${filter}`);
  if (activeBtn) activeBtn.className = 'social-tab-btn active px-3 py-1 rounded-lg bg-slate-900 text-white font-bold';

  renderDetailedSocialStatus(filter);
}

function renderDetailedSocialStatus(filter = 'all') {
  const container = document.getElementById('social-status-detailed-grid');
  if (!container || !state.socialPoliticians) return;

  let list = [...state.socialPoliticians];
  if (filter === 'live') {
    list = list.filter(p => p.socialStatus?.isLive);
  } else if (filter === 'online') {
    list = list.filter(p => p.socialStatus?.status === 'online');
  }

  if (list.length === 0) {
    container.innerHTML = `
      <div class="col-span-full text-center py-12 bg-white rounded-3xl border border-dashed border-slate-300 p-8">
        <p class="text-sm font-bold text-slate-700">Nenhum político encontrado com este filtro no momento.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = list.map(pol => {
    const s = pol.socialStatus || {};
    const isLive = s.isLive;
    const isFav = state.favoritePoliticianIds.has(pol.id);

    return `
      <div class="bg-white rounded-3xl border ${isLive ? 'border-rose-400 live-glow' : 'border-slate-200'} p-5 flex flex-col justify-between shadow-xs hover:shadow-md transition">
        <div>
          <!-- Header do Card -->
          <div class="flex items-center justify-between mb-3">
            <span class="inline-flex items-center gap-1.5 text-xs font-extrabold px-3 py-1 rounded-full ${isLive ? 'bg-rose-100 text-rose-700 animate-pulse' : 'bg-emerald-100 text-emerald-800'}">
              <span class="w-2 h-2 rounded-full ${isLive ? 'bg-rose-600' : 'bg-emerald-500'}"></span>
              ${isLive ? 'AO VIVO AGORA' : escapeHtml(s.statusLabel || 'ONLINE')}
            </span>

            <div class="flex items-center gap-2">
              <button onclick="toggleFavoritePolitician('${pol.id}', event)" class="p-1.5 rounded-lg border border-slate-200 ${isFav ? 'text-rose-600 bg-rose-50' : 'text-slate-400 hover:text-rose-500'}" title="Favoritar">
                <i class="${isFav ? 'fa-solid' : 'fa-regular'} fa-heart text-xs"></i>
              </button>
              <button onclick="toggleLiveDemo('${pol.id}')" class="text-[10px] font-bold text-slate-500 bg-slate-100 hover:bg-slate-200 px-2 py-1 rounded-lg" title="Simular status ao vivo no teste">
                ${isLive ? 'Encerrar Live' : 'Iniciar Live'}
              </button>
            </div>
          </div>

          <!-- Perfil do Político -->
          <div class="flex items-center gap-3">
            <img src="${pol.avatar}" class="w-12 h-12 rounded-2xl object-cover border border-slate-200 shadow-xs">
            <div>
              <h3 class="text-sm font-extrabold text-slate-900">${escapeHtml(pol.popularName || pol.name)}</h3>
              <p class="text-xs text-slate-500 font-semibold">${escapeHtml(pol.party)} &bull; ${escapeHtml(pol.office)}</p>
              <span class="text-[11px] text-indigo-600 font-bold">${escapeHtml(s.followersTotal || '1M+')} seguidores</span>
            </div>
          </div>

          <!-- Informações de Atividade Recente ou Live -->
          <div class="mt-4 p-3 bg-slate-50 rounded-2xl border border-slate-100 text-xs">
            ${isLive ? `
              <div class="space-y-1">
                <div class="text-[10px] font-extrabold uppercase text-rose-600 flex items-center gap-1">
                  <i class="fa-solid fa-signal"></i> Transmitindo no ${escapeHtml(s.livePlatform || 'YouTube')}
                </div>
                <h4 class="font-bold text-slate-900 text-xs leading-snug">${escapeHtml(s.liveTitle || 'Pronunciamento oficial ao vivo')}</h4>
              </div>
            ` : `
              <div class="space-y-1">
                <div class="text-[10px] font-bold text-slate-500">Última Publicação (${escapeHtml(s.lastActivity || 'Hoje')})</div>
                <p class="text-slate-700 text-xs">${escapeHtml(s.recentPost || 'Agenda pública em andamento.')}</p>
              </div>
            `}
          </div>
        </div>

        <!-- Links Oficiais para Redes -->
        <div class="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
          <div class="flex items-center gap-1.5 text-slate-600">
            ${s.profiles?.twitter ? `<a href="${s.profiles.twitter}" target="_blank" class="p-1.5 rounded-lg hover:bg-slate-100 text-slate-700" title="X/Twitter"><i class="fa-brands fa-x-twitter text-sm"></i></a>` : ''}
            ${s.profiles?.instagram ? `<a href="${s.profiles.instagram}" target="_blank" class="p-1.5 rounded-lg hover:bg-slate-100 text-pink-600" title="Instagram"><i class="fa-brands fa-instagram text-sm"></i></a>` : ''}
            ${s.profiles?.youtube ? `<a href="${s.profiles.youtube}" target="_blank" class="p-1.5 rounded-lg hover:bg-slate-100 text-red-600" title="YouTube"><i class="fa-brands fa-youtube text-sm"></i></a>` : ''}
            ${s.profiles?.tiktok ? `<a href="${s.profiles.tiktok}" target="_blank" class="p-1.5 rounded-lg hover:bg-slate-100 text-slate-900" title="TikTok"><i class="fa-brands fa-tiktok text-sm"></i></a>` : ''}
          </div>

          <div class="flex items-center gap-1.5">
            ${isLive ? `
              <button onclick="window.open('${s.liveUrl}', '_blank')" class="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs rounded-xl shadow-xs transition flex items-center gap-1">
                <span>Assistir</span> <i class="fa-solid fa-arrow-up-right-from-square text-[9px]"></i>
              </button>
            ` : `
              <button onclick="quickSearchPolitico('${escapeHtml(pol.popularName || pol.name)}')" class="px-3.5 py-1.5 bg-slate-900 hover:bg-blue-600 text-white font-bold text-xs rounded-xl transition">
                Notícias
              </button>
            `}
          </div>
        </div>

      </div>
    `;
  }).join('');
}

// Simular alternar status de live para demonstração interativa
async function toggleLiveDemo(polId) {
  const pol = state.socialPoliticians.find(p => p.id === polId);
  if (!pol) return;

  const willBeLive = !pol.socialStatus?.isLive;
  try {
    const res = await fetch(`/api/politicians/${polId}/social-status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        isLive: willBeLive,
        livePlatform: 'YouTube',
        liveTitle: `Pronunciamento de ${pol.popularName} sobre as decisões de Brasília`,
        liveUrl: 'https://youtube.com'
      })
    });
    const data = await res.json();
    if (data.success) {
      loadSocialStatus(false);
      showToast(willBeLive ? `Live ativada para ${pol.popularName}! 🔴` : `Live encerrada para ${pol.popularName}.`, 'info');
    }
  } catch (err) {
    console.error(err);
  }
}

// ========================================================
// 6. NAVEGAÇÃO ENTRE ABAS
// ========================================================
function switchTab(tabId) {
  state.currentTab = tabId;

  const sections = ['search', 'social', 'politicians', 'sites', 'blogs', 'monetization'];
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
        btn.className = 'nav-tab-btn active px-3.5 py-1.5 rounded-lg transition-all flex items-center gap-1.5 text-blue-700 bg-white shadow-xs';
      } else {
        btn.className = 'nav-tab-btn px-3.5 py-1.5 rounded-lg transition-all flex items-center gap-1.5 text-slate-600 hover:text-slate-900';
      }
    }
  });

  // Atualizar botões Mobile
  sections.forEach(id => {
    const mobBtn = document.getElementById(`mob-${id}`);
    if (mobBtn) {
      if (id === tabId) {
        mobBtn.className = 'mob-tab-btn active whitespace-nowrap px-3 py-1.5 rounded-lg bg-blue-600 text-white flex items-center gap-1.5';
      } else {
        mobBtn.className = 'mob-tab-btn whitespace-nowrap px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-700 flex items-center gap-1.5';
      }
    }
  });

  if (tabId === 'social') loadSocialStatus();
  if (tabId === 'politicians') loadPoliticiansRanking();
  if (tabId === 'sites') loadSitesRanking();
  if (tabId === 'blogs') loadBlogsList();
  if (tabId === 'monetization') loadMonetizationStats();

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ========================================================
// 7. BUSCA DE NOTÍCIAS POLÍTICAS (FUNÇÃO BASE 1)
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
  btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> <span>Buscando...</span>`;
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

  const sortedArticles = [...state.articles];
  if (state.sortBy === 'recent') {
    sortedArticles.sort((a, b) => new Date(b.publishedDate).getTime() - new Date(a.publishedDate).getTime());
  }

  container.innerHTML = sortedArticles.map((article) => {
    const dateFormatted = formatDateBR(article.publishedDate);
    const timeAgo = formatTimeAgo(article.publishedDate);
    const sourceClass = getSourceBadgeClass(article.source);
    const isFavSite = state.favoriteBlogIds.has(article.siteId);

    return `
      <article class="news-card bg-white rounded-3xl border border-slate-200/90 p-5 flex flex-col justify-between shadow-xs relative overflow-hidden">
        <div>
          <!-- Fonte & Data -->
          <div class="flex items-center justify-between gap-2 mb-3">
            <span class="${sourceClass} text-[11px] font-bold px-2.5 py-0.5 rounded-md border flex items-center gap-1.5">
              <i class="fa-regular fa-newspaper text-[10px]"></i> ${escapeHtml(article.source || 'Portal')}
            </span>
            <span class="text-[11px] text-slate-500 font-medium flex items-center gap-1" title="${dateFormatted}">
              <i class="fa-regular fa-clock text-[10px]"></i> ${timeAgo}
            </span>
          </div>

          <!-- Título -->
          <h3 class="text-sm font-bold text-slate-900 leading-snug line-clamp-2 hover:text-blue-600 transition">
            <a href="javascript:void(0)" onclick="trackSiteClick('${article.siteId || ''}', '${escapeHtml(article.source)}', '${article.url}')">
              ${escapeHtml(article.title)}
            </a>
          </h3>

          <!-- Trecho -->
          <p class="text-xs text-slate-600 line-clamp-3 mt-2 leading-relaxed">
            ${escapeHtml(article.snippet)}
          </p>
        </div>

        <!-- Tags e Ação -->
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
              class="w-full text-xs font-bold text-white bg-slate-900 hover:bg-blue-600 py-2.5 px-3 rounded-xl transition flex items-center justify-center gap-1.5 shadow-xs"
            >
              <span>Ler Matéria Completa</span>
              <i class="fa-solid fa-arrow-up-right-from-square text-[10px]"></i>
            </button>
            
            <button 
              onclick="copyNewsLink('${escapeHtml(article.title)}', '${article.url}')" 
              class="p-2.5 text-slate-400 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition shrink-0" 
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

function runDefaultSearch() {
  setDatePreset('30d');
  executeSearch();
}

function quickSearchPolitico(politicoName) {
  document.getElementById('input-politico').value = politicoName;
  state.activeFilters.politico = politicoName;
  switchTab('search');
  executeSearch();
  showToast(`Buscando notícias de: ${politicoName}`, 'info');
}

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

function resetSearchFilters() {
  document.getElementById('input-politico').value = '';
  document.getElementById('input-assunto').value = '';
  document.getElementById('input-data-inicio').value = '';
  document.getElementById('input-data-fim').value = '';

  state.activeFilters = { politico: '', assunto: '', dataInicio: '', dataFim: '', source: '' };
  renderActiveFilterTags();
}

function renderActiveFilterTags() {
  const container = document.getElementById('active-tags-container');
  container.innerHTML = '';

  if (state.activeFilters.politico) {
    container.innerHTML += `
      <span class="inline-flex items-center gap-1 bg-blue-100 text-blue-800 px-2 py-0.5 rounded text-[11px] font-bold">
        Político: ${escapeHtml(state.activeFilters.politico)}
        <button onclick="removeFilter('politico')" class="hover:text-blue-950 ml-0.5">&times;</button>
      </span>
    `;
  }
  if (state.activeFilters.assunto) {
    container.innerHTML += `
      <span class="inline-flex items-center gap-1 bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded text-[11px] font-bold">
        Assunto: ${escapeHtml(state.activeFilters.assunto)}
        <button onclick="removeFilter('assunto')" class="hover:text-indigo-950 ml-0.5">&times;</button>
      </span>
    `;
  }
  if (state.activeFilters.dataInicio || state.activeFilters.dataFim) {
    const dIni = state.activeFilters.dataInicio ? formatDateShort(state.activeFilters.dataInicio) : 'Início';
    const dFim = state.activeFilters.dataFim ? formatDateShort(state.activeFilters.dataFim) : 'Hoje';
    container.innerHTML += `
      <span class="inline-flex items-center gap-1 bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded text-[11px] font-bold">
        Período: ${dIni} até ${dFim}
        <button onclick="removeFilter('dates')" class="hover:text-emerald-950 ml-0.5">&times;</button>
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
// 8. TOP 10 POLÍTICOS MAIS BUSCADOS (FUNÇÃO BASE 4)
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
      renderHomeTop3();

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

  const podiumMedalConfig = [
    { rank: 1, title: '1º Lugar', medal: '🥇', class: 'podium-gold', border: 'border-amber-400', badge: 'bg-amber-100 text-amber-900 border-amber-300' },
    { rank: 2, title: '2º Lugar', medal: '🥈', class: 'podium-silver', border: 'border-slate-300', badge: 'bg-slate-100 text-slate-800 border-slate-300' },
    { rank: 3, title: '3º Lugar', medal: '🥉', class: 'podium-bronze', border: 'border-orange-300', badge: 'bg-orange-100 text-orange-900 border-orange-300' }
  ];

  podiumEl.innerHTML = top3.map((pol, idx) => {
    const conf = podiumMedalConfig[idx] || podiumMedalConfig[0];
    const percent = Math.round((pol.searchCount / maxSearches) * 100);
    const isFav = state.favoritePoliticianIds.has(pol.id);

    return `
      <div class="${conf.class} rounded-3xl p-5 border relative overflow-hidden flex flex-col justify-between">
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
          <button onclick="toggleFavoritePolitician('${pol.id}', event)" class="p-2 text-base ${isFav ? 'text-rose-600' : 'text-slate-400 hover:text-rose-500'} transition" title="Favoritar">
            <i class="${isFav ? 'fa-solid' : 'fa-regular'} fa-heart"></i>
          </button>
        </div>

        <div class="mt-4 pt-4 border-t border-slate-200/60">
          <div class="flex justify-between items-baseline mb-1">
            <span class="text-xs font-bold text-slate-600">Volume de Buscas</span>
            <span class="text-base font-extrabold text-slate-900">${pol.searchCount.toLocaleString('pt-BR')} <span class="text-[11px] font-semibold text-slate-500">buscas</span></span>
          </div>
          
          <div class="w-full bg-slate-200/80 rounded-full h-2.5 overflow-hidden">
            <div class="bg-blue-600 h-2.5 rounded-full ranking-bar-fill" style="width: ${percent}%"></div>
          </div>

          <div class="flex items-center justify-between gap-2 mt-4">
            <button onclick="quickSearchPolitico('${escapeHtml(pol.popularName || pol.name)}')" class="flex-1 py-2 px-3 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs transition flex items-center justify-center gap-1.5">
              <i class="fa-solid fa-magnifying-glass text-[10px]"></i> Ver Notícias
            </button>
            <button onclick="incrementPoliticianSearch('${pol.id}')" class="py-2 px-3 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 font-bold text-xs rounded-xl transition shadow-xs" title="Simular +1 busca no MVP">
              +1 Busca
            </button>
          </div>
        </div>
      </div>
    `;
  }).join('');

  tableEl.innerHTML = rest.map((pol) => {
    const percent = Math.round((pol.searchCount / maxSearches) * 100);
    const isFav = state.favoritePoliticianIds.has(pol.id);

    return `
      <div class="p-4 sm:px-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 hover:bg-slate-50/80 transition">
        <div class="flex items-center gap-3 w-full sm:w-auto">
          <span class="w-7 h-7 rounded-lg bg-slate-100 text-slate-700 font-extrabold text-xs flex items-center justify-center border border-slate-200 shrink-0">
            #${pol.rank}
          </span>
          <img src="${pol.avatar}" class="w-10 h-10 rounded-xl object-cover border border-slate-200" onerror="this.src='https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=160'">
          <div>
            <div class="flex items-center gap-2">
              <h4 class="text-sm font-bold text-slate-900">${escapeHtml(pol.popularName || pol.name)}</h4>
              <span class="bg-blue-50 text-blue-700 font-bold text-[10px] px-1.5 py-0.5 rounded border border-blue-200">${escapeHtml(pol.party)}</span>
            </div>
            <p class="text-xs text-slate-500">${escapeHtml(pol.office)}</p>
          </div>
        </div>

        <div class="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-end">
          <div class="text-right sm:min-w-[130px]">
            <span class="text-sm font-extrabold text-slate-900">${pol.searchCount.toLocaleString('pt-BR')}</span>
            <span class="text-[11px] text-slate-500 font-medium"> buscas</span>
            <div class="w-24 bg-slate-100 rounded-full h-1.5 mt-1 overflow-hidden ml-auto">
              <div class="bg-blue-500 h-1.5 rounded-full ranking-bar-fill" style="width: ${percent}%"></div>
            </div>
          </div>

          <div class="flex items-center gap-1.5">
            <button onclick="toggleFavoritePolitician('${pol.id}', event)" class="p-2 text-xs rounded-lg ${isFav ? 'text-rose-600' : 'text-slate-400 hover:text-rose-500'} transition">
              <i class="${isFav ? 'fa-solid' : 'fa-regular'} fa-heart"></i>
            </button>
            <button onclick="quickSearchPolitico('${escapeHtml(pol.popularName || pol.name)}')" class="px-3 py-1.5 bg-slate-100 hover:bg-blue-50 text-slate-700 hover:text-blue-700 font-bold text-xs rounded-lg border border-slate-200 transition">
              Pesquisar
            </button>
            <button onclick="incrementPoliticianSearch('${pol.id}')" class="px-2 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-xs rounded-lg transition" title="+1">
              +1
            </button>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

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
      showToast(`+1 busca para ${data.politician.popularName}!`, 'success');
    }
  } catch (err) {
    console.error('Erro ao incrementar busca:', err);
  }
}

// ========================================================
// 9. TOP 10 SITES MAIS ACESSADOS (FUNÇÃO BASE 3)
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
      renderHomeTop3();

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
    const isFav = state.favoriteBlogIds.has(site.id) || state.favoriteBlogIds.has(site.domain);
    const rankBadgeClass = site.rank === 1 ? 'bg-amber-400 text-slate-950 font-black' :
                           site.rank === 2 ? 'bg-slate-300 text-slate-900 font-black' :
                           site.rank === 3 ? 'bg-orange-300 text-slate-900 font-black' :
                           'bg-slate-100 text-slate-700 font-bold';

    return `
      <div class="bg-white rounded-3xl border ${isTop3 ? 'border-indigo-200 shadow-sm' : 'border-slate-200'} p-5 flex flex-col justify-between hover:shadow-md transition">
        <div>
          <div class="flex items-start justify-between gap-3">
            <div class="flex items-center gap-3">
              <span class="w-8 h-8 rounded-xl ${rankBadgeClass} text-xs flex items-center justify-center">
                #${site.rank}
              </span>
              <div class="w-10 h-10 rounded-xl bg-slate-100 text-slate-800 flex items-center justify-center text-xl shrink-0 border border-slate-200">
                ${site.logo || '🌐'}
              </div>
              <div>
                <div class="flex items-center gap-1.5">
                  <h3 class="text-sm font-bold text-slate-900">${escapeHtml(site.name)}</h3>
                  ${site.verified ? '<i class="fa-solid fa-circle-check text-blue-500 text-xs" title="Verificado"></i>' : ''}
                </div>
                <span class="text-xs text-slate-500 font-medium">${escapeHtml(site.domain)}</span>
              </div>
            </div>

            <button onclick="toggleFavoriteBlog('${site.id}', event)" class="p-1.5 text-sm ${isFav ? 'text-amber-500' : 'text-slate-300 hover:text-amber-500'} transition" title="Favoritar">
              <i class="${isFav ? 'fa-solid' : 'fa-regular'} fa-star"></i>
            </button>
          </div>

          <div class="mt-3">
            <span class="text-[11px] font-bold text-slate-600 bg-slate-50 px-2.5 py-1 rounded-md border border-slate-100">
              ${escapeHtml(site.category || 'Portal')}
            </span>
          </div>
        </div>

        <div class="pt-4 mt-4 border-t border-slate-100">
          <div class="flex justify-between items-baseline mb-1.5">
            <span class="text-xs font-bold text-slate-600">Cliques no Aplicativo</span>
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
              title="Testar +1 clique"
            >
              +1 Clique
            </button>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

async function trackSiteClick(siteId, siteName, targetUrl) {
  try {
    await fetch('/api/sites/click', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ siteId, siteName, targetUrl })
    });
    loadSitesRanking(false);
  } catch (err) {
    console.warn('Erro ao registrar clique:', err);
  } finally {
    if (targetUrl && targetUrl !== '#' && !targetUrl.startsWith('javascript')) {
      window.open(targetUrl, '_blank', 'noopener,noreferrer');
    }
  }
}

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
// 10. LISTA DE BLOGS E NOTÍCIAS POLÍTICAS (MONETIZADO)
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
      renderHomeSponsoredBlogs();
    }
  } catch (err) {
    console.error('Erro ao carregar blogs:', err);
  }
}

function renderBlogsGrid() {
  const grid = document.getElementById('blogs-grid');
  if (!state.blogs || state.blogs.length === 0) {
    grid.innerHTML = `
      <div class="col-span-full text-center py-10 bg-white rounded-3xl border border-dashed border-slate-300 p-6">
        <p class="text-sm font-bold text-slate-700">Nenhum blog encontrado nesta categoria.</p>
      </div>
    `;
    return;
  }

  grid.innerHTML = state.blogs.map((blog) => {
    const isFav = state.favoriteBlogIds.has(blog.id) || state.favoriteBlogIds.has(blog.domain);
    return `
      <div class="bg-white rounded-3xl border ${blog.isSponsored ? 'border-amber-300 shadow-xs' : 'border-slate-200'} p-5 flex flex-col justify-between hover:shadow-md transition relative">
        <div class="flex items-center justify-between mb-2">
          ${blog.isSponsored ? `
            <span class="bg-amber-100 text-amber-900 border border-amber-300 text-[10px] font-extrabold px-2 py-0.5 rounded uppercase tracking-wider flex items-center gap-1">
              <i class="fa-solid fa-crown text-[10px]"></i> ${escapeHtml(blog.badgeText || 'Parceiro VIP')}
            </span>
          ` : `<span class="text-[10px] font-bold text-slate-400">Canal Cadastrado</span>`}

          <button onclick="toggleFavoriteBlog('${blog.id}', event)" class="text-xs ${isFav ? 'text-amber-500' : 'text-slate-300 hover:text-amber-500'} transition">
            <i class="${isFav ? 'fa-solid' : 'fa-regular'} fa-star"></i>
          </button>
        </div>

        <div>
          <h3 class="text-base font-extrabold text-slate-900 mt-1">${escapeHtml(blog.name)}</h3>
          <p class="text-xs text-slate-500 font-medium">${escapeHtml(blog.author)} &bull; ${escapeHtml(blog.domain)}</p>

          <p class="text-xs text-slate-600 mt-2.5 leading-relaxed line-clamp-3">
            ${escapeHtml(blog.description)}
          </p>

          <div class="mt-4 p-3 bg-slate-50 rounded-2xl space-y-1.5 text-[11px] border border-slate-100">
            <div class="flex justify-between">
              <span class="text-slate-500 font-medium">Audiência Estimada:</span>
              <span class="font-bold text-slate-800">${escapeHtml(blog.monthlyAudience || 'Auditando')}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-slate-500 font-medium">Modelo Comercial:</span>
              <span class="font-semibold text-slate-800">${escapeHtml(blog.monetizationModel || 'Banners')}</span>
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
  document.querySelectorAll('.blog-cat-btn').forEach(btn => {
    if ((!category && btn.textContent === 'Todas') || btn.textContent.includes(category)) {
      btn.className = 'blog-cat-btn active px-3 py-1 rounded-lg bg-slate-900 text-white font-bold';
    } else {
      btn.className = 'blog-cat-btn px-3 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold';
    }
  });
  loadBlogsList();
}

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
// 11. MONETIZAÇÃO, ADS & LEADS
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
      showToast('Solicitação enviada com sucesso!', 'success');
      closeModal('modal-advertiser');
      document.getElementById('form-advertiser').reset();
    } else {
      showToast(data.error || 'Erro ao enviar.', 'error');
    }
  } catch (err) {
    showToast('Falha ao enviar contato.', 'error');
  }
}

// ========================================================
// 12. MODAIS E UTILITÁRIOS
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
    showToast('Link da notícia copiado!', 'success');
  }).catch(() => {
    showToast('Não foi possível copiar o link.', 'info');
  });
}

function showToast(msg, type = 'info') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  
  const bgClass = type === 'success' ? 'bg-emerald-600 text-white' :
                  type === 'error' ? 'bg-rose-600 text-white' :
                  'bg-slate-900 text-white';

  const iconClass = type === 'success' ? 'fa-circle-check' :
                    type === 'error' ? 'fa-triangle-exclamation' :
                    'fa-circle-info';

  toast.className = `toast-msg flex items-center gap-2.5 px-4 py-3 rounded-2xl shadow-xl text-xs font-bold ${bgClass} pointer-events-auto transition-all`;
  toast.innerHTML = `<i class="fa-solid ${iconClass}"></i> <span>${escapeHtml(msg)}</span>`;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

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
