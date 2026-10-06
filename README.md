# 🛰️ Radar Político v2.0 - MVP

Sistema inteligente de monitoramento, busca de notícias políticas, rankings de engajamento público, acompanhamento de redes sociais ao vivo e ecossistema de monetização de mídia jornalística.

---

## 🚀 Novas Melhorias Implementadas (v2.0)

1. **✨ Apresentação e Layout Executivo Refinado**:
   - Design moderno, clean e responsivo (desktop, tablet e mobile).
   - Tipografia moderna com *Plus Jakarta Sans* e *Inter*.
   - Efeitos visuais refinados: medalhas para o pódio (#1, #2, #3), alertas pulsantes para lives ativas e cards com microinterações suaves.

2. **🏆 Top 3 Políticos e Portais Expostos na Página Inicial**:
   - Diretamente na Home ao lado do motor de busca:
     - **Top 3 Políticos Mais Buscados**: Cards com foto, cargo, partido, volume de pesquisas, botão de busca rápida e botão de favoritar (❤️).
     - **Top 3 Portais Mais Acessados**: Cards com posições 1, 2 e 3, ícone, volume de cliques e botão de acesso direto.

3. **⭐ Blogs e Fontes Patrocinadoras na Página Inicial**:
   - Vitrine destacada na Home para veículos parceiros e criadores monetizados (*Congresso em Foco Insider*, *Coluna Guilherme Amado*, *Anuário da Justiça & STF*, etc.).
   - Selo `⭐ Parceiro VIP`, resumo editorial, audiência e botão de visita e favoritar.

4. **👤 Cadastro / Login e Sistema de Favoritos**:
   - Modal com abas para **Entrar** ou **Criar Nova Conta**.
   - Usuário de demonstração pré-configurado (`demo@radarpolitico.com` / Senha: `123`).
   - Botão interativo de **Coração ❤️** em qualquer político para favoritar.
   - Botão interativo de **Estrela ⭐** em qualquer blog/portal para salvar.
   - Modal/Gaveta **"Meus Favoritos"** com contador em tempo real no cabeçalho.

5. **📡 Radar Social: Políticos Online e Transmissões Ao Vivo**:
   - Acompanhamento em tempo real de quem está **transmitindo lives ao vivo** (YouTube, Instagram, TikTok, X).
   - Indicador pulsante `🔴 AO VIVO AGORA` com o título da transmissão e link direto para assistir.
   - Indicador `🟢 ATIVO NAS REDES` com o último post relevante do político.
   - Aba exclusiva *"Políticos Online"* com filtros rápidos e simulação interativa.

---

## 📋 Funções Bases Originais Mantidas

- **Motor de Busca com Raio Temporal**: Busca por *Nome do Político*, *Assunto* e *Data Início / Data Fim*.
- **Agregação Híbrida em Tempo Real**: Conexão com Google News RSS Brasil + base interna curada.
- **Top 10 Completo de Políticos Mais Buscados**.
- **Top 10 Completo de Portais Mais Acessados** com rastreamento de cliques em links externos.
- **Painel de Monetização**: Banners CPM, Native Ads no feed, simulador de receita e formulário para anunciantes.

---

## 🏃 Como Executar

```bash
# 1. Navegue até a pasta do projeto
cd C:\Users\user\.gemini\antigravity\scratch\radar-politico

# 2. Inicie o servidor
npm start
```

Acesse no navegador:
👉 **`http://localhost:3000`**

---

## 🧪 Suíte de Testes Automatizados

Para rodar todos os testes de validação:

```bash
npm test
```
```text
🧪 Iniciando testes de validação do Radar Político v2.0...
✅ [PASS] Função Base 1: Busca de notícias por Político, Assunto e Raio Temporal
✅ [PASS] Função Base 4: Top 10 Políticos mais buscados no aplicativo
✅ [PASS] Função Base 3: Top 10 Sites mais acessados e rastreamento de cliques
✅ [PASS] Função Base 2: Lista de Blogs e notícias políticas patrocinadas
✅ [PASS] Melhoria 4: Cadastro de novo usuário no portal
✅ [PASS] Melhoria 4: Login de usuário existente
✅ [PASS] Melhoria 4: Salvar e alternar favoritos de Político e Blog
✅ [PASS] Melhoria 5: Radar Social de Políticos (Online e Lives em tempo real)
✅ [PASS] Melhoria 5: Simulação de início e término de transmissão ao vivo

======================================================
🎯 RESULTADO FINAL: 9/9 testes aprovados com 100% de sucesso!
======================================================
```
