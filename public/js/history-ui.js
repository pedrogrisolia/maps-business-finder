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
                            <i class="fas fa-eye"></i> Ver Detalhes
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
        const extraction = await this.historyStorage.getExtractionById(extractionId);
        if (extraction) {
            this.selectedExtractionData = extraction;
            this.closeHistoryModal();
            // TODO: Integrar com a função de displayResults (necessário expor no app.js)
            // if (window.app && typeof window.app.displayResults === 'function') {
            //     window.app.displayResults(extraction.results, extraction.metadata);
            // } else {
            //     alert('Funcionalidade de carregar resultados indisponível no momento.');
            // }
            alert('Funcionalidade de carregar resultados históricos será implementada na próxima etapa. Dados da extração: ' + JSON.stringify(extraction.searchTerm));
        } else {
            alert('Extração não encontrada.');
        }
    }

    async confirmAndDeleteExtraction(extractionId) {
        if (confirm('Tem certeza que deseja excluir este registro de histórico?')) {
            await this.historyStorage.deleteExtraction(extractionId);
            this.renderExtractionsList(); // Atualiza a lista após exclusão
        }
    }
}