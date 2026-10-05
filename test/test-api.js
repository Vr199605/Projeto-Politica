/**
 * Script de teste automatizado para as 4 funções bases do MVP Radar Político
 */
const assert = require('assert');

const BASE_URL = 'http://localhost:3000';

async function runTests() {
  console.log('🧪 Iniciando testes de validação das Funções Bases...');
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
    const res = await fetch(`${BASE_URL}/api/search?politico=Tarcísio&assunto=Economia&dataInicio=2026-08-01&dataFim=2026-10-05`);
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

  // 3. Teste de incremento do Político ao pesquisar
  await test('Função Base 4: Incremento de contagem ao pesquisar ou clicar em político', async () => {
    const resBefore = await fetch(`${BASE_URL}/api/rankings/politicians`);
    const dataBefore = await resBefore.json();
    const target = dataBefore.top10[0];

    const incRes = await fetch(`${BASE_URL}/api/rankings/politicians/increment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: target.id })
    });
    const incData = await incRes.json();
    assert.strictEqual(incData.success, true);
    assert.strictEqual(incData.politician.searchCount, target.searchCount + 1);
    console.log(`   -> Político ${target.name} incrementado com sucesso para ${incData.politician.searchCount}`);
  });

  // 4. Teste do Top 10 Sites mais acessados
  await test('Função Base 3: Top 10 Sites mais acessados no aplicativo', async () => {
    const res = await fetch(`${BASE_URL}/api/rankings/sites`);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.ok(Array.isArray(data.top10), 'Top 10 sites deve ser um array');
    assert.strictEqual(data.top10.length, 10, 'Deve retornar 10 sites');
    assert.ok(data.top10[0].clicks >= data.top10[1].clicks, 'Sites devem estar ordenados por cliques');
    console.log(`   -> Site #1: ${data.top10[0].name} com ${data.top10[0].clicks} acessos`);
  });

  // 5. Teste de Rastreio de Cliques em Sites
  await test('Função Base 3: Rastreio de cliques atualizando ranking de sites', async () => {
    const resBefore = await fetch(`${BASE_URL}/api/rankings/sites`);
    const dataBefore = await resBefore.json();
    const site = dataBefore.top10[0];

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

  // 6. Teste da Lista de Blogs e Notícias Políticas (Monetizado)
  await test('Função Base 2: Lista de Blogs e notícias políticas monetizadas', async () => {
    const res = await fetch(`${BASE_URL}/api/blogs`);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.ok(Array.isArray(data.blogs), 'Blogs deve ser um array');
    assert.ok(data.blogs.length > 0, 'Deve conter blogs cadastrados');
    
    // Verifica presença de modelo de monetização nos blogs
    const sponsoredBlog = data.blogs.find(b => b.isSponsored);
    assert.ok(sponsoredBlog, 'Deve existir blog com selo VIP patrocinado');
    assert.ok(sponsoredBlog.adSpotPrice, 'Blog patrocinado deve ter preço de anúncio');
    console.log(`   -> Blog VIP: ${sponsoredBlog.name} (${sponsoredBlog.adSpotPrice}, Modelo: ${sponsoredBlog.monetizationModel})`);
  });

  // 7. Teste de Cadastro de Novo Blog
  await test('Função Base 2: Cadastro de novo blog para monetização', async () => {
    const newBlogPayload = {
      name: 'Observatório Político Nacional',
      author: 'Redação Independente',
      url: 'https://observatoriopolitico.org.br',
      category: 'Investigação',
      description: 'Análises detalhadas do orçamento secreto e emendas parlamentares.',
      isSponsored: true
    };

    const res = await fetch(`${BASE_URL}/api/blogs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newBlogPayload)
    });
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.blog.name, newBlogPayload.name);
    console.log(`   -> Blog cadastrado: ${data.blog.name} com status: ${data.blog.tier}`);
  });

  // 8. Teste de Métricas de Monetização (Banners e Ads)
  await test('Painel de Monetização: Métricas de anúncios, impressões e receita', async () => {
    const res = await fetch(`${BASE_URL}/api/monetization/stats`);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.ok(data.monetization.totalImpressions >= 0, 'Deve conter métrica de impressões');
    assert.ok(data.monetization.estimatedRevenueBRL >= 0, 'Deve conter receita estimada');
    console.log(`   -> Impressões: ${data.monetization.totalImpressions}, CTR: ${data.monetization.ctr}, Receita: R$ ${data.monetization.estimatedRevenueBRL}`);
  });

  console.log(`\n=========================================`);
  console.log(`🎯 RESULTADO FINAL: ${passed}/${total} testes aprovados com sucesso!`);
  console.log(`=========================================\n`);
}

// Execução
runTests().catch(err => {
  console.error('Erro fatal ao rodar testes:', err);
  process.exit(1);
});
