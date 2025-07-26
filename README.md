# Maps Business Finder

Uma ferramenta poderosa para análise de concorrência baseada no Google Maps, desenvolvida em Node.js com interface web moderna.

## 🚀 Funcionalidades

### 🔍 Pesquisa Inteligente
- Busca por tipo de negócio no Google Maps
- Suporte a múltiplas localizações simultâneas
- Configuração de raio de busca (2km a 100km)
- Busca por endereços específicos com autocompletar

### 📊 Análise de Dados
- Extração automática de dados de empresas
- Sistema de pontuação composta baseado em avaliações e reviews
- Categorização automática por qualidade (Premium, Excelente, Muito Bom, etc.)
- Indicadores de qualidade (alta avaliação, muitas avaliações, etc.)

### 📈 Interface Moderna
- Interface responsiva e intuitiva
- Progresso em tempo real
- Filtros por categoria e localização
- Ordenação por diferentes critérios
- Descoberta de empresas em tempo real

### 💾 Importação e Exportação
- **Exportação**: JSON e CSV com metadados
- **Importação**: Suporte completo para arquivos JSON e CSV
- Prévia dos dados antes da importação
- Drag & drop para upload de arquivos

## 🛠️ Tecnologias

- **Backend**: Node.js, Express.js, Socket.IO
- **Frontend**: HTML5, CSS3, JavaScript (ES6+)
- **Browser Automation**: Puppeteer
- **UI/UX**: Design system customizado com CSS Grid/Flexbox
- **APIs**: Google Maps, Photon (geocoding)

## 📋 Pré-requisitos

- Node.js 16+ 
- npm ou yarn
- Google Chrome (para automação)

## 🚀 Instalação

1. **Clone o repositório**
```bash
git clone https://github.com/seu-usuario/maps-business-finder.git
cd maps-business-finder
```

2. **Instale as dependências**
```bash
npm install
```

3. **Configure as variáveis de ambiente**
```bash
cp .env.example .env
# Edite o arquivo .env com suas configurações
```

4. **Inicie o servidor**
```bash
npm start
```

5. **Acesse a aplicação**
```
http://localhost:3000
```

## 📁 Estrutura do Projeto

```
maps-business-finder/
├── src/
│   ├── core/                 # Lógica principal do scraper
│   │   ├── BrowserManager.js # Gerenciamento do navegador
│   │   ├── DataExtractor.js  # Extração de dados
│   │   ├── ScraperEngine.js  # Motor principal
│   │   ├── ScrollController.js # Controle de scroll
│   │   └── ResultProcessor.js # Processamento de resultados
│   ├── config/               # Configurações
│   │   ├── logging.json      # Configuração de logs
│   │   ├── selectors.json    # Seletores CSS
│   │   └── settings.json     # Configurações gerais
│   ├── utils/                # Utilitários
│   │   ├── exporters.js      # Exportação de dados
│   │   ├── logger.js         # Sistema de logs
│   │   └── validators.js     # Validações
│   └── web/                  # Servidor web
│       └── server.js         # Servidor Express
├── public/                   # Arquivos estáticos
│   ├── css/
│   │   └── styles.css        # Estilos da aplicação
│   ├── js/
│   │   └── app.js           # JavaScript do frontend
│   └── index.html           # Página principal
├── screenshots/              # Screenshots de debug
├── package.json
└── README.md
```

## 🎯 Como Usar

### 1. Pesquisa Básica
1. Digite o tipo de negócio (ex: "restaurante italiano")
2. Selecione o raio de busca
3. Clique em "Pesquisar"

### 2. Pesquisa com Localização
1. Digite o termo de busca
2. Adicione endereços específicos (opcional)
3. Configure o raio de busca
4. Inicie a pesquisa

### 3. Importação de Dados
1. Clique em "Importar" no header
2. Arraste ou selecione um arquivo JSON/CSV
3. Revise a prévia dos dados
4. Confirme a importação

### 4. Exportação de Resultados
1. Após a pesquisa ou importação
2. Clique em "Exportar" nos resultados
3. Escolha o formato (JSON/CSV)
4. Configure as opções de exportação

## ⚙️ Configuração

### Variáveis de Ambiente (.env)
```env
PORT=3000
NODE_ENV=development
LOG_LEVEL=info
BROWSER_HEADLESS=true
BROWSER_TIMEOUT=30000
```

### Configurações Avançadas
Edite `src/config/settings.json` para personalizar:
- Timeouts do navegador
- Configurações de scroll
- Limites de tentativas
- Configurações de exportação

## 📊 Formatos de Dados

### Estrutura JSON
```json
{
  "name": "Nome da Empresa",
  "rating": 4.5,
  "reviewCount": 150,
  "address": "Endereço completo",
  "compositeScore": 85.2,
  "tier": "Excelente",
  "searchLocation": "Localização da busca",
  "qualityIndicators": ["Alta Avaliação", "Muitas Avaliações"]
}
```

### Estrutura CSV
```csv
Nome,Avaliação,Comentários,Endereço,Pontuação,Categoria,Localização de Busca
Empresa A,4.5,150,Rua ABC 123,85.2,Excelente,São Paulo
```

## 🔧 Desenvolvimento

### Scripts Disponíveis
```bash
npm start          # Inicia o servidor
npm run dev        # Modo desenvolvimento com hot reload
npm run build      # Build para produção
npm test           # Executa testes
npm run lint       # Verifica código
```

### Estrutura de Desenvolvimento
- **Frontend**: Desenvolvido em JavaScript vanilla com módulos ES6
- **Backend**: Node.js com Express e Socket.IO para comunicação em tempo real
- **Automação**: Puppeteer para interação com Google Maps
- **Logs**: Sistema de logs estruturado com diferentes níveis

## 🤝 Contribuindo

1. Fork o projeto
2. Crie uma branch para sua feature (`git checkout -b feature/AmazingFeature`)
3. Commit suas mudanças (`git commit -m 'Add some AmazingFeature'`)
4. Push para a branch (`git push origin feature/AmazingFeature`)
5. Abra um Pull Request

### Padrões de Código
- Use ESLint para manter consistência
- Siga as convenções de nomenclatura
- Adicione testes para novas funcionalidades
- Documente APIs e funções complexas

## 📝 Licença

Este projeto está sob a licença MIT. Veja o arquivo [LICENSE](LICENSE) para mais detalhes.

## ⚠️ Aviso Legal

Esta ferramenta é destinada apenas para fins educacionais e de análise de mercado legítima. Respeite os Termos de Serviço do Google Maps e use a ferramenta de forma responsável.

## 🆘 Suporte

- **Issues**: [GitHub Issues](https://github.com/seu-usuario/maps-business-finder/issues)
- **Documentação**: [Wiki](https://github.com/seu-usuario/maps-business-finder/wiki)
- **Email**: suporte@mapsbusinessfinder.com

## 🙏 Agradecimentos

- Google Maps pela API de localização
- Photon pela API de geocoding
- Comunidade open source pelas bibliotecas utilizadas

---

**Desenvolvido com ❤️ para facilitar a análise de concorrência** 