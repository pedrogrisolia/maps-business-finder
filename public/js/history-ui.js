class HistoryUI {
    constructor(historyStorage) {
        this.historyStorage = historyStorage;
        this.historyModal = document.getElementById('historyModal');
        this.historyList = document.getElementById('historyList');
        this.historySearchInput = document.getElementById('historySearchInput');
        this.historyFilterDate = document.getElementById('historyFilterDate');

        this.historyBtn = document.getElementById('historyBtn');
        this.modalCloseBtns = this.historyModal.querySelectorAll('.modal-close');

        this.selectedExtractionData = null; // Para armazenar os dados da extração selecionada

        this.initEventListeners();
    }

    initEventListeners() {
        this.historyBtn.addEventListener('click', () => this.openHistoryModal());
        this.modalCloseBtns.forEach(btn => {
            btn.addEventListener('click', () => this.closeHistoryModal());
        });
        window.addEventListener('click', (event) => {
            if (event.target == this.historyModal) {
                this.closeHistoryModal();
            }
        });

        this.historySearchInput.addEventListener('input', () => this.renderExtractionsList());
        this.historyFilterDate.addEventListener('change', () => this.renderExtractionsList());
    }

    openHistoryModal() {
        this.historyModal.classList.add('active');
        this.renderExtractionsList();
    }

    closeHistoryModal() {
        this.historyModal.classList.remove('active');
    }

    async renderExtractionsList() {
        const extractions = await this.historyStorage.getAllExtractions();
        const searchTerm = this.historySearchInput.value.toLowerCase();
        const filterDate = this.historyFilterDate.value;

        // Filtrar
        const filtered = extractions.filter(item => {
            const matchesSearchTerm = searchTerm === '' || 
                                      item.searchTerm.toLowerCase().includes(searchTerm) ||
                                      item.searchLocation.toLowerCase().includes(searchTerm);
            
            const itemDate = new Date(item.timestamp);
            const now = new Date();
            let matchesDateFilter = true;

            if (filterDate === 'today') {
                matchesDateFilter = itemDate.toDateString() === now.toDateString();
            } else if (filterDate === 'last7days') {
                const sevenDaysAgo = new Date(now.setDate(now.getDate() - 7));
                matchesDateFilter = itemDate >= sevenDaysAgo;
            } else if (filterDate === 'last30days') {
                const thirtyDaysAgo = new Date(now.setDate(now.getDate() - 30));
                matchesDateFilter = itemDate >= thirtyDaysAgo;
            }
            return matchesSearchTerm && matchesDateFilter;
        });

        // Ordenar por data (mais recente primeiro)
        filtered.sort((a, b) => b.timestamp - a.timestamp);
        console.log('DEBUG - Extrações filtradas:', filtered.length);
        if (filtered.length > 0) {
            console.log('DEBUG - Primeira extração (ID, Termo):', filtered[0].id, filtered[0].searchTerm);
            console.log('DEBUG - Última extração (ID, Termo):', filtered[filtered.length - 1].id, filtered[filtered.length - 1].searchTerm);
        }

        this.historyList.innerHTML = '';
        if (filtered.length === 0) {
            this.historyList.innerHTML = '<li class="history-item text-center">Nenhuma extração encontrada.</li>';
            return;
        }

        filtered.forEach(extraction => {
            const date = new Date(extraction.timestamp).toLocaleString('pt-BR');
            const previewBusinesses = extraction.results.slice(0, 3).map(b => b.name).join(', ');

            const listItem = document.createElement('li');
            listItem.className = 'history-item';
            listItem.innerHTML = `
                <div class="history-item-icon">
                    <i class="fas fa-history"></i>
                </div>
                <div class="history-item-content">
                    <div class="history-item-header">
                        <h4 class="history-item-title">${extraction.searchTerm}</h4>
                        <span class="history-item-date">${date}</span>
                    </div>
                    <div class="history-item-meta">
                        <span><i class="fas fa-map-marker-alt"></i> ${extraction.searchLocation}</span>
                        <span><i class="fas fa-building"></i> ${extraction.totalResults} Empresas</span>
                        <span><i class="fas fa-star"></i> ${extraction.avgRating ? extraction.avgRating.toFixed(1) : 'N/A'} Média de Avaliação</span>
                    </div>
                    <div class="history-item-preview">
                        <p>Principais empresas: ${previewBusinesses}...</p>
                    </div>
                    <div class="history-item-actions">
                        <button class="btn btn-sm btn-primary view-details-btn" data-id="${extraction.id}">
                            <i class="fas fa-eye"></i> Carregar Resultados
                        </button>
                        <button class="btn btn-sm btn-danger delete-extraction-btn" data-id="${extraction.id}">
                            <i class="fas fa-trash"></i> Excluir
                        </button>
                    </div>
                </div>
            `;
            this.historyList.appendChild(listItem);
        });

        this.historyList.querySelectorAll('.view-details-btn').forEach(button => {
            button.addEventListener('click', (event) => this.loadExtractionToMainTable(event.target.dataset.id));
        });

        this.historyList.querySelectorAll('.delete-extraction-btn').forEach(button => {
            button.addEventListener('click', (event) => this.confirmAndDeleteExtraction(event.target.dataset.id));
        });
    }

    async loadExtractionToMainTable(extractionId) {
        try {
            const extraction = await this.historyStorage.getExtractionById(extractionId);
            if (extraction) {
                this.selectedExtractionData = extraction;
                this.closeHistoryModal();
                
                // Verificar se o app principal está disponível
                if (window.app && typeof window.app.loadHistoricalData === 'function') {
                    // Carregar dados históricos na interface principal
                    window.app.loadHistoricalData(extraction);
                } else if (window.mapBusinessFinderApp && typeof window.mapBusinessFinderApp.loadHistoricalData === 'function') {
                    // Fallback para a instância direta do app
                    window.mapBusinessFinderApp.loadHistoricalData(extraction);
                } else {
                    // Fallback para método alternativo
                    this.loadHistoricalDataFallback(extraction);
                }
            } else {
                this.showError('Extração não encontrada.');
            }
        } catch (error) {
            console.error('Erro ao carregar extração:', error);
            this.showError('Erro ao carregar dados históricos.');
        }
    }

    /**
     * Método fallback para carregar dados históricos
     * @param {Object} extraction - Dados da extração
     */
    loadHistoricalDataFallback(extraction) {
        try {
            // Atualizar dados no app principal
            if (window.mapBusinessFinderApp) {
                window.mapBusinessFinderApp.currentResults = extraction.results || [];
                window.mapBusinessFinderApp.filteredResults = [...window.mapBusinessFinderApp.currentResults];
                
                // Atualizar input de busca
                const searchInput = document.getElementById('searchInput');
                if (searchInput) {
                    searchInput.value = extraction.searchTerm || '';
                }
                
                // Mostrar resultados
                this.showHistoricalResultsFallback(extraction);
                
                this.showSuccess('Dados históricos carregados com sucesso!');
            } else {
                this.showError('Aplicação principal não encontrada.');
            }
        } catch (error) {
            console.error('Erro no fallback de carregamento:', error);
            this.showError('Erro ao carregar dados históricos.');
        }
    }

    /**
     * Mostra resultados históricos usando método fallback
     * @param {Object} extraction - Dados da extração
     */
    showHistoricalResultsFallback(extraction) {
        const app = window.mapBusinessFinderApp;
        if (!app) return;

        // Mostrar seção de resultados
        const resultsSection = document.getElementById('resultsSection');
        if (resultsSection) {
            resultsSection.style.display = 'block';
            resultsSection.classList.add('fade-in');
        }

        // Atualizar título
        const resultsTitle = document.getElementById('resultsTitle');
        if (resultsTitle) {
            const searchTerm = extraction.searchTerm || 'Busca Histórica';
            resultsTitle.textContent = `Resultados Históricos: "${searchTerm}"`;
        }

        // Atualizar resumo
        const resultsSummary = document.getElementById('resultsSummary');
        if (resultsSummary) {
            const totalResults = extraction.totalResults || 0;
            const avgRating = extraction.avgRating || 0;
            const timestamp = new Date(extraction.timestamp).toLocaleString('pt-BR');
            
            resultsSummary.innerHTML = `
                <span><strong>${totalResults}</strong> empresas encontradas</span>
                <span>Avaliação média: <strong>${avgRating.toFixed(1) || 'N/A'}</strong></span>
                <span>Data da busca: <strong>${timestamp}</strong></span>
            `;
        }

        // Configurar filtros e exibir resultados
        if (typeof app.setupTierFilters === 'function') {
            app.setupTierFilters();
        }
        if (typeof app.displayResults === 'function') {
            app.displayResults();
        }

        // Habilitar botão de exportação
        const exportBtn = document.getElementById('exportResultsBtn');
        if (exportBtn) {
            exportBtn.disabled = false;
        }
    }

    async confirmAndDeleteExtraction(extractionId) {
        if (confirm('Tem certeza que deseja excluir este registro de histórico?')) {
            try {
                await this.historyStorage.deleteExtraction(extractionId);
                this.renderExtractionsList(); // Atualiza a lista após exclusão
                this.showSuccess('Registro excluído com sucesso!');
            } catch (error) {
                console.error('Erro ao excluir extração:', error);
                this.showError('Erro ao excluir registro.');
            }
        }
    }

    /**
     * Mostra notificação de sucesso
     * @param {string} message - Mensagem a ser exibida
     */
    showSuccess(message) {
        this.showNotification(message, 'success');
    }

    /**
     * Mostra notificação de erro
     * @param {string} message - Mensagem a ser exibida
     */
    showError(message) {
        this.showNotification(message, 'error');
    }

    /**
     * Mostra notificação de informação
     * @param {string} message - Mensagem a ser exibida
     */
    showInfo(message) {
        this.showNotification(message, 'info');
    }

    /**
     * Mostra notificação
     * @param {string} message - Mensagem a ser exibida
     * @param {string} type - Tipo da notificação (success, error, info)
     */
    showNotification(message, type = 'info') {
        // Tentar usar o sistema de notificação do app principal
        if (window.app && typeof window.app.showNotification === 'function') {
            window.app.showNotification(message, type);
        } else if (window.mapBusinessFinderApp && typeof window.mapBusinessFinderApp.showNotification === 'function') {
            window.mapBusinessFinderApp.showNotification(message, type);
        } else {
            // Fallback para alert simples
            alert(message);
        }
    }
}