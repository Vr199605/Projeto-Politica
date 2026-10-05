# 🛰️ Radar Político - MVP

Sistema inteligente de monitoramento, busca de notícias políticas, rankings de engajamento público e ecossistema de monetização de blogs e mídia jornalística.

---

## 📋 Funções Bases Implementadas

### 1. 🔍 Motor de Busca com Raio Temporal
- **Filtro por "Nome do Político"**: Busca inteligente com sugestões em tempo real (Lula, Bolsonaro, Tarcísio de Freitas, Fernando Haddad, Arthur Lira, Rodrigo Pacheco, Simone Tebet, Nikolas Ferreira, etc.).
- **Filtro por "Assunto / Tema"**: Economia, Reforma Tributária, STF, Eleições, Meio Ambiente, Orçamento, Saúde.
- **Filtro por "Raio da Notícia"**: Seleção de Data de Início e Data de Término, com atalhos de raio temporal rápido (*Hoje / 24h*, *Últimos 7 dias*, *Últimos 30 dias*, *Tudo*).
- **Agregação Híbrida em Tempo Real**: Conecta-se dinamicamente ao feed de notícias do Google News Brasil para matérias jornalísticas de última hora (G1, Folha de S.Paulo, Estadão, Metrópoles, Poder360, CNN Brasil, CartaCapital, etc.) e integra com a base curada local.

### 2. 📰 Lista de Blogs e Notícias Políticas (Monetizado)
- Catálogo especializado de colunistas de bastidores, blogs independentes e portais de análise.
- **Selo VIP Patrocinado**: Destaque para veículos parceiros e criadores monetizados.
- **Mídia Kit & Modelos de Monetização**: Exibição de modelos comerciais adotados (CPM, Banners, Publieditoriais, Assinatura de Relatórios, Valor de anúncio por semana).
- **Formulário Interativo de Cadastro**: Donos de blogs e colunistas podem cadastrar seus portais e solicitar adesão ao plano de monetização.

### 3. 🌐 Top 10 dos Sites Mais Acessados no Aplicativo
- Ranking atualizado em tempo real com os portais de notícias e blogs mais lidos através do aplicativo.
- **Rastreamento de Cliques (Outbound Tracker)**: Cada vez que um usuário clica para ler uma notícia na íntegra, a rota `/api/sites/click` computa o acesso e atualiza a posição do veículo no Top 10.
- Barras de progresso proporcionais ao tráfego do líder, medalhas para o Top 3 e botão de teste de interação.

### 4. 👥 Top 10 dos Políticos Mais Buscados no Aplicativo
- Pódio visual (#1 Ouro, #2 Prata, #3 Bronze) e classificação geral (posições 4 a 10).
- Contador auditado de pesquisas por político com taxa de crescimento e cargo institucional.
- **Atualização Automática**: Qualquer pesquisa executada com o nome de um político no motor de busca incrementa automaticamente o ranking.
- Ação rápida em 1 clique: *"Ver Notícias deste Político"* preenche o filtro e executa a busca instantaneamente.

### 5. 💰 Camada de Monetização & Publicidade
- Banner Leaderboard no topo da aplicação.
- Card patrocinado nativo (*Native Ad*) inserido estrategicamente no feed de resultados de notícias.
- Painel de métricas com Impressões, Cliques, Taxa de Cliques (CTR) e Estimativa de Receita em Reais (R$).
- Modal comercial para captação de anunciantes corporativos, assessorias e institutos de pesquisa.

---

## 🚀 Como Executar o Projeto

### Pré-requisitos
- Node.js instalado (v18+)

### Instalação e Inicialização
```bash
# 1. Navegue até o diretório do projeto
cd C:\Users\user\.gemini\antigravity\scratch\radar-politico

# 2. Instale as dependências (já instaladas no ambiente)
npm install

# 3. Inicie o servidor
npm start
```

Acesse no seu navegador:
👉 **`http://localhost:3000`**

---

## 🧪 Como Rodar os Testes Automatizados

O projeto conta com uma suíte de testes ponta a ponta validando todas as 4 funções bases:

```bash
npm test
# ou:
node test/test-api.js
```

Os testes verificam:
1. Busca com filtro combinado (Político + Assunto + Raio Temporal).
2. Ordenação e consistência do Top 10 Políticos.
3. Incremento em tempo real do político ao pesquisar.
4. Ordenação e consistência do Top 10 Sites Mais Acessados.
5. Rastreamento e persistência de cliques em links externos.
6. Listagem de blogs monetizados com selos VIP e preços de anúncio.
7. Cadastro de novos blogs com persistência em JSON.
8. Métricas do painel de monetização (Impressões, CTR e Receita).

---

## 📂 Estrutura de Arquivos

```
radar-politico/
├── data/
│   └── database.json        # Base persistente com políticos, sites, blogs, matérias e métricas
├── public/
│   ├── css/
│   │   └── style.css        # Animações, estilos de pódio, medalhas e efeitos customizados
│   ├── js/
│   │   └── app.js           # Lógica do frontend: busca, rankings, tracking e modais
│   └── index.html           # Interface responsiva moderna com Tailwind CSS e FontAwesome
├── test/
│   └── test-api.js          # Suíte de validação automatizada das 4 funções bases
├── package.json             # Dependências e scripts de execução
├── server.js                # Servidor Express, endpoints REST e integração com Google News RSS
└── README.md                # Documentação do MVP
```
