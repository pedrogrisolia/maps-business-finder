# Guia de Contribuição

Obrigado por considerar contribuir com o Maps Business Finder! Este documento fornece diretrizes para contribuições.

## 🚀 Como Contribuir

### 1. Configuração do Ambiente

1. **Fork o repositório**
   ```bash
   git clone https://github.com/seu-usuario/maps-business-finder.git
   cd maps-business-finder
   ```

2. **Instale as dependências**
   ```bash
   npm install
   ```

3. **Configure o ambiente**
   ```bash
   cp env.example .env
   # Edite o arquivo .env conforme necessário
   ```

4. **Verifique se tudo está funcionando**
   ```bash
   npm start
   ```

### 2. Fluxo de Trabalho

1. **Crie uma branch para sua feature**
   ```bash
   git checkout -b feature/nome-da-feature
   # ou
   git checkout -b fix/nome-do-fix
   ```

2. **Faça suas alterações**
   - Siga os padrões de código
   - Adicione testes quando apropriado
   - Documente mudanças significativas

3. **Teste suas alterações**
   ```bash
   npm test
   npm run lint
   ```

4. **Commit suas mudanças**
   ```bash
   git add .
   git commit -m "feat: adiciona nova funcionalidade X"
   ```

5. **Push para sua branch**
   ```bash
   git push origin feature/nome-da-feature
   ```

6. **Abra um Pull Request**
   - Use o template de PR
   - Descreva claramente as mudanças
   - Inclua screenshots se aplicável

## 📝 Padrões de Commit

Siga o padrão [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

### Tipos de Commit

- `feat`: Nova funcionalidade
- `fix`: Correção de bug
- `docs`: Documentação
- `style`: Formatação, ponto e vírgula, etc.
- `refactor`: Refatoração de código
- `test`: Adição ou correção de testes
- `chore`: Tarefas de build, dependências, etc.

### Exemplos

```bash
feat: adiciona suporte para múltiplas localizações
fix: corrige problema de timeout no scroll
docs: atualiza README com novas funcionalidades
style: formata código conforme padrões
refactor: reorganiza estrutura de componentes
test: adiciona testes para importação de CSV
chore: atualiza dependências do projeto
```

## 🎯 Áreas para Contribuição

### Prioridade Alta
- [ ] Melhorias na interface de usuário
- [ ] Otimização de performance
- [ ] Novos filtros de busca
- [ ] Melhorias na exportação de dados

### Prioridade Média
- [ ] Testes automatizados
- [ ] Documentação da API
- [ ] Internacionalização
- [ ] Plugins para diferentes formatos

### Prioridade Baixa
- [ ] Temas visuais
- [ ] Integração com outras APIs
- [ ] Funcionalidades avançadas de análise

## 🧪 Testes

### Executando Testes
```bash
# Todos os testes
npm test

# Testes específicos
npm test -- --grep "nome do teste"

# Cobertura
npm run test:coverage
```

### Escrevendo Testes
- Use Jest como framework de teste
- Mantenha cobertura acima de 80%
- Teste casos de sucesso e erro
- Use mocks para dependências externas

## 📋 Checklist de Pull Request

Antes de submeter um PR, verifique:

- [ ] Código segue os padrões do projeto
- [ ] Testes passam
- [ ] Linting não mostra erros
- [ ] Documentação foi atualizada
- [ ] Screenshots incluídos (se aplicável)
- [ ] Commit messages seguem o padrão
- [ ] Branch está atualizada com main

## 🐛 Reportando Bugs

### Antes de Reportar
1. Verifique se o bug já foi reportado
2. Teste com a versão mais recente
3. Reproduza o problema consistentemente

### Template de Bug Report
```markdown
**Descrição do Bug**
Descrição clara e concisa do problema.

**Passos para Reproduzir**
1. Vá para '...'
2. Clique em '...'
3. Role até '...'
4. Veja o erro

**Comportamento Esperado**
O que deveria acontecer.

**Screenshots**
Se aplicável, adicione screenshots.

**Ambiente**
- OS: [ex: Windows 10]
- Browser: [ex: Chrome 120]
- Versão: [ex: 1.0.0]

**Informações Adicionais**
Qualquer contexto adicional sobre o problema.
```

## 💡 Sugerindo Funcionalidades

### Template de Feature Request
```markdown
**Problema que a funcionalidade resolveria**
Descrição clara do problema.

**Solução Proposta**
Descrição da funcionalidade desejada.

**Alternativas Consideradas**
Outras soluções que você considerou.

**Contexto Adicional**
Qualquer contexto adicional.
```

## 📚 Recursos

- [Documentação da API](docs/api.md)
- [Guia de Estilo](docs/style-guide.md)
- [Arquitetura do Projeto](docs/architecture.md)
- [FAQ](docs/faq.md)

## 🤝 Comunidade

- **Issues**: [GitHub Issues](https://github.com/seu-usuario/maps-business-finder/issues)
- **Discussões**: [GitHub Discussions](https://github.com/seu-usuario/maps-business-finder/discussions)
- **Wiki**: [Documentação](https://github.com/seu-usuario/maps-business-finder/wiki)

## 📄 Licença

Ao contribuir, você concorda que suas contribuições serão licenciadas sob a [Licença MIT](LICENSE).

---

**Obrigado por contribuir! 🎉** 