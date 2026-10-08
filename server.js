const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const Parser = require('rss-parser');

const app = express();
const PORT = process.env.PORT || 3000;
const DB_PATH = path.join(__dirname, 'data', 'database.json');

const rssParser = new Parser({
  timeout: 8000,
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  },
  customFields: {
    item: [
      ['media:content', 'mediaContent'],
      ['enclosure', 'enclosure'],
      ['content:encoded', 'contentEncoded']
    ]
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
    return { politicians: [], sites: [], blogs: [], articles: [], monetization: {}, verifiedBroadcasts: [] };
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

// Helper: extrair imagem real e autêntica de capas jornalísticas do item RSS
function extractEditorialImage(item) {
  if (!item) return null;
  if (item.mediaContent && item.mediaContent['$'] && item.mediaContent['$'].url) {
    return item.mediaContent['$'].url;
  }
  if (item.mediaContent && item.mediaContent.url) {
    return item.mediaContent.url;
  }
  if (item.enclosure && item.enclosure.url) {
    return item.enclosure.url;
  }
  const rawHtml = (item.content || item.contentEncoded || item.description || '');
  const m = rawHtml.match(/<img[^>]+src=["']([^"']+)["']/i);
  if (m && m[1]) return m[1];
  return null;
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

function getLogoForSource(sourceName) {
  const norm = normalizeStr(sourceName);
  if (norm.includes('g1')) return '/assets/logos/g1.svg';
  if (norm.includes('folha')) return '/assets/logos/folha.svg';
  if (norm.includes('metropoles')) return '/assets/logos/metropoles.svg';
  if (norm.includes('poder360')) return '/assets/logos/poder360.svg';
  if (norm.includes('congresso')) return '/assets/logos/congresso.svg';
  if (norm.includes('cnn')) return '/assets/logos/cnn.svg';
  if (norm.includes('antagonista')) return '/assets/logos/antagonista.svg';
  if (norm.includes('estadao')) return '/assets/logos/estadao.svg';
  if (norm.includes('carta')) return '/assets/logos/cartacapital.svg';
  if (norm.includes('jovem')) return '/assets/logos/jovempan.svg';
  if (norm.includes('gazeta')) return '/assets/logos/gazetadopovo.svg';
  if (norm.includes('conjur')) return '/assets/logos/conjur.svg';
  if (norm.includes('brasil 247') || norm.includes('brasil247')) return '/assets/logos/brasil247.svg';
  if (norm.includes('uol')) return '/assets/logos/uol.svg';
  if (norm.includes('agencia brasil') || norm.includes('ebc')) return '/assets/logos/agenciabrasil.svg';
  return '/assets/logos/g1.svg';
}

function resolveArticleDetails(db, title, snippet, queryPolitico, queryAssunto, editorialImage = null) {
  const normTitle = normalizeStr(title || '');
  const normSnippet = normalizeStr(snippet || '');
  const normTerm = normalizeStr(queryPolitico || '');

  // 1. Procurar políticos conhecidos no TÍTULO da matéria
  const allPoliticians = [...(db.politicians || [])].sort((a, b) => (b.popularName.length) - (a.popularName.length));
  
  const foundInTitle = [];
  for (const pol of allPoliticians) {
    const normPop = normalizeStr(pol.popularName);
    const normFull = normalizeStr(pol.name);
    if (normTitle.includes(normPop) || (normFull && normTitle.includes(normFull))) {
      foundInTitle.push(pol);
    }
  }

  let matchedPolitician = null;
  if (foundInTitle.length > 0) {
    if (normTerm) {
      matchedPolitician = foundInTitle.find(p => 
        normalizeStr(p.popularName).includes(normTerm) || normTerm.includes(normalizeStr(p.popularName))
      ) || foundInTitle[0];
    } else {
      matchedPolitician = foundInTitle[0];
    }
  }

  // 2. Se não encontrou no título, procurar no SNIPPET
  if (!matchedPolitician) {
    const foundInSnippet = [];
    for (const pol of allPoliticians) {
      const normPop = normalizeStr(pol.popularName);
      const normFull = normalizeStr(pol.name);
      if (normSnippet.includes(normPop) || (normFull && normSnippet.includes(normFull))) {
        foundInSnippet.push(pol);
      }
    }
    if (foundInSnippet.length > 0) {
      if (normTerm) {
        matchedPolitician = foundInSnippet.find(p => 
          normalizeStr(p.popularName).includes(normTerm) || normTerm.includes(normalizeStr(p.popularName))
        ) || foundInSnippet[0];
      } else {
        matchedPolitician = foundInSnippet[0];
      }
    }
  }

  // 3. Se ainda não casou na notícia mas o usuário pesquisou diretamente por um político cadastrado
  if (!matchedPolitician && normTerm) {
    const queriedPol = allPoliticians.find(p => 
      normalizeStr(p.popularName).includes(normTerm) || normTerm.includes(normalizeStr(p.popularName))
    );
    if (queriedPol) {
      matchedPolitician = queriedPol;
    }
  }

  // 4. Detecção precisa de Tema / Assunto Institucional
  const fullContent = normTitle + ' ' + normSnippet;
  let detectedSubject = queryAssunto ? queryAssunto.trim() : 'Política Nacional';
  let institutionalImage = null;

  if (fullContent.includes('policia federal') || fullContent.includes('operacao da pf') || fullContent.includes('mandado de busca') || fullContent.includes('agentes federais') || fullContent.includes('inquerito da pf')) {
    detectedSubject = 'Polícia Federal & Segurança';
    institutionalImage = '/assets/themes/policia-federal.jpg';
  } else if (fullContent.includes('banco central') || fullContent.includes('copom') || fullContent.includes('taxa selic') || fullContent.includes('campos neto') || fullContent.includes('galipolo') || fullContent.includes('politica monetaria')) {
    detectedSubject = 'Banco Central & Juros';
    institutionalImage = '/assets/themes/banco-central.jpg';
  } else if (fullContent.includes('petrobras') || fullContent.includes('combustivel') || fullContent.includes('gasolina') || fullContent.includes('diesel') || fullContent.includes('petroleo') || fullContent.includes('bacia de santos')) {
    detectedSubject = 'Petrobras & Energia';
    institutionalImage = '/assets/themes/petrobras.jpg';
  } else if (fullContent.includes('stf') || fullContent.includes('supremo tribunal') || fullContent.includes('suprema corte') || fullContent.includes('judiciario') || fullContent.includes('cnj') || fullContent.includes('pgr') || fullContent.includes('primeira turma') || fullContent.includes('segunda turma')) {
    detectedSubject = 'STF & Judiciário';
    institutionalImage = '/assets/themes/stf.jpg';
  } else if (fullContent.includes('senado') || fullContent.includes('senadores') || fullContent.includes('congresso nacional') || fullContent.includes('parlamento')) {
    detectedSubject = 'Congresso & Senado';
    institutionalImage = '/assets/themes/congresso.jpg';
  } else if (fullContent.includes('camara dos deputados') || fullContent.includes('camara') || fullContent.includes('deputados') || fullContent.includes('plenario') || fullContent.includes('bancada')) {
    detectedSubject = 'Câmara dos Deputados';
    institutionalImage = '/assets/themes/camara.jpg';
  } else if (fullContent.includes('planalto') || fullContent.includes('palacio do planalto') || fullContent.includes('presidencia da republica') || fullContent.includes('governo federal') || fullContent.includes('decreto presidencial') || fullContent.includes('ministerio')) {
    detectedSubject = 'Poder Executivo & Planalto';
    institutionalImage = '/assets/themes/planalto.jpg';
  } else if (fullContent.includes('fazenda') || fullContent.includes('economia') || fullContent.includes('tributaria') || fullContent.includes('inflacao') || fullContent.includes('dolar') || fullContent.includes('imposto') || fullContent.includes('orcamento') || fullContent.includes('arrecadacao') || fullContent.includes('ipca')) {
    detectedSubject = 'Economia & Fazenda';
    institutionalImage = '/assets/themes/fazenda.jpg';
  } else if (fullContent.includes('eleicao') || fullContent.includes('eleicoes') || fullContent.includes('urna') || fullContent.includes('tse') || fullContent.includes('voto') || fullContent.includes('pesquisa eleitoral') || fullContent.includes('segundo turno') || fullContent.includes('primeiro turno')) {
    detectedSubject = 'Eleições & Pesquisas';
    institutionalImage = '/assets/themes/eleicoes.jpg';
  }

  // PRIORIDADE MÁXIMA DA IMAGEM:
  // Se a matéria veio com a foto real da reportagem (G1, Metrópoles, Gazeta do Povo), ela é sagrada e verídica!
  let finalImageUrl = editorialImage || '/assets/themes/brasilia.jpg';
  let finalPoliticianName = queryPolitico ? queryPolitico.trim() : 'Cenário Político';

  if (!editorialImage) {
    if (institutionalImage) {
      finalImageUrl = institutionalImage;
    } else if (matchedPolitician && matchedPolitician.avatar) {
      finalImageUrl = matchedPolitician.avatar;
    }
  }

  if (matchedPolitician) {
    finalPoliticianName = matchedPolitician.popularName;
  }

  return {
    imageUrl: finalImageUrl,
    politician: finalPoliticianName,
    subject: detectedSubject
  };
}

// Cache em memória para os feeds editoriais oficiais
let liveFeedCache = {
  articles: [],
  lastFetch: 0
};

async function getAggregatedEditorialArticles(db) {
  const now = Date.now();
  if (liveFeedCache.articles.length > 0 && (now - liveFeedCache.lastFetch) < 90000) {
    return liveFeedCache.articles;
  }

  const primaryFeeds = [
    { url: 'https://g1.globo.com/rss/g1/politica/', defaultSource: 'G1 Política' },
    { url: 'https://www.metropoles.com/brasil/politica-brasil/feed', defaultSource: 'Metrópoles' },
    { url: 'https://www.gazetadopovo.com.br/feed/rss/politica.xml', defaultSource: 'Gazeta do Povo' }
  ];

  const aggregated = [];
  const promises = primaryFeeds.map(async f => {
    try {
      const feed = await rssParser.parseURL(f.url);
      if (feed && feed.items) {
        return feed.items.map((item, idx) => {
          let itemSource = f.defaultSource;
          if (item.title && item.title.includes(' - ')) {
            itemSource = extractSourceFromTitle(item.title);
          }
          const rawTitle = cleanTitle(item.title);
          const rawDesc = item.content || item.contentEncoded || item.description || item.contentSnippet || '';
          const cleanedSnippet = (item.contentSnippet || rawDesc.replace(/<[^>]+>/g, ' ').slice(0, 240) + '...').trim();
          const pubDate = item.pubDate ? new Date(item.pubDate).toISOString() : new Date().toISOString();
          const editorialImage = extractEditorialImage(item);
          const sourceLogo = getLogoForSource(itemSource);
          const site = findOrCreateSite(db, itemSource, item.link);
          const resolved = resolveArticleDetails(db, rawTitle, cleanedSnippet, '', '', editorialImage);

          return {
            id: `editorial-${idx}-${normalizeStr(rawTitle).slice(0, 20)}`,
            title: rawTitle,
            snippet: cleanedSnippet,
            source: itemSource,
            sourceLogo: sourceLogo,
            imageUrl: editorialImage || resolved.imageUrl,
            siteId: site.id,
            url: item.link,
            politician: resolved.politician,
            subject: resolved.subject,
            publishedDate: pubDate,
            isSponsored: false,
            isLive: false
          };
        });
      }
    } catch (e) {
      console.warn(`Aviso: Feed ${f.url} indisponível:`, e.message);
      return [];
    }
  });

  const settled = await Promise.allSettled(promises);
  settled.forEach(s => {
    if (s.status === 'fulfilled' && Array.isArray(s.value)) {
      aggregated.push(...s.value);
    }
  });

  if (aggregated.length > 0) {
    liveFeedCache.articles = aggregated;
    liveFeedCache.lastFetch = now;
  }
  return liveFeedCache.articles;
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
        const newId = normPolitico.replace(/[^a-z0-9]/g, '-');
        pol = {
          id: newId || `pol-${Date.now()}`,
          name: politico.trim(),
          popularName: politico.trim(),
          party: 'Independente',
          office: 'Figura Pública / Político',
          avatar: '/assets/themes/brasilia.jpg',
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
      const end = new Date(dataFim + 'T23:59:59.999Z').getTime();
      results = results.filter(a => new Date(a.publishedDate).getTime() <= end);
    }

    // Filtro opcional por veículo/fonte
    if (source && source.trim()) {
      const sNorm = normalizeStr(source);
      results = results.filter(a => normalizeStr(a.source).includes(sNorm));
    }

    // Ingestão de feeds editoriais oficiais (G1 Política, Metrópoles, Gazeta do Povo)
    let liveResults = [];
    const editorialArticles = await getAggregatedEditorialArticles(db);

    let filteredEditorial = [...editorialArticles];
    if (politico && politico.trim()) {
      const pNorm = normalizeStr(politico);
      filteredEditorial = filteredEditorial.filter(a => 
        normalizeStr(a.politician).includes(pNorm) || 
        normalizeStr(a.title).includes(pNorm) || 
        normalizeStr(a.snippet).includes(pNorm)
      );
    }
    if (assunto && assunto.trim()) {
      const aNorm = normalizeStr(assunto);
      filteredEditorial = filteredEditorial.filter(a => 
        normalizeStr(a.subject).includes(aNorm) || 
        normalizeStr(a.title).includes(aNorm) || 
        normalizeStr(a.snippet).includes(aNorm)
      );
    }
    if (dataInicio) {
      const start = new Date(dataInicio).getTime();
      filteredEditorial = filteredEditorial.filter(a => new Date(a.publishedDate).getTime() >= start);
    }
    if (dataFim) {
      const end = new Date(dataFim + 'T23:59:59.999Z').getTime();
      filteredEditorial = filteredEditorial.filter(a => new Date(a.publishedDate).getTime() <= end);
    }
    if (source && source.trim()) {
      const sNorm = normalizeStr(source);
      filteredEditorial = filteredEditorial.filter(a => normalizeStr(a.source).includes(sNorm));
    }

    liveResults.push(...filteredEditorial);

    // Complemento via Google News RSS se necessário
    const needsComplement = (politico || assunto) && liveResults.length < 8;
    if (needsComplement || (!politico && !assunto && liveResults.length < 12)) {
      const queryParts = [];
      if (politico && politico.trim()) queryParts.push(`"${politico.trim()}"`);
      if (assunto && assunto.trim()) queryParts.push(assunto.trim());
      if (queryParts.length === 0) queryParts.push('política brasil');

      const feedUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(queryParts.join(' '))}&hl=pt-BR&gl=BR&ceid=BR:pt-419`;

      try {
        const feed = await rssParser.parseURL(feedUrl);
        if (feed && feed.items && feed.items.length > 0) {
          const googleItems = feed.items.slice(0, 20).map((item, idx) => {
            const itemSource = extractSourceFromTitle(item.title);
            const rawTitle = cleanTitle(item.title);
            const pubDate = item.pubDate ? new Date(item.pubDate).toISOString() : new Date().toISOString();

            const site = findOrCreateSite(db, itemSource, item.link);
            const sourceLogo = getLogoForSource(itemSource);
            const rawSnippet = item.contentSnippet || item.content || 'Acesse a matéria completa para ler os detalhes da cobertura jornalística.';

            const normT = normalizeStr(rawTitle);
            const matchingEd = editorialArticles.find(e => 
              normalizeStr(e.title).includes(normT.slice(0, 25)) || 
              normT.includes(normalizeStr(e.title).slice(0, 25))
            );
            const editorialPhoto = matchingEd ? matchingEd.imageUrl : extractEditorialImage(item);
            const resolved = resolveArticleDetails(db, rawTitle, rawSnippet, politico, assunto, editorialPhoto);

            return {
              id: `live-${idx}-${Date.now()}`,
              title: rawTitle,
              snippet: rawSnippet,
              source: itemSource,
              sourceLogo: sourceLogo,
              imageUrl: resolved.imageUrl,
              siteId: site.id,
              url: item.link,
              politician: resolved.politician,
              subject: resolved.subject,
              publishedDate: pubDate,
              isSponsored: false,
              isLive: true
            };
          });

          for (const gItem of googleItems) {
            if (dataInicio && new Date(gItem.publishedDate).getTime() < new Date(dataInicio).getTime()) continue;
            if (dataFim && new Date(gItem.publishedDate).getTime() > new Date(dataFim + 'T23:59:59.999Z').getTime()) continue;
            if (source && !normalizeStr(gItem.source).includes(normalizeStr(source))) continue;
            liveResults.push(gItem);
          }
        }
      } catch (rssError) {
        console.warn('Aviso: Consulta ao feed RSS externo indisponível:', rssError.message);
      }
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

// 5.1 SISTEMA DE DOAÇÃO / TOP 10 DONATE
app.get('/api/donations', (req, res) => {
  try {
    const db = readDb();
    const donations = db.donations || {
      goal: 10000,
      currentTotal: 0,
      currency: 'BRL',
      pixKey: 'pix@radarpolitico.com.br',
      topDonators: []
    };
    // Ordenar doadores pelo valor decrescente
    donations.topDonators = [...(donations.topDonators || [])]
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 10)
      .map((d, idx) => ({ ...d, rank: idx + 1 }));

    res.json({
      success: true,
      donations
    });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Erro ao carregar dados de doação.' });
  }
});

app.post('/api/donations', (req, res) => {
  try {
    const { name, email, amount, message } = req.body;
    const numAmount = parseFloat(amount);
    if (!name || isNaN(numAmount) || numAmount <= 0) {
      return res.status(400).json({ success: false, error: 'Nome e valor válido são obrigatórios.' });
    }

    const db = readDb();
    if (!db.donations) {
      db.donations = {
        goal: 10000,
        currentTotal: 0,
        currency: 'BRL',
        pixKey: 'pix@radarpolitico.com.br',
        topDonators: []
      };
    }

    let badge = 'Apoiador Cidadão';
    if (numAmount >= 1000) badge = 'Patrocinador Diamante';
    else if (numAmount >= 500) badge = 'Patrocinador Ouro';
    else if (numAmount >= 250) badge = 'Apoiador Prata';
    else if (numAmount >= 100) badge = 'Apoiador Bronze';

    const newDonation = {
      id: `don-${Date.now()}`,
      name: name.trim(),
      email: email ? email.trim() : '',
      amount: numAmount,
      date: new Date().toISOString().split('T')[0],
      badge,
      message: message ? message.trim() : 'Apoiador da transparência pública.'
    };

    db.donations.topDonators.push(newDonation);
    db.donations.topDonators.sort((a, b) => b.amount - a.amount);
    db.donations.topDonators = db.donations.topDonators.slice(0, 10);
    db.donations.currentTotal = (db.donations.currentTotal || 0) + numAmount;

    writeDb(db);

    const pixPayload = `00020126360014BR.GOV.BCB.PIX0114+5511999999999520400005303986540${numAmount.toFixed(2)}5802BR5920RADAR POLITICO PRO6009SAO PAULO62070503***6304`;

    res.status(201).json({
      success: true,
      message: 'Doação registrada com sucesso!',
      donation: newDonation,
      currentTotal: db.donations.currentTotal,
      pixKey: db.donations.pixKey,
      pixCode: pixPayload,
      topDonators: db.donations.topDonators
    });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Erro ao processar doação.' });
  }
});

// 6. AUTENTICAÇÃO E CADASTRO DE USUÁRIO
app.post('/api/auth/register', (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ success: false, error: 'Nome, e-mail e senha são obrigatórios.' });
    }

    const db = readDb();
    if (!db.users) db.users = [];

    const normEmail = email.trim().toLowerCase();
    const existing = db.users.find(u => u.email && u.email.toLowerCase() === normEmail);
    if (existing) {
      return res.status(400).json({ success: false, error: 'Este e-mail já está cadastrado.' });
    }

    const newUser = {
      id: `usr-${Date.now()}`,
      name: name.trim(),
      email: normEmail,
      password: password,
      avatar: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name.trim())}&backgroundColor=2563eb&textColor=ffffff`,
      favoritePoliticians: [],
      favoriteBlogs: [],
      createdAt: new Date().toISOString()
    };

    db.users.push(newUser);
    writeDb(db);

    const { password: _, ...userWithoutPass } = newUser;
    res.status(201).json({ success: true, user: userWithoutPass });
  } catch (err) {
    console.error('Erro no cadastro:', err);
    res.status(500).json({ success: false, error: 'Erro ao cadastrar usuário.' });
  }
});

