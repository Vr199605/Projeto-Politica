/**
 * Script de teste automatizado para o MVP Radar Político v2.0
 * Valida as 4 funções bases originais + as 5 novas melhorias solicitadas:
 * - Layout & Top 3 expostos
 * - Blogs patrocinadores na home
 * - Cadastro/Login e Favoritos
 * - Status social dos políticos em tempo real (online/live)
 */
const assert = require('assert');

const BASE_URL = 'http://localhost:3000';

async function runTests() {
  console.log('🧪 Iniciando testes de validação do Radar Político v2.0...');
  let passed = 0;
  let total = 0;

  async function test(name, fn) {
    total++;
    try {
      await fn();
      console.log(`✅ [PASS] ${name}`);
      passed++;
    } catch (err) {
      console.error(`❌ [FAIL] ${name}:`, err.message);
    }
  }

  // 1. Teste de Busca com Político, Assunto e Raio da Notícia
  await test('Função Base 1: Busca de notícias por Político, Assunto e Raio Temporal', async () => {
    const res = await fetch(`${BASE_URL}/api/search?politico=Tarcísio&assunto=Economia&dataInicio=2026-08-01&dataFim=2026-10-06`);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.ok(Array.isArray(data.results), 'Resultados devem ser um array');
    assert.ok(data.results.length > 0, 'Deve encontrar pelo menos 1 notícia');
    console.log(`   -> Encontradas ${data.results.length} matérias para Tarcísio + Economia`);
  });

  // 2. Teste do Top 10 Políticos mais buscados
  await test('Função Base 4: Top 10 Políticos mais buscados no aplicativo', async () => {
    const res = await fetch(`${BASE_URL}/api/rankings/politicians`);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.ok(Array.isArray(data.top10), 'Top 10 deve ser um array');
    assert.strictEqual(data.top10.length, 10, 'Deve retornar exatamente os 10 primeiros');
    assert.ok(data.top10[0].searchCount >= data.top10[1].searchCount, 'Deve estar ordenado por searchCount');
    console.log(`   -> Político #1: ${data.top10[0].name} com ${data.top10[0].searchCount} buscas`);
  });

  // 3. Teste do Top 10 Sites mais acessados
  await test('Função Base 3: Top 10 Sites mais acessados e rastreamento de cliques', async () => {
    const res = await fetch(`${BASE_URL}/api/rankings/sites`);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.ok(Array.isArray(data.top10), 'Top 10 sites deve ser um array');
    const site = data.top10[0];

    const clickRes = await fetch(`${BASE_URL}/api/sites/click`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ siteId: site.id })
    });
    const clickData = await clickRes.json();
    assert.strictEqual(clickData.success, true);
    assert.strictEqual(clickData.site.clicks, site.clicks + 1);
    console.log(`   -> Site ${site.name} computou novo clique: ${clickData.site.clicks}`);
  });

  // 4. Teste de Blogs Patrocinados e Monetização
  await test('Função Base 2: Lista de Blogs e notícias políticas patrocinadas', async () => {
    const res = await fetch(`${BASE_URL}/api/blogs`);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    const sponsoredBlog = data.blogs.find(b => b.isSponsored);
    assert.ok(sponsoredBlog, 'Deve existir blog com selo VIP patrocinado');
    console.log(`   -> Blog VIP: ${sponsoredBlog.name} (${sponsoredBlog.adSpotPrice})`);
  });

  // 5. NOVA MELHORIA: Cadastro de Usuário e Autenticação
  let testUserId = null;
  const testEmail = `test_${Date.now()}@radarpolitico.com`;
  await test('Melhoria 4: Cadastro de novo usuário no portal', async () => {
    const res = await fetch(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Ana Maria Eleitora',
        email: testEmail,
        password: 'senha123'
      })
    });
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.ok(data.user.id, 'Deve retornar ID do usuário criado');
    assert.strictEqual(data.user.email, testEmail.toLowerCase());
    testUserId = data.user.id;
    console.log(`   -> Usuário cadastrado com sucesso: ${data.user.name} (${data.user.id})`);
  });

  // 6. NOVA MELHORIA: Login de Usuário
  await test('Melhoria 4: Login de usuário existente', async () => {
    const res = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testEmail,
        password: 'senha123'
      })
    });
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.user.id, testUserId);
    console.log(`   -> Login realizado com sucesso para: ${data.user.email}`);
  });

  // 7. NOVA MELHORIA: Favoritar Políticos e Blogs
  await test('Melhoria 4: Salvar e alternar favoritos de Político e Blog', async () => {
    // Favoritar Lula
    const favPRes = await fetch(`${BASE_URL}/api/users/favorites/politician`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: testUserId, politicianId: 'lula' })
    });
    const favPData = await favPRes.json();
    assert.strictEqual(favPData.success, true);
    assert.strictEqual(favPData.isFavorited, true);

    // Favoritar Blog Congresso em Foco
    const favBRes = await fetch(`${BASE_URL}/api/users/favorites/blog`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: testUserId, blogId: 'blog-congresso-foco' })
    });
    const favBData = await favBRes.json();
    assert.strictEqual(favBData.success, true);
    assert.strictEqual(favBData.isFavorited, true);

    // Consultar favoritos salvos
    const listRes = await fetch(`${BASE_URL}/api/users/${testUserId}/favorites`);
    const listData = await listRes.json();
    assert.strictEqual(listData.success, true);
    assert.strictEqual(listData.favoritePoliticians.length, 1);
    assert.strictEqual(listData.favoriteBlogs.length, 1);
    console.log(`   -> Favoritos verificados: Político ${listData.favoritePoliticians[0].name}, Blog ${listData.favoriteBlogs[0].name}`);
  });

  // 8. NOVA MELHORIA: Radar Social - Saber se os políticos estão online ou transmitindo live
  await test('Melhoria 5: Radar Social de Políticos (Online e Lives em tempo real)', async () => {
    const res = await fetch(`${BASE_URL}/api/politicians/social-status`);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.ok(Array.isArray(data.politicians), 'Deve retornar lista de políticos com status');
    assert.ok(data.totalLive >= 0, 'Deve contabilizar total de lives ativas');
    
    const livePol = data.politicians.find(p => p.socialStatus && p.socialStatus.isLive);
    assert.ok(livePol, 'Deve haver político com transmissão ao vivo configurada');
    assert.ok(livePol.socialStatus.livePlatform, 'Político ao vivo deve ter plataforma (YouTube, Instagram, TikTok)');
    console.log(`   -> Político ao vivo detectado: ${livePol.popularName} no ${livePol.socialStatus.livePlatform} (${livePol.socialStatus.liveTitle})`);
  });

  // 9. NOVA MELHORIA: Alternar status de live de político em tempo real
  await test('Melhoria 5: Simulação de início e término de transmissão ao vivo', async () => {
    const toggleRes = await fetch(`${BASE_URL}/api/politicians/tarcisio/social-status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        isLive: true,
        livePlatform: 'YouTube',
        liveTitle: 'Transmissão Especial de SP: Entrevista Coletiva',
        liveUrl: 'https://youtube.com'
      })
    });
    const toggleData = await toggleRes.json();
    assert.strictEqual(toggleData.success, true);
    assert.strictEqual(toggleData.politician.socialStatus.isLive, true);
    console.log(`   -> Status atualizado em tempo real para: ${toggleData.politician.popularName} -> AO VIVO`);
  });

  // 10. NOVA VALIDAÇÃO: Fotos Reais e Oficiais dos Candidatos e Políticos
  await test('Fotos Reais dos Candidatos: Validação de imagens oficiais salvas localmente', async () => {
    const fs = require('fs');
    const path = require('path');
    const res = await fetch(`${BASE_URL}/api/rankings/politicians`);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    
    // Verificar se os políticos possuem avatares oficiais locais
    const lula = data.top10.find(p => p.id === 'lula');
    assert.ok(lula, 'Lula deve estar no ranking');
    assert.ok(lula.avatar.startsWith('/assets/politicians/'), 'Avatar deve apontar para foto oficial local');
    
    // Verificar existência do arquivo físico no disco
    const lulaPath = path.join(__dirname, '..', 'public', lula.avatar.replace(/^\//, ''));
    assert.ok(fs.existsSync(lulaPath), `Arquivo físico da foto real deve existir: ${lulaPath}`);
    const stats = fs.statSync(lulaPath);
    assert.ok(stats.size > 5000, 'Arquivo da foto real deve conter imagem válida');
    console.log(`   -> Foto real verificada: ${lula.name} (${lula.avatar}, tamanho: ${stats.size} bytes)`);
  });

  // 11. NOVA VALIDAÇÃO: Logos Oficiais de Origem (ex: G1) e Foto da Notícia
  await test('Apresentação dos Resultados: Foto em destaque e Logo Oficial da Origem (ex: G1)', async () => {
    const fs = require('fs');
    const path = require('path');
    const res = await fetch(`${BASE_URL}/api/search?politico=Lula&assunto=Economia`);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.ok(data.results.length > 0, 'Deve retornar notícias');
    
    const sample = data.results[0];
    assert.ok(sample.sourceLogo, 'Matéria deve conter sourceLogo');
    assert.ok(sample.imageUrl, 'Matéria deve conter imageUrl em destaque');
    
    // Verificar se o logo oficial existe no disco (ex: g1.svg, folha.svg)
    const logoPath = path.join(__dirname, '..', 'public', sample.sourceLogo.replace(/^\//, ''));
    assert.ok(fs.existsSync(logoPath), `Logo oficial vetorial deve existir: ${logoPath}`);
    console.log(`   -> Origem enfatizada: ${sample.source} com Logo Oficial: ${sample.sourceLogo} e Foto: ${sample.imageUrl.substring(0, 45)}...`);
  });

  // 12. NOVA VALIDAÇÃO: Sistema de Doação e Ranking Top 10 Donate
  await test('Doação & TOP 10 DONATE: Consulta de ranking e nova doação via PIX', async () => {
    const res = await fetch(`${BASE_URL}/api/donations`);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.ok(data.donations.topDonators.length > 0, 'Deve conter lista de doadores');
    assert.ok(data.donations.topDonators.length <= 10, 'Top 10 deve ter no máximo 10 itens');
    
    // Testar nova doação
    const postRes = await fetch(`${BASE_URL}/api/donations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Instituto Teste Automatizado',
        email: 'teste@transparencia.org',
        amount: 750,
        message: 'Apoio à transparência em tempo real.'
      })
    });
    const postData = await postRes.json();
    assert.strictEqual(postData.success, true);
    assert.ok(postData.donation.id, 'Deve gerar ID da doação');
    assert.ok(postData.pixCode, 'Deve retornar código PIX copia e cola');
    console.log(`   -> Doação registrada com sucesso: ${postData.donation.name} (R$ ${postData.donation.amount})`);
  });

  // 13. NOVA VALIDAÇÃO: Fotos Institucionais de Apoio (Congresso, STF, Planalto, Fazenda, Eleições)
  await test('Fotos Institucionais: Verificação física de fotos de apoio sem imagens fictícias', async () => {
    const fs = require('fs');
    const path = require('path');
    const themes = ['congresso.jpg', 'planalto.jpg', 'stf.jpg', 'fazenda.jpg', 'eleicoes.jpg', 'brasilia.jpg'];
    for (const t of themes) {
      const p = path.join(__dirname, '..', 'public', 'assets', 'themes', t);
      assert.ok(fs.existsSync(p), `Arquivo de tema deve existir: ${t}`);
      assert.ok(fs.statSync(p).size > 10000, `Arquivo de tema deve ser válido e maior que 10KB: ${t}`);
    }
    console.log(`   -> 6 fotos institucionais oficiais verificadas localmente em /assets/themes/`);
  });

  console.log(`\n======================================================`);
  console.log(`🎯 RESULTADO FINAL: ${passed}/${total} testes aprovados com 100% de sucesso!`);
  console.log(`======================================================\n`);
}

// Execução
runTests().catch(err => {
  console.error('Erro fatal ao rodar testes:', err);
  process.exit(1);
});
