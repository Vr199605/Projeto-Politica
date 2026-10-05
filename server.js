const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const Parser = require('rss-parser');

const app = express();
const PORT = process.env.PORT || 3000;
const DB_PATH = path.join(__dirname, 'data', 'database.json');

const rssParser = new Parser({
  timeout: 6000,
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Database helper functions
function readDb() {
  try {
    const raw = fs.readFileSync(DB_PATH, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    console.error('Erro ao ler banco de dados:', err);
    return { politicians: [], sites: [], blogs: [], articles: [], monetization: {} };
  }
}

function writeDb(data) {
  try {
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf-8');
    return true;
  } catch (err) {
    console.error('Erro ao salvar banco de dados:', err);
    return false;
  }
}

// Helper: normaliza strings para busca sem acentos
function normalizeStr(str) {
  if (!str) return '';
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

// Helper: extrair nome da fonte a partir de título padrão do Google News (ex: "Título - G1")
function extractSourceFromTitle(title) {
  if (!title) return 'Notícia Política';
  const parts = title.split(' - ');
  if (parts.length > 1) {
    return parts[parts.length - 1].trim();
  }
  return 'Portal de Notícias';
}

function cleanTitle(title) {
  if (!title) return '';
  const parts = title.split(' - ');
  if (parts.length > 1) {
    parts.pop();
    return parts.join(' - ').trim();
  }
  return title.trim();
}

// Helper: encontrar ou registrar site no banco
function findOrCreateSite(db, sourceName, fallbackUrl) {
  const normSource = normalizeStr(sourceName);
  let site = db.sites.find(s => normalizeStr(s.name) === normSource || normSource.includes(normalizeStr(s.name)));
  
  if (!site) {
    const slug = normSource.replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-');
    site = {
      id: slug || `site-${Date.now()}`,
      name: sourceName,
      domain: fallbackUrl ? (fallbackUrl.replace(/https?:\/\//, '').split('/')[0]) : 'noticias.com.br',
      url: fallbackUrl || '#',
      category: 'Portal de Notícias',
      clicks: 1,
      badge: 'Novo Portal',
      verified: false,
      isMonetizedPartner: false,
      logo: '📰'
    };
    db.sites.push(site);
  }
  return site;
}

// -------------------------------------------------------------
// ROTAS DE API
// -------------------------------------------------------------

// 1. BUSCA DE NOTÍCIAS POLÍTICAS (Palavras-chave: Político, Assunto, Raio da notícia)
app.get('/api/search', async (req, res) => {
  try {
    const { politico = '', assunto = '', dataInicio = '', dataFim = '', source = '' } = req.query;
    const db = readDb();

    // Se um político foi pesquisado, incrementa contagem nas estatísticas
    if (politico && politico.trim().length > 1) {
      const normPolitico = normalizeStr(politico);
      let pol = db.politicians.find(p => 
        normalizeStr(p.name).includes(normPolitico) || 
        normalizeStr(p.popularName).includes(normPolitico)
      );

      if (pol) {
        pol.searchCount = (pol.searchCount || 0) + 1;
      } else {
        // Registra novo político se não existir
        const newId = normPolitico.replace(/[^a-z0-9]/g, '-');
        pol = {
          id: newId || `pol-${Date.now()}`,
          name: politico.trim(),
          popularName: politico.trim(),
          party: 'Independente',
          office: 'Figura Pública / Político',
          avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=160&q=80',
          searchCount: 1,
          trend: '+100%',
          trendDirection: 'up',
          bio: 'Político pesquisado pelos usuários da plataforma.'
        };
        db.politicians.push(pol);
      }
      writeDb(db);
    }

    // Filtrar matérias locais da base
    let results = [...db.articles];

    // Filtro por político
    if (politico && politico.trim()) {
      const pNorm = normalizeStr(politico);
      results = results.filter(a => 
        normalizeStr(a.politician).includes(pNorm) || 
        normalizeStr(a.title).includes(pNorm) || 
        normalizeStr(a.snippet).includes(pNorm)
      );
    }

    // Filtro por assunto
    if (assunto && assunto.trim()) {
      const aNorm = normalizeStr(assunto);
      results = results.filter(a => 
        normalizeStr(a.subject).includes(aNorm) || 
        normalizeStr(a.title).includes(aNorm) || 
        normalizeStr(a.snippet).includes(aNorm)
      );
    }

    // Filtro por data (Raio da Notícia: Data Início e Data Fim)
    if (dataInicio) {
      const start = new Date(dataInicio).getTime();
      results = results.filter(a => new Date(a.publishedDate).getTime() >= start);
    }
    if (dataFim) {
      // Ajusta dataFim para o final do dia
      const end = new Date(dataFim + 'T23:59:59.999Z').getTime();
      results = results.filter(a => new Date(a.publishedDate).getTime() <= end);
    }

    // Filtro opcional por veículo/fonte
    if (source && source.trim()) {
      const sNorm = normalizeStr(source);
      results = results.filter(a => normalizeStr(a.source).includes(sNorm));
    }

    // Busca ao vivo via Google News RSS (Brasil)
    let liveResults = [];
    const queryParts = [];
    if (politico && politico.trim()) queryParts.push(`"${politico.trim()}"`);
    if (assunto && assunto.trim()) queryParts.push(assunto.trim());
    if (queryParts.length === 0) queryParts.push('política brasil');

    const feedUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(queryParts.join(' '))}&hl=pt-BR&gl=BR&ceid=BR:pt-419`;

    try {
      const feed = await rssParser.parseURL(feedUrl);
      if (feed && feed.items && feed.items.length > 0) {
        liveResults = feed.items.slice(0, 25).map((item, idx) => {
          const itemSource = extractSourceFromTitle(item.title);
          const rawTitle = cleanTitle(item.title);
          const pubDate = item.pubDate ? new Date(item.pubDate).toISOString() : new Date().toISOString();

          // Identificar site no banco para possibilitar rastreio
          const site = findOrCreateSite(db, itemSource, item.link);

          return {
            id: `live-${idx}-${Date.now()}`,
            title: rawTitle,
            snippet: item.contentSnippet || item.content || 'Acesse a matéria completa para ler os detalhes da cobertura jornalística.',
            source: itemSource,
            siteId: site.id,
            url: item.link,
            politician: politico.trim() || 'Política Geral',
            subject: assunto.trim() || 'Noticiário Político',
            publishedDate: pubDate,
            isSponsored: false,
            isLive: true
          };
        });

        // Filtrar notícias ao vivo pelo raio da data se especificado
        if (dataInicio) {
          const start = new Date(dataInicio).getTime();
          liveResults = liveResults.filter(a => new Date(a.publishedDate).getTime() >= start);
        }
        if (dataFim) {
          const end = new Date(dataFim + 'T23:59:59.999Z').getTime();
          liveResults = liveResults.filter(a => new Date(a.publishedDate).getTime() <= end);
        }
      }
    } catch (rssError) {
      console.warn('Aviso: Consulta ao feed RSS externo indisponível ou limitada. Usando banco interno:', rssError.message);
    }

    // Combina matérias locais + ao vivo, removendo títulos duplicados
    const combined = [...results];
    const seenTitles = new Set(results.map(r => normalizeStr(r.title)));

    for (const item of liveResults) {
      const normTitle = normalizeStr(item.title);
      if (!seenTitles.has(normTitle)) {
        seenTitles.add(normTitle);
        combined.push(item);
      }
    }

    // Ordenar do mais recente para o mais antigo
    combined.sort((a, b) => new Date(b.publishedDate).getTime() - new Date(a.publishedDate).getTime());

    // Seção monetizada nativa: injetar um card patrocinado se houver resultados
    const sponsoredArticle = db.articles.find(a => a.isSponsored);

    res.json({
      success: true,
      query: { politico, assunto, dataInicio, dataFim, source },
      total: combined.length,
      sponsoredSlot: sponsoredArticle || null,
      results: combined
    });
  } catch (err) {
    console.error('Erro na rota de busca:', err);
    res.status(500).json({ success: false, error: 'Falha ao processar busca.' });
  }
});

// 2. TOP 10 POLÍTICOS MAIS BUSCADOS
app.get('/api/rankings/politicians', (req, res) => {
  try {
    const db = readDb();
    // Ordena por searchCount decrescente e pega os 10 primeiros
    const top10 = [...db.politicians]
      .sort((a, b) => (b.searchCount || 0) - (a.searchCount || 0))
      .slice(0, 10)
      .map((pol, index) => ({
        ...pol,
        rank: index + 1
      }));

    const totalSearches = db.politicians.reduce((acc, p) => acc + (p.searchCount || 0), 0);

    res.json({
      success: true,
      totalSearches,
      top10
    });
  } catch (err) {
    console.error('Erro ao obter ranking de políticos:', err);
    res.status(500).json({ success: false, error: 'Falha ao carregar ranking.' });
  }
});

// Incrementar busca de um político
app.post('/api/rankings/politicians/increment', (req, res) => {
  try {
    const { id } = req.body;
    if (!id) return res.status(400).json({ success: false, error: 'ID do político é obrigatório.' });

    const db = readDb();
    const pol = db.politicians.find(p => p.id === id);
    if (!pol) return res.status(404).json({ success: false, error: 'Político não encontrado.' });

    pol.searchCount = (pol.searchCount || 0) + 1;
    writeDb(db);

    res.json({ success: true, politician: pol });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Erro ao incrementar busca.' });
  }
});

// 3. TOP 10 SITES MAIS ACESSADOS NO APLICATIVO
app.get('/api/rankings/sites', (req, res) => {
  try {
    const db = readDb();
    const top10 = [...db.sites]
      .sort((a, b) => (b.clicks || 0) - (a.clicks || 0))
      .slice(0, 10)
      .map((site, index) => ({
        ...site,
        rank: index + 1
      }));

    const totalClicks = db.sites.reduce((acc, s) => acc + (s.clicks || 0), 0);

    res.json({
      success: true,
      totalClicks,
      top10
    });
  } catch (err) {
    console.error('Erro ao obter ranking de sites:', err);
    res.status(500).json({ success: false, error: 'Falha ao carregar ranking.' });
  }
});

// Rastreamento de cliques externos (Atualiza ranking em tempo real)
app.get('/api/sites/click', (req, res) => {
  try {
    const { siteId, targetUrl, siteName } = req.query;
    const db = readDb();

    let site = null;
    if (siteId) {
      site = db.sites.find(s => s.id === siteId);
    }
    if (!site && siteName) {
      site = findOrCreateSite(db, siteName, targetUrl);
    }

    if (site) {
      site.clicks = (site.clicks || 0) + 1;
      writeDb(db);
    }

    if (targetUrl) {
      return res.redirect(targetUrl);
    }
    return res.json({ success: true, clicks: site ? site.clicks : 0 });
  } catch (err) {
    console.error('Erro ao registrar clique de site:', err);
    if (req.query.targetUrl) {
      return res.redirect(req.query.targetUrl);
    }
    res.status(500).json({ success: false, error: 'Erro ao registrar clique.' });
  }
});

app.post('/api/sites/click', (req, res) => {
  try {
    const { siteId, siteName, targetUrl } = req.body;
    const db = readDb();

    let site = null;
    if (siteId) {
      site = db.sites.find(s => s.id === siteId);
    }
    if (!site && siteName) {
      site = findOrCreateSite(db, siteName, targetUrl);
    }

    if (site) {
      site.clicks = (site.clicks || 0) + 1;
      writeDb(db);
      return res.json({ success: true, site });
    }

    res.status(404).json({ success: false, error: 'Site não encontrado.' });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Erro ao processar clique.' });
  }
});

// 4. LISTA DE BLOGS E NOTÍCIAS POLÍTICAS (MONETIZADO)
app.get('/api/blogs', (req, res) => {
  try {
    const { category, sponsoredOnly } = req.query;
    const db = readDb();
    let list = [...db.blogs];

    if (category) {
      const cNorm = normalizeStr(category);
      list = list.filter(b => normalizeStr(b.category).includes(cNorm));
    }

    if (sponsoredOnly === 'true') {
      list = list.filter(b => b.isSponsored);
    }

    // Ordena: Patrocinados / VIP primeiro, depois por cliques
    list.sort((a, b) => {
      if (a.isSponsored && !b.isSponsored) return -1;
      if (!a.isSponsored && b.isSponsored) return 1;
      return (b.clicks || 0) - (a.clicks || 0);
    });

    res.json({
      success: true,
      total: list.length,
      blogs: list
    });
  } catch (err) {
    console.error('Erro ao buscar blogs:', err);
    res.status(500).json({ success: false, error: 'Falha ao obter lista de blogs.' });
  }
});

// Cadastro de novo blog para monetização ou listagem
app.post('/api/blogs', (req, res) => {
  try {
    const { name, author, domain, url, category, description, monetizationModel, tier = 'Criador Independente', isSponsored = false } = req.body;

    if (!name || !url) {
      return res.status(400).json({ success: false, error: 'Nome e URL são obrigatórios.' });
    }

    const db = readDb();
    const newBlog = {
      id: `blog-${Date.now()}`,
      name: name.trim(),
      author: author ? author.trim() : 'Editoria Independente',
      domain: domain ? domain.trim() : url.replace(/https?:\/\//, '').split('/')[0],
      url: url.trim(),
      category: category ? category.trim() : 'Geral & Opinião',
      description: description ? description.trim() : 'Novo portal de análise política cadastrado no Radar.',
      tier,
      isSponsored: Boolean(isSponsored),
      monthlyAudience: 'Em avaliação',
      monetizationModel: monetizationModel || 'Banners e Links Patrocinados',
      adSpotPrice: isSponsored ? 'R$ 290,00 / semana' : 'Gratuito',
      clicks: 1,
      rating: 5.0,
      badgeText: isSponsored ? '⭐ Parceiro Patrocinado' : '✅ Novo Cadastro'
    };

    db.blogs.unshift(newBlog);
    findOrCreateSite(db, newBlog.name, newBlog.url);
    writeDb(db);

    res.status(201).json({ success: true, message: 'Blog cadastrado com sucesso!', blog: newBlog });
  } catch (err) {
    console.error('Erro ao cadastrar blog:', err);
    res.status(500).json({ success: false, error: 'Erro ao cadastrar blog.' });
  }
});

// 5. PAINEL DE MONETIZAÇÃO & ANÚNCIOS
app.get('/api/monetization/stats', (req, res) => {
  try {
    const db = readDb();
    res.json({
      success: true,
      monetization: db.monetization || {}
    });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Erro ao buscar métricas de monetização.' });
  }
});

// Registro de impressão ou clique de anúncio
app.post('/api/monetization/log', (req, res) => {
  try {
    const { type, adId } = req.body; // type: 'impression' | 'click'
    const db = readDb();

    if (!db.monetization) db.monetization = {};

    if (type === 'impression') {
      db.monetization.totalImpressions = (db.monetization.totalImpressions || 0) + 1;
    } else if (type === 'click') {
      db.monetization.totalClicks = (db.monetization.totalClicks || 0) + 1;
      db.monetization.estimatedRevenueBRL = (db.monetization.estimatedRevenueBRL || 0) + 1.25; // Simulação CPC R$ 1,25
    }

    // Recalcular CTR
    if (db.monetization.totalImpressions > 0) {
      const ctrVal = ((db.monetization.totalClicks / db.monetization.totalImpressions) * 100).toFixed(2);
      db.monetization.ctr = `${ctrVal}%`;
    }

    writeDb(db);
    res.json({ success: true, metrics: db.monetization });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Erro ao registrar evento de anúncio.' });
  }
});

// Pedido de anúncio / Parceria comercial
app.post('/api/monetization/advertiser-request', (req, res) => {
  try {
    const { name, email, company, plan, notes } = req.body;
    if (!name || !email) {
      return res.status(400).json({ success: false, error: 'Nome e e-mail são obrigatórios.' });
    }

    const db = readDb();
    if (!db.monetization.partnerRequests) db.monetization.partnerRequests = [];

    const request = {
      id: `lead-${Date.now()}`,
      name,
      email,
      company: company || 'Não informado',
      plan: plan || 'Espaço de Anúncio Padrão',
      notes: notes || '',
      date: new Date().toISOString()
    };

    db.monetization.partnerRequests.push(request);
    writeDb(db);

    res.status(201).json({
      success: true,
      message: 'Solicitação de anúncio recebida com sucesso! Nossa equipe comercial entrará em contato.',
      request
    });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Erro ao registrar contato comercial.' });
  }
});

// Rota fallback para SPA
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Inicialização
app.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(`🚀 RADAR POLÍTICO MVP - Servidor online!`);
  console.log(`📍 URL: http://localhost:${PORT}`);
  console.log(`⏰ Iniciado em: ${new Date().toLocaleString('pt-BR')}`);
  console.log(`=======================================================`);
});