app.post('/api/auth/login', (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'E-mail e senha são obrigatórios.' });
    }

    const db = readDb();
    if (!db.users) db.users = [];

    const normEmail = email.trim().toLowerCase();
    const user = db.users.find(u => u.email && u.email.toLowerCase() === normEmail && u.password === password);
    if (!user) {
      return res.status(401).json({ success: false, error: 'E-mail ou senha incorretos.' });
    }

    const { password: _, ...userWithoutPass } = user;
    res.json({ success: true, user: userWithoutPass });
  } catch (err) {
    console.error('Erro no login:', err);
    res.status(500).json({ success: false, error: 'Erro ao realizar login.' });
  }
});

// 7. GERENCIAMENTO DE FAVORITOS (POLÍTICOS E BLOGS)
app.get('/api/users/:userId/favorites', (req, res) => {
  try {
    const { userId } = req.params;
    const db = readDb();
    if (!db.users) db.users = [];

    const user = db.users.find(u => u.id === userId);
    if (!user) {
      return res.status(404).json({ success: false, error: 'Usuário não encontrado.' });
    }

    const favPoliticianIds = new Set(user.favoritePoliticians || []);
    const favBlogIds = new Set(user.favoriteBlogs || []);

    const favoritePoliticians = (db.politicians || []).filter(p => favPoliticianIds.has(p.id));
    const favoriteBlogs = (db.blogs || []).filter(b => favBlogIds.has(b.id) || favBlogIds.has(b.domain));

    res.json({
      success: true,
      favoritePoliticians,
      favoriteBlogs,
      rawPoliticianIds: Array.from(favPoliticianIds),
      rawBlogIds: Array.from(favBlogIds)
    });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Erro ao carregar favoritos.' });
  }
});

app.post('/api/users/favorites/politician', (req, res) => {
  try {
    const { userId, politicianId } = req.body;
    if (!userId || !politicianId) {
      return res.status(400).json({ success: false, error: 'userId e politicianId são obrigatórios.' });
    }

    const db = readDb();
    if (!db.users) db.users = [];

    const user = db.users.find(u => u.id === userId);
    if (!user) return res.status(404).json({ success: false, error: 'Usuário não encontrado.' });

    if (!user.favoritePoliticians) user.favoritePoliticians = [];

    let isFavorited = false;
    const idx = user.favoritePoliticians.indexOf(politicianId);
    if (idx > -1) {
      user.favoritePoliticians.splice(idx, 1);
      isFavorited = false;
    } else {
      user.favoritePoliticians.push(politicianId);
      isFavorited = true;
    }

    writeDb(db);
    res.json({ success: true, isFavorited, favorites: user.favoritePoliticians });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Erro ao atualizar político favorito.' });
  }
});

app.post('/api/users/favorites/blog', (req, res) => {
  try {
    const { userId, blogId } = req.body;
    if (!userId || !blogId) {
      return res.status(400).json({ success: false, error: 'userId e blogId são obrigatórios.' });
    }

    const db = readDb();
    if (!db.users) db.users = [];

    const user = db.users.find(u => u.id === userId);
    if (!user) return res.status(404).json({ success: false, error: 'Usuário não encontrado.' });

    if (!user.favoriteBlogs) user.favoriteBlogs = [];

    let isFavorited = false;
    const idx = user.favoriteBlogs.indexOf(blogId);
    if (idx > -1) {
      user.favoriteBlogs.splice(idx, 1);
      isFavorited = false;
    } else {
      user.favoriteBlogs.push(blogId);
      isFavorited = true;
    }

    writeDb(db);
    res.json({ success: true, isFavorited, favorites: user.favoriteBlogs });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Erro ao atualizar blog favorito.' });
  }
});

// 8. RADAR SOCIAL: TRANSMISSÕES AO VIVO VERIFICADAS EM TEMPO REAL
app.get('/api/politicians/social-status', (req, res) => {
  try {
    const db = readDb();
    const verifiedStreams = db.verifiedBroadcasts || [];

    // Filtra exclusivamente políticos que estejam EFETIVAMENTE transmitindo ao vivo
    // "se não tiver não aparecer, não precisa aparecer politicos offline"
    const livePoliticians = (db.politicians || [])
      .filter(p => p.socialStatus && p.socialStatus.isLive)
      .map(p => ({
        id: p.id,
        name: p.name,
        popularName: p.popularName,
        party: p.party,
        office: p.office,
        avatar: p.avatar,
        socialStatus: p.socialStatus
      }));

    const totalLive = verifiedStreams.length + livePoliticians.length;

    res.json({
      success: true,
      totalLive,
      verifiedStreams,
      politicians: livePoliticians
    });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Erro ao buscar status social.' });
  }
});

app.post('/api/politicians/:id/social-status', (req, res) => {
  try {
    const { id } = req.params;
    const { isLive, livePlatform, liveTitle, liveUrl } = req.body;
    const db = readDb();

    const pol = db.politicians.find(p => p.id === id);
    if (!pol) return res.status(404).json({ success: false, error: 'Político não encontrado.' });

    if (!pol.socialStatus) pol.socialStatus = {};
    if (typeof isLive === 'boolean') pol.socialStatus.isLive = isLive;
    if (livePlatform) pol.socialStatus.livePlatform = livePlatform;
    if (liveTitle) pol.socialStatus.liveTitle = liveTitle;
    if (liveUrl) pol.socialStatus.liveUrl = liveUrl;
    pol.socialStatus.status = pol.socialStatus.isLive ? 'live' : 'online';
    pol.socialStatus.statusLabel = pol.socialStatus.isLive ? `AO VIVO NO ${pol.socialStatus.livePlatform || 'YOUTUBE'}` : 'ONLINE';
    pol.socialStatus.lastActivity = 'Atualizado agora';

    writeDb(db);
    res.json({ success: true, politician: pol });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Erro ao atualizar status social.' });
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
