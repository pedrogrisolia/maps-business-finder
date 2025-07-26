# Changelog

Todas as mudanças notáveis neste projeto serão documentadas neste arquivo.

O formato é baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/),
e este projeto adere ao [Versionamento Semântico](https://semver.org/lang/pt-BR/).

## [Unreleased]

### Adicionado
- Funcionalidade de importação de arquivos JSON e CSV
- Modal de importação com drag & drop
- Prévia dos dados antes da importação
- Suporte para múltiplas estruturas JSON
- Mapeamento automático de colunas CSV

### Removido
- Card "Progresso" da interface
- Informações de zoom das mensagens de progresso
- Seção de log técnico/debug
- Botões "Exportar" e "Histórico" do header
- Botão "+ Nova Pesquisa"

### Alterado
- Simplificação da interface de progresso
- Melhoria na experiência do usuário
- Foco na funcionalidade principal

## [1.0.0] - 2025-01-XX

### Adicionado
- Interface web moderna e responsiva
- Sistema de busca por tipo de negócio no Google Maps
- Suporte a múltiplas localizações simultâneas
- Configuração de raio de busca (2km a 100km)
- Busca por endereços específicos com autocompletar
- Extração automática de dados de empresas
- Sistema de pontuação composta baseado em avaliações e reviews
- Categorização automática por qualidade (Premium, Excelente, Muito Bom, etc.)
- Indicadores de qualidade (alta avaliação, muitas avaliações, etc.)
- Filtros por categoria e localização
- Ordenação por diferentes critérios
- Descoberta de empresas em tempo real
- Exportação em formatos JSON e CSV
- Sistema de logs estruturado
- Comunicação em tempo real via Socket.IO
- Automação de navegador com Puppeteer
- Sistema de progresso em tempo real
- Tratamento de erros robusto
- Screenshots automáticos para debug

### Tecnologias
- Backend: Node.js, Express.js, Socket.IO
- Frontend: HTML5, CSS3, JavaScript (ES6+)
- Browser Automation: Puppeteer
- UI/UX: Design system customizado com CSS Grid/Flexbox
- APIs: Google Maps, Photon (geocoding)

---

## Tipos de Mudanças

- **Adicionado** para novas funcionalidades
- **Alterado** para mudanças em funcionalidades existentes
- **Descontinuado** para funcionalidades que serão removidas em breve
- **Removido** para funcionalidades removidas
- **Corrigido** para correções de bugs
- **Segurança** para vulnerabilidades corrigidas 