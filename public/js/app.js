// Maps Business Finder - Frontend Application
class MapBusinessFinderApp {
    constructor() {
        this.socket = null;
        this.currentSession = null;
        this.currentResults = [];
        this.filteredResults = [];
        this.progressTimer = null;
        this.startTime = null;
        
        // DOM elements
        this.elements = {};
        
        // Configuration
        this.config = {
            maxLogEntries: 50,
            progressUpdateInterval: 1000,
            tierColors: {
                'Premium': '#7c3aed',
                'Excelente': '#059669',
                'Muito Bom': '#0ea5e9',
                'Bom': '#84cc16',
                'Médio': '#f59e0b',
                'Básico': '#6b7280',
                'Não Avaliado': '#9ca3af'
            }
        };
        
        this.init();
    }

    async init() {
        try {
            this.bindDOMElements();
            this.setupEventListeners();
            this.initializeSocket();
            this.loadSearchHistory();
            console.log('Maps Business Finder App initialized successfully');
        } catch (error) {
            console.error('Failed to initialize app:', error);
            this.showError('Erro ao inicializar a aplicação. Recarregue a página.');
        }
    }

    bindDOMElements() {
        // Search elements
        this.elements = {
            searchForm: document.getElementById('searchForm'),
            searchInput: document.getElementById('searchInput'),
            searchBtn: document.getElementById('searchBtn'),
            
            // Advanced options
            advancedToggle: document.getElementById('advancedToggle'),
            advancedContent: document.getElementById('advancedContent'),
            minRating: document.getElementById('minRating'),
            minReviews: document.getElementById('minReviews'),
            resultLimit: document.getElementById('resultLimit'),
            exportFormat: document.getElementById('exportFormat'),
            searchRadius: document.getElementById('searchRadius'),
            
            // Suggestion chips
            suggestionChips: document.querySelectorAll('.suggestion-chip'),
            
            // Progress elements
            progressSection: document.getElementById('progressSection'),
            progressTitle: document.getElementById('progressTitle'),
            progressFill: document.getElementById('progressFill'),
            progressText: document.getElementById('progressText'),
            elapsedTime: document.getElementById('elapsedTime'),
            businessCount: document.getElementById('businessCount'),
            currentStatus: document.getElementById('currentStatus'),
            stopBtn: document.getElementById('stopBtn'),
            
            // Business discovery elements
            businessDiscovery: document.getElementById('businessDiscovery'),
            discoveryCount: document.getElementById('discoveryCount'),
            discoveryGrid: document.getElementById('discoveryGrid'),
            
            // Results elements
            resultsSection: document.getElementById('resultsSection'),
            resultsTitle: document.getElementById('resultsTitle'),
            resultsSummary: document.getElementById('resultsSummary'),
            resultsSearch: document.getElementById('resultsSearch'),
            tierFilters: document.getElementById('tierFilters'),
            sortBy: document.getElementById('sortBy'),
            sortOrder: document.getElementById('sortOrder'),
            resultsTableBody: document.getElementById('resultsTableBody'),
            resultsPagination: document.getElementById('resultsPagination'),
            
            // Action buttons
            exportResultsBtn: document.getElementById('exportResultsBtn'),
            importBtn: document.getElementById('importBtn'),
            
            // Modal elements
            exportModal: document.getElementById('exportModal'),
            importModal: document.getElementById('importModal'),
            modalClose: document.querySelectorAll('.modal-close'),
            cancelExport: document.getElementById('cancelExport'),
            confirmExport: document.getElementById('confirmExport'),
            cancelImport: document.getElementById('cancelImport'),
            confirmImport: document.getElementById('confirmImport'),
            
            // Import elements
            importFile: document.getElementById('importFile'),
            uploadZone: document.getElementById('uploadZone'),
            importPreview: document.getElementById('importPreview'),
            previewCount: document.getElementById('previewCount'),
            previewFormat: document.getElementById('previewFormat'),
            previewTableBody: document.getElementById('previewTableBody')
        };
    }

    setupEventListeners() {
        // Search form
        this.elements.searchForm.addEventListener('submit', this.handleSearch.bind(this));
        
        // Advanced options toggle
        this.elements.advancedToggle.addEventListener('click', this.toggleAdvancedOptions.bind(this));
        
        // Suggestion chips
        this.elements.suggestionChips.forEach(chip => {
            chip.addEventListener('click', (e) => {
                this.elements.searchInput.value = e.target.dataset.term;
                this.elements.searchInput.focus();
            });
        });
        
        // Progress controls
        this.elements.stopBtn.addEventListener('click', this.stopCurrentSession.bind(this));
        
        // Results controls
        this.elements.resultsSearch.addEventListener('input', this.debounce(this.filterResults.bind(this), 300));
        this.elements.sortBy.addEventListener('change', this.sortResults.bind(this));
        this.elements.sortOrder.addEventListener('click', this.toggleSortOrder.bind(this));
        
        // Action buttons
        this.elements.exportResultsBtn.addEventListener('click', this.showExportModal.bind(this));
        this.elements.importBtn.addEventListener('click', this.showImportModal.bind(this));
        
        // Modal controls
        this.elements.modalClose.forEach(close => {
            close.addEventListener('click', (e) => {
                const modal = e.target.closest('.modal');
                if (modal) {
                    this.hideModal(modal);
                }
            });
        });
        
        this.elements.cancelExport.addEventListener('click', () => this.hideModal(this.elements.exportModal));
        this.elements.confirmExport.addEventListener('click', this.exportResults.bind(this));
        this.elements.cancelImport.addEventListener('click', () => this.hideModal(this.elements.importModal));
        this.elements.confirmImport.addEventListener('click', this.importResults.bind(this));
        
        // Close modals on outside click
        [this.elements.exportModal, this.elements.importModal].forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.hideModal(modal);
                }
            });
        });
        
        // Import file handling
        this.elements.importFile.addEventListener('change', this.handleFileSelect.bind(this));
        this.elements.uploadZone.addEventListener('click', () => this.elements.importFile.click());
        this.elements.uploadZone.addEventListener('dragover', this.handleDragOver.bind(this));
        this.elements.uploadZone.addEventListener('drop', this.handleFileDrop.bind(this));
        
        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.hideAllModals();
            }
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                if (this.elements.searchInput === document.activeElement) {
                    this.handleSearch(e);
                }
            }
        });
    }

    initializeSocket() {
        try {
            this.socket = io();
            
            this.socket.on('connect', () => {
                console.log('Connected to server');
            });
            
            this.socket.on('disconnect', () => {
                console.log('Disconnected from server');
            });
            
            this.socket.on('progress', this.handleProgressUpdate.bind(this));
            this.socket.on('session-started', this.handleSessionStarted.bind(this));
            this.socket.on('session-completed', this.handleSessionCompleted.bind(this));
            this.socket.on('session-failed', this.handleSessionFailed.bind(this));
            this.socket.on('session-stopped', this.handleSessionStopped.bind(this));
            
        } catch (error) {
            console.error('Failed to initialize socket:', error);
            this.showError('Erro ao conectar com o servidor. Verifique sua conexão.');
        }
    }

    async handleSearch(e) {
        e.preventDefault();
        
        const searchTerm = this.elements.searchInput.value.trim();
        if (!searchTerm) {
            this.showError('Por favor, digite um termo de pesquisa.');
            return;
        }

        // Get search options
        const options = {
            minRating: this.elements.minRating.value ? parseFloat(this.elements.minRating.value) : null,
            minReviews: this.elements.minReviews.value ? parseInt(this.elements.minReviews.value) : null,
            limit: this.elements.resultLimit.value ? parseInt(this.elements.resultLimit.value) : null,
            exportFormats: this.elements.exportFormat.value.split(','),
            searchRadius: parseInt(this.elements.searchRadius.value) || 10
        };

        // Get selected address coordinates if available
        const selectedAddresses = window.getSelectedAddressCoordinates();
        if (selectedAddresses && selectedAddresses.length > 0) {
            options.coordinates = selectedAddresses;
        }

        try {
            this.setSearching(true);
            this.hideResults();
            this.clearProgress();
            
            // Send search request
            const response = await fetch('/api/scrape', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    searchTerm,
                    options
                })
            });

            const result = await response.json();
            
            if (!result.success) {
                throw new Error(result.error || 'Erro desconhecido');
            }

            // Store session and subscribe to updates
            this.currentSession = result.sessionId;
            this.socket.emit('subscribe-to-session', this.currentSession);
            
            // Show progress section
            this.showProgress();
            this.startProgressTimer();
            
            // Save to search history
            this.saveToSearchHistory(searchTerm, options);
            
        } catch (error) {
            console.error('Search failed:', error);
            this.showError(`Erro ao iniciar pesquisa: ${error.message}`);
            this.setSearching(false);
        }
    }

    setSearching(searching) {
        this.elements.searchBtn.disabled = searching;
        const btnText = this.elements.searchBtn.querySelector('.btn-text');
        const btnLoading = this.elements.searchBtn.querySelector('.btn-loading');
        
        if (searching) {
            btnText.style.display = 'none';
            btnLoading.style.display = 'inline-block';
        } else {
            btnText.style.display = 'inline-block';
            btnLoading.style.display = 'none';
        }
    }

    toggleAdvancedOptions() {
        const content = this.elements.advancedContent;
        const toggle = this.elements.advancedToggle;
        
        if (content.classList.contains('active')) {
            content.classList.remove('active');
            toggle.classList.remove('active');
        } else {
            content.classList.add('active');
            toggle.classList.add('active');
        }
    }

    showProgress() {
        this.elements.progressSection.style.display = 'block';
        this.elements.progressSection.classList.add('fade-in');
        this.startTime = Date.now();
    }

    hideProgress() {
        this.elements.progressSection.style.display = 'none';
        this.stopProgressTimer();
    }

    clearProgress() {
        this.elements.progressFill.style.width = '0%';
        this.elements.progressText.textContent = '0%';
        this.elements.elapsedTime.textContent = '0s';
        this.elements.businessCount.textContent = '0';
        this.elements.currentStatus.textContent = 'Preparando...';
        this.elements.discoveryGrid.innerHTML = '';
        this.elements.discoveryCount.textContent = '0 encontradas';
    }

    startProgressTimer() {
        this.stopProgressTimer();
        this.progressTimer = setInterval(() => {
            this.updateElapsedTime();
        }, 1000);
    }

    stopProgressTimer() {
        if (this.progressTimer) {
            clearInterval(this.progressTimer);
            this.progressTimer = null;
        }
    }

    updateElapsedTime() {
        if (this.startTime) {
            const elapsed = Math.floor((Date.now() - this.startTime) / 1000);
            this.elements.elapsedTime.textContent = this.formatDuration(elapsed);
        }
    }

    formatDuration(seconds) {
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        return minutes > 0 ? `${minutes}m ${remainingSeconds}s` : `${remainingSeconds}s`;
    }

    handleProgressUpdate(data) {
        console.log('Progress update:', data);
        
        // Update progress bar
        if (data.progress !== null && data.progress !== undefined) {
            this.elements.progressFill.style.width = `${data.progress}%`;
            this.elements.progressText.textContent = `${Math.round(data.progress)}%`;
        }
        
        // User-friendly status messages
        const userStatusMessages = {
            'session_started': 'Iniciando pesquisa...',
            'initializing_browser': 'Preparando navegador...',
            'navigating': 'Acessando Google Maps...',
            'extracting_initial_data': 'Buscando primeiras empresas...',
            'smart_scrolling': 'Explorando mais resultados...',
            'scrolling': 'Descobrindo novas empresas...',
            'extracting_final_data': 'Coletando informações finais...',
            'processing_results': 'Organizando resultados...',
            'exporting_results': 'Preparando arquivos de exportação...',
            'completed': 'Pesquisa concluída com sucesso!',
            'error': 'Ocorreu um erro durante a pesquisa'
        };
        
        let userMessage = userStatusMessages[data.stage] || data.stage;
        
        // Add location information if available
        if (data.data && data.data.location) {
            const locationInfo = data.data.location;
            const locationProgress = data.data.locationIndex && data.data.totalLocations ? ` [${data.data.locationIndex}/${data.data.totalLocations}]` : '';
            userMessage += ` - ${locationInfo}${locationProgress}`;
        }
        
        this.elements.currentStatus.textContent = userMessage;
        
        // Update counters and handle business discovery
        if (data.data) {
            if (data.data.totalExtracted) {
                this.elements.businessCount.textContent = data.data.totalExtracted;
                this.elements.discoveryCount.textContent = `${data.data.totalExtracted} encontrada${data.data.totalExtracted > 1 ? 's' : ''}`;
                
                // Update discovery count with location information
                let discoveryText = `${data.data.totalExtracted} encontradas`;
                
                if (data.data.location && data.data.locationIndex && data.data.totalLocations) {
                    discoveryText += ` - ${data.data.location} [${data.data.locationIndex}/${data.data.totalLocations}]`;
                }
                
                this.elements.discoveryCount.textContent = discoveryText;
            }
        }
    }

    handleSessionStarted(data) {
        console.log('Session started:', data);
        const searchTerm = data.searchTerm;
        const coordinates = data.options?.coordinates;
        
        if (coordinates && Array.isArray(coordinates) && coordinates.length > 0) {
            if (coordinates.length === 1) {
                this.elements.progressTitle.textContent = `Pesquisando: ${searchTerm} em ${coordinates[0].address}`;
            } else {
                this.elements.progressTitle.textContent = `Pesquisando: ${searchTerm} em ${coordinates.length} localizações`;
            }
        } else if (coordinates && coordinates.address) {
            this.elements.progressTitle.textContent = `Pesquisando: ${searchTerm} em ${coordinates.address}`;
        } else {
            this.elements.progressTitle.textContent = `Pesquisando: ${searchTerm}`;
        }
    }

    handleSessionCompleted(data) {
        console.log('Session completed:', data);
        this.setSearching(false);
        this.stopProgressTimer();
        
        // Update final progress
        this.elements.progressFill.style.width = '100%';
        this.elements.progressText.textContent = '100%';
        
        if (data.result && data.result.success) {
            this.currentResults = data.result.results.businesses || [];
            this.showResults(data.result);
            this.hideProgress();
        } else {
            this.showError('Pesquisa concluída mas sem resultados válidos.');
        }
    }

    handleSessionFailed(data) {
        console.error('Session failed:', data);
        this.setSearching(false);
        this.stopProgressTimer();
        this.showError(`Erro na pesquisa: ${data.error}`);
    }

    handleSessionStopped(data) {
        console.log('Session stopped:', data);
        this.setSearching(false);
        this.stopProgressTimer();
        this.hideProgress();
        this.showInfo('Pesquisa interrompida pelo usuário.');
    }

    async stopCurrentSession() {
        if (!this.currentSession) return;
        
        try {
            const response = await fetch(`/api/sessions/${this.currentSession}`, {
                method: 'DELETE'
            });
            
            if (!response.ok) {
                throw new Error('Falha ao parar a sessão');
            }
            
        } catch (error) {
            console.error('Failed to stop session:', error);
            this.showError('Erro ao parar a pesquisa.');
        }
    }

    showResults(resultData) {
        this.elements.resultsSection.style.display = 'block';
        this.elements.resultsSection.classList.add('fade-in');
        
        // Update results title and summary
        const searchTerm = resultData.searchTerm || 'Pesquisa';
        const totalResults = resultData.results.total || 0;
        
        this.elements.resultsTitle.textContent = `Resultados para "${searchTerm}"`;
        
        // Generate summary
        const summary = resultData.results.summary || {};
        
        // Count unique locations
        const locations = [...new Set(this.currentResults.map(b => b.searchLocation).filter(Boolean))];
        const locationInfo = locations.length > 1 ? 
            `<span>Localizações: <strong>${locations.length}</strong></span>` : '';
        
        this.elements.resultsSummary.innerHTML = `
            <span><strong>${totalResults}</strong> empresas encontradas</span>
            <span>Avaliação média: <strong>${summary.avgRating || 'N/A'}</strong></span>
            <span>Duração: <strong>${resultData.performance?.durationFormatted || 'N/A'}</strong></span>
            ${locationInfo}
        `;
        
        // Setup tier filters
        this.setupTierFilters();
        
        // Initial filter and display
        this.filteredResults = [...this.currentResults];
        this.displayResults();
        
        // Enable export button
        this.elements.exportResultsBtn.disabled = false;
    }

    hideResults() {
        this.elements.resultsSection.style.display = 'none';
        this.elements.exportResultsBtn.disabled = true;
    }

    setupTierFilters() {
        // Count businesses per tier and location
        const tierCounts = {};
        const locationCounts = {};
        
        this.currentResults.forEach(business => {
            const tier = business.tier || 'Não Avaliado';
            const location = business.searchLocation || 'Default';
            
            tierCounts[tier] = (tierCounts[tier] || 0) + 1;
            locationCounts[location] = (locationCounts[location] || 0) + 1;
        });
        
        // Create filter buttons
        this.elements.tierFilters.innerHTML = '';
        
        // Add "All" filter
        const allBtn = document.createElement('button');
        allBtn.className = 'tier-filter active';
        allBtn.dataset.tier = 'all';
        allBtn.textContent = `Todos (${this.currentResults.length})`;
        allBtn.addEventListener('click', this.handleTierFilter.bind(this));
        this.elements.tierFilters.appendChild(allBtn);
        
        // Add tier-specific filters
        Object.entries(tierCounts).forEach(([tier, count]) => {
            const btn = document.createElement('button');
            btn.className = `tier-filter ${tier.toLowerCase().replace(/\s+/g, '-')}`;
            btn.dataset.tier = tier;
            btn.textContent = `${tier} (${count})`;
            btn.addEventListener('click', this.handleTierFilter.bind(this));
            this.elements.tierFilters.appendChild(btn);
        });
        
        // Add location filters if multiple locations
        if (Object.keys(locationCounts).length > 1) {
            // Add separator
            const separator = document.createElement('div');
            separator.className = 'filter-separator';
            this.elements.tierFilters.appendChild(separator);
            
            // Add location filters
            Object.entries(locationCounts).forEach(([location, count]) => {
                const btn = document.createElement('button');
                btn.className = 'tier-filter location-filter';
                btn.dataset.location = location;
                btn.textContent = `${location} (${count})`;
                btn.addEventListener('click', this.handleLocationFilter.bind(this));
                this.elements.tierFilters.appendChild(btn);
            });
        }
    }

    handleTierFilter(e) {
        // Update active filter
        this.elements.tierFilters.querySelectorAll('.tier-filter').forEach(btn => {
            btn.classList.remove('active');
        });
        e.target.classList.add('active');
        
        // Filter results
        this.filterResults();
    }

    handleLocationFilter(e) {
        // Update active filter
        this.elements.tierFilters.querySelectorAll('.location-filter').forEach(btn => {
            btn.classList.remove('active');
        });
        e.target.classList.add('active');
        
        // Filter results
        this.filterResults();
    }

    filterResults() {
        let filtered = [...this.currentResults];
        
        // Apply tier filter
        const activeTierFilter = this.elements.tierFilters.querySelector('.tier-filter.active:not(.location-filter)');
        if (activeTierFilter && activeTierFilter.dataset.tier !== 'all') {
            const selectedTier = activeTierFilter.dataset.tier;
            filtered = filtered.filter(business => business.tier === selectedTier);
        }
        
        // Apply location filter
        const activeLocationFilter = this.elements.tierFilters.querySelector('.location-filter.active');
        if (activeLocationFilter) {
            const selectedLocation = activeLocationFilter.dataset.location;
            filtered = filtered.filter(business => business.searchLocation === selectedLocation);
        }
        
        // Apply search filter
        const searchTerm = this.elements.resultsSearch.value.toLowerCase().trim();
        if (searchTerm) {
            filtered = filtered.filter(business => 
                business.name.toLowerCase().includes(searchTerm)
            );
        }
        
        this.filteredResults = filtered;
        this.sortResults();
    }

    sortResults() {
        const sortBy = this.elements.sortBy.value;
        const isAscending = this.elements.sortOrder.dataset.order === 'asc';
        
        this.filteredResults.sort((a, b) => {
            let valueA, valueB;
            
            switch (sortBy) {
                case 'compositeScore':
                    valueA = a.compositeScore || 0;
                    valueB = b.compositeScore || 0;
                    break;
                case 'rating':
                    valueA = parseFloat(a.rating?.toString().replace(',', '.') || 0);
                    valueB = parseFloat(b.rating?.toString().replace(',', '.') || 0);
                    break;
                case 'reviewCount':
                    valueA = this.extractReviewCount(a);
                    valueB = this.extractReviewCount(b);
                    break;
                case 'name':
                    valueA = a.name.toLowerCase();
                    valueB = b.name.toLowerCase();
                    return isAscending ? valueA.localeCompare(valueB) : valueB.localeCompare(valueA);
                default:
                    return 0;
            }
            
            if (isAscending) {
                return valueA - valueB;
            } else {
                return valueB - valueA;
            }
        });
        
        this.displayResults();
    }

    extractReviewCount(business) {
        if (business.reviewCount) return business.reviewCount;
        
        const sources = [business.reviewsText, business.reviews];
        for (const source of sources) {
            if (source) {
                const match = source.match(/\d+/);
                if (match) return parseInt(match[0]);
            }
        }
        return 0;
    }

    toggleSortOrder() {
        const currentOrder = this.elements.sortOrder.dataset.order;
        const newOrder = currentOrder === 'asc' ? 'desc' : 'asc';
        
        this.elements.sortOrder.dataset.order = newOrder;
        this.elements.sortOrder.innerHTML = newOrder === 'asc' 
            ? '<i class="fas fa-sort-amount-up"></i>'
            : '<i class="fas fa-sort-amount-down"></i>';
            
        this.sortResults();
    }

    displayResults() {
        const tbody = this.elements.resultsTableBody;
        tbody.innerHTML = '';
        
        if (this.filteredResults.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" class="text-center">
                        <p style="padding: 2rem; color: var(--gray-500);">
                            Nenhum resultado encontrado com os filtros aplicados.
                        </p>
                    </td>
                </tr>
            `;
            return;
        }
        
        this.filteredResults.forEach((business, index) => {
            const row = this.createBusinessRow(business, index + 1);
            tbody.appendChild(row);
        });
    }

    createBusinessRow(business, rank) {
        const row = document.createElement('tr');
        
        // Extract review count for display
        const reviewCount = this.extractReviewCount(business);
        const rating = parseFloat(business.rating?.toString().replace(',', '.') || 0);
        
        // Generate star rating display
        const starRating = rating > 0 ? '★'.repeat(Math.floor(rating)) + (rating % 1 >= 0.5 ? '☆' : '') : '';
        
        // Generate quality indicators
        const indicators = business.qualityIndicators || [];
        const indicatorsHtml = indicators.map(indicator => {
            const className = indicator.toLowerCase().replace(/\s+/g, '-');
            return `<span class="quality-indicator ${className}">${indicator}</span>`;
        }).join('');
        
        // Create business name with link if available
        const businessNameHtml = business.link ? 
            `<a href="${business.link}" target="_blank" class="business-link">${this.escapeHtml(business.name)}</a>` :
            `<div class="business-name">${this.escapeHtml(business.name)}</div>`;
        
        // Adicionar informação de localização se disponível
        const locationInfo = business.searchLocation ? 
            `<div class="search-location">
                <i class="fas fa-map-marker-alt"></i> ${this.escapeHtml(business.searchLocation)}
            </div>` : '';

        row.innerHTML = `
            <td class="rank-col">
                <span class="business-rank">${rank}</span>
            </td>
            <td class="name-col">
                ${businessNameHtml}
                ${locationInfo}
            </td>
            <td class="rating-col">
                <div class="rating-display">
                    <span class="rating-value">${rating || 'N/A'}</span>
                    ${starRating ? `<span class="rating-stars">${starRating}</span>` : ''}
                </div>
            </td>
            <td class="reviews-col">
                <span class="review-count">${reviewCount || 0}</span>
            </td>
            <td class="score-col">
                <span class="composite-score">${business.compositeScore?.toFixed(2) || '0.00'}</span>
            </td>
            <td class="tier-col">
                <span class="tier-badge tier-${(business.tier || 'Não Avaliado').toLowerCase().replace(/\s+/g, '-')}">
                    ${business.tier || 'Não Avaliado'}
                </span>
            </td>
            <td class="address-col">
                <div class="business-address">${this.escapeHtml(business.address || 'Não disponível')}</div>
            </td>
            <td class="indicators-col">
                <div class="quality-indicators">
                    ${indicatorsHtml}
                </div>
            </td>
        `;
        
        return row;
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Import functionality
    showImportModal() {
        this.elements.importModal.classList.add('active');
        this.resetImportModal();
    }

    hideImportModal() {
        this.elements.importModal.classList.remove('active');
    }

    resetImportModal() {
        this.elements.importFile.value = '';
        this.elements.importPreview.style.display = 'none';
        this.elements.confirmImport.disabled = true;
        this.elements.uploadZone.innerHTML = `
            <i class="fas fa-cloud-upload-alt"></i>
            <p>Clique aqui ou arraste um arquivo JSON ou CSV</p>
            <small>Formatos suportados: JSON, CSV</small>
        `;
    }

    handleFileSelect(e) {
        const file = e.target.files[0];
        if (file) {
            this.processFile(file);
        }
    }

    handleDragOver(e) {
        e.preventDefault();
        e.stopPropagation();
        this.elements.uploadZone.classList.add('drag-over');
    }

    handleFileDrop(e) {
        e.preventDefault();
        e.stopPropagation();
        this.elements.uploadZone.classList.remove('drag-over');
        
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            this.elements.importFile.files = files;
            this.processFile(files[0]);
        }
    }

    async processFile(file) {
        try {
            const fileType = file.name.toLowerCase();
            let data;
            
            if (fileType.endsWith('.json')) {
                data = await this.parseJSONFile(file);
            } else if (fileType.endsWith('.csv')) {
                data = await this.parseCSVFile(file);
            } else {
                throw new Error('Formato de arquivo não suportado. Use JSON ou CSV.');
            }
            
            if (data && data.length > 0) {
                this.showImportPreview(data, fileType.endsWith('.json') ? 'JSON' : 'CSV');
            } else {
                throw new Error('Nenhum dado válido encontrado no arquivo.');
            }
            
        } catch (error) {
            console.error('Error processing file:', error);
            this.showError(`Erro ao processar arquivo: ${error.message}`);
            this.resetImportModal();
        }
    }

    async parseJSONFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const jsonData = JSON.parse(e.target.result);
                    
                    // Handle different JSON structures
                    let businesses = [];
                    if (Array.isArray(jsonData)) {
                        businesses = jsonData;
                    } else if (jsonData.results && Array.isArray(jsonData.results)) {
                        businesses = jsonData.results;
                    } else if (jsonData.businesses && Array.isArray(jsonData.businesses)) {
                        businesses = jsonData.businesses;
                    } else {
                        throw new Error('Estrutura JSON não reconhecida');
                    }
                    
                    resolve(businesses);
                } catch (error) {
                    reject(new Error('Arquivo JSON inválido'));
                }
            };
            reader.onerror = () => reject(new Error('Erro ao ler arquivo'));
            reader.readAsText(file);
        });
    }

    async parseCSVFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const csvText = e.target.result;
                    const lines = csvText.split('\n');
                    
                    if (lines.length < 2) {
                        throw new Error('Arquivo CSV muito pequeno');
                    }
                    
                    // Parse headers
                    const headers = this.parseCSVLine(lines[0]);
                    const businesses = [];
                    
                    // Parse data rows
                    for (let i = 1; i < lines.length; i++) {
                        const line = lines[i].trim();
                        if (line) {
                            const values = this.parseCSVLine(line);
                            const business = {};
                            
                            headers.forEach((header, index) => {
                                if (values[index] !== undefined) {
                                    const cleanHeader = header.toLowerCase().trim();
                                    const value = values[index].trim();
                                    
                                    // Map CSV headers to business properties
                                    switch (cleanHeader) {
                                        case 'nome':
                                        case 'name':
                                            business.name = value;
                                            break;
                                        case 'avaliação':
                                        case 'rating':
                                            business.rating = parseFloat(value) || 0;
                                            break;
                                        case 'comentários':
                                        case 'reviews':
                                        case 'reviewcount':
                                            business.reviewCount = parseInt(value) || 0;
                                            break;
                                        case 'endereço':
                                        case 'address':
                                            business.address = value;
                                            break;
                                        case 'pontuação':
                                        case 'score':
                                        case 'compositescore':
                                            business.compositeScore = parseFloat(value) || 0;
                                            break;
                                        case 'categoria':
                                        case 'tier':
                                            business.tier = value;
                                            break;
                                        case 'localização':
                                        case 'searchlocation':
                                            business.searchLocation = value;
                                            break;
                                        default:
                                            business[cleanHeader] = value;
                                    }
                                }
                            });
                            
                            if (business.name) {
                                businesses.push(business);
                            }
                        }
                    }
                    
                    resolve(businesses);
                } catch (error) {
                    reject(new Error('Erro ao processar arquivo CSV'));
                }
            };
            reader.onerror = () => reject(new Error('Erro ao ler arquivo'));
            reader.readAsText(file);
        });
    }

    parseCSVLine(line) {
        const result = [];
        let current = '';
        let inQuotes = false;
        
        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            
            if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
                result.push(current);
                current = '';
            } else {
                current += char;
            }
        }
        
        result.push(current);
        return result.map(item => item.replace(/^"|"$/g, ''));
    }

    showImportPreview(data, format) {
        this.elements.previewCount.textContent = `${data.length} empresas encontradas`;
        this.elements.previewFormat.textContent = `Formato: ${format}`;
        
        // Show preview table
        const tbody = this.elements.previewTableBody;
        tbody.innerHTML = '';
        
        // Show first 5 items as preview
        const previewData = data.slice(0, 5);
        previewData.forEach(business => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${this.escapeHtml(business.name || 'N/A')}</td>
                <td>${business.rating || 'N/A'}</td>
                <td>${business.reviewCount || 0}</td>
                <td>${this.escapeHtml(business.address || 'N/A')}</td>
            `;
            tbody.appendChild(row);
        });
        
        if (data.length > 5) {
            const moreRow = document.createElement('tr');
            moreRow.innerHTML = `<td colspan="4" class="text-center">... e mais ${data.length - 5} empresas</td>`;
            tbody.appendChild(moreRow);
        }
        
        this.elements.importPreview.style.display = 'block';
        this.elements.confirmImport.disabled = false;
        
        // Store data for import
        this.importData = data;
    }

    importResults() {
        if (!this.importData || this.importData.length === 0) {
            this.showError('Nenhum dado para importar.');
            return;
        }
        
        // Set imported data as current results
        this.currentResults = [...this.importData];
        this.filteredResults = [...this.importData];
        
        // Show results
        this.showImportedResults();
        
        // Hide modal
        this.hideImportModal();
        
        this.showSuccess(`Importados ${this.importData.length} resultados com sucesso!`);
    }

    showImportedResults() {
        this.elements.resultsSection.style.display = 'block';
        this.elements.resultsSection.classList.add('fade-in');
        
        // Update results title
        this.elements.resultsTitle.textContent = 'Resultados Importados';
        
        // Generate summary
        const totalResults = this.currentResults.length;
        const avgRating = this.currentResults.reduce((sum, b) => sum + (parseFloat(b.rating) || 0), 0) / totalResults;
        
        this.elements.resultsSummary.innerHTML = `
            <span><strong>${totalResults}</strong> empresas importadas</span>
            <span>Avaliação média: <strong>${avgRating.toFixed(1) || 'N/A'}</strong></span>
        `;
        
        // Setup tier filters
        this.setupTierFilters();
        
        // Display results
        this.displayResults();
        
        // Enable export button
        this.elements.exportResultsBtn.disabled = false;
    }

    // Modal management
    hideModal(modal) {
        modal.classList.remove('active');
    }

    hideAllModals() {
        this.elements.exportModal.classList.remove('active');
        this.elements.importModal.classList.remove('active');
    }

    showExportModal() {
        if (this.currentResults.length === 0) {
            this.showError('Nenhum resultado para exportar.');
            return;
        }
        
        this.elements.exportModal.classList.add('active');
    }

    async exportResults() {
        try {
            const selectedFormat = document.querySelector('input[name="exportFormat"]:checked').value;
            const includeMetadata = document.getElementById('includeMetadata').checked;
            const includeScoreBreakdown = document.getElementById('includeScoreBreakdown').checked;
            const includeOnlyFiltered = document.getElementById('includeOnlyFiltered').checked;
            
            // Determine which results to export
            const resultsToExport = includeOnlyFiltered ? this.filteredResults : this.currentResults;
            
            if (resultsToExport.length === 0) {
                this.showError('Nenhum resultado para exportar.');
                return;
            }
            
            // Prepare export data
            const exportData = {
                results: resultsToExport,
                format: selectedFormat,
                options: {
                    includeMetadata,
                    includeScoreBreakdown
                }
            };
            
            // Generate filename
            const timestamp = new Date().toISOString().slice(0, 19).replace(/[:.]/g, '-');
            const searchTerm = this.elements.searchInput.value.trim().replace(/[^a-zA-Z0-9]/g, '_');
            const filename = `${searchTerm}_${timestamp}.${selectedFormat}`;
            
            // Create and download file
            let content, mimeType;
            
            if (selectedFormat === 'json') {
                content = JSON.stringify(exportData, null, 2);
                mimeType = 'application/json';
            } else {
                content = this.convertToCSV(resultsToExport, includeScoreBreakdown);
                mimeType = 'text/csv';
            }
            
            this.downloadFile(content, filename, mimeType);
            this.hideModal(this.elements.exportModal);
            this.showSuccess('Resultados exportados com sucesso!');
            
        } catch (error) {
            console.error('Export failed:', error);
            this.showError('Erro ao exportar resultados.');
        }
    }

    convertToCSV(results, includeScoreBreakdown) {
        const headers = ['Rank', 'Nome', 'Avaliação', 'Número de Avaliações', 'Pontuação Composta', 'Categoria', 'Localização de Busca'];
        
        if (includeScoreBreakdown) {
            headers.push('Detalhamento da Pontuação');
        }
        
        const rows = [headers];
        
        results.forEach((business, index) => {
            const row = [
                index + 1,
                business.name,
                business.rating || '',
                this.extractReviewCount(business),
                business.compositeScore?.toFixed(2) || '0.00',
                business.tier || 'Unrated',
                business.searchLocation || 'N/A'
            ];
            
            if (includeScoreBreakdown && business.scoreBreakdown) {
                const breakdown = business.scoreBreakdown;
                row.push(`Rating: ${breakdown.rating}, Reviews: ${breakdown.reviewCount}, Log Factor: ${breakdown.logFactor?.toFixed(2)}`);
            }
            
            rows.push(row);
        });
        
        return rows.map(row => 
            row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')
        ).join('\n');
    }

    downloadFile(content, filename, mimeType) {
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        
        // Cleanup
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    // Utility functions
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    showError(message) {
        this.showNotification(message, 'error');
    }

    showSuccess(message) {
        this.showNotification(message, 'success');
    }

    showInfo(message) {
        this.showNotification(message, 'info');
    }

    showNotification(message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.innerHTML = `
            <div class="notification-content">
                <i class="fas ${this.getNotificationIcon(type)}"></i>
                <span>${message}</span>
                <button class="notification-close">&times;</button>
            </div>
        `;
        
        // Add to page
        document.body.appendChild(notification);
        
        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, 5000);
        
        // Manual close
        notification.querySelector('.notification-close').addEventListener('click', () => {
            notification.remove();
        });
    }

    getNotificationIcon(type) {
        const icons = {
            error: 'fa-exclamation-circle',
            success: 'fa-check-circle',
            info: 'fa-info-circle',
            warning: 'fa-exclamation-triangle'
        };
        return icons[type] || icons.info;
    }

    // Search history functions
    saveToSearchHistory(searchTerm, options) {
        try {
            const history = this.getSearchHistory();
            const entry = {
                searchTerm,
                options,
                timestamp: new Date().toISOString()
            };
            
            history.unshift(entry);
            
            // Keep only last 10 searches
            const trimmedHistory = history.slice(0, 10);
            localStorage.setItem('mapsBusinessFinder_searchHistory', JSON.stringify(trimmedHistory));
            
        } catch (error) {
            console.warn('Failed to save search history:', error);
        }
    }

    getSearchHistory() {
        try {
            const history = localStorage.getItem('mapsBusinessFinder_searchHistory');
            return history ? JSON.parse(history) : [];
        } catch (error) {
            console.warn('Failed to load search history:', error);
            return [];
        }
    }

    loadSearchHistory() {
        // This could be used to populate a search history dropdown
        const history = this.getSearchHistory();
        console.log('Loaded search history:', history);
    }
}

// Autocomplete de endereço com Photon
(function() {
  const addressInput = document.getElementById('addressSearchInput');
  const suggestionsList = document.getElementById('addressSuggestions');
  const addressLoading = document.getElementById('addressLoading');
  const form = document.getElementById('addressSearchForm');
  const selectedAddressesContainer = document.getElementById('selectedAddresses');
  const selectedAddressCount = document.getElementById('selectedAddressCount');
  const addressChips = document.getElementById('addressChips');
  const clearAllAddressesBtn = document.getElementById('clearAllAddresses');
  
  let debounceTimeout = null;
  let lastResults = [];
  let selectedAddresses = []; // Array para armazenar múltiplos endereços selecionados

  function showLoading() {
    addressLoading.style.display = 'block';
  }

  function hideLoading() {
    addressLoading.style.display = 'none';
  }

  function clearSuggestions() {
    suggestionsList.innerHTML = '';
    suggestionsList.style.display = 'none';
    lastResults = [];
  }

  function showSuggestions(results) {
    // Limpar apenas o HTML, não os dados
    suggestionsList.innerHTML = '';
    suggestionsList.style.display = 'none';
    
    if (!results.length) return;
    
    // Atualizar lastResults com os novos dados
    lastResults = results;
    
    results.forEach((item, idx) => {
      const li = document.createElement('li');
      // Exibir endereço completo
      let label = item.label;
      if (item.city || item.state || item.country) {
        const parts = [item.city, item.state, item.country].filter(Boolean);
        label += ' (' + parts.join(', ') + ')';
      }
      li.textContent = label;
      li.tabIndex = 0;
      li.style.padding = '8px';
      li.style.cursor = 'pointer';
      li.style.borderBottom = '1px solid #eee';
      
      // Adicionar hover effect
      li.addEventListener('mouseenter', function() {
        this.style.backgroundColor = '#f3f4f6';
      });
      
      li.addEventListener('mouseleave', function() {
        this.style.backgroundColor = '';
      });
      
      // Evento de clique simplificado
      li.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        selectSuggestion(idx);
      });
      
      // Evento de teclado
      li.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          selectSuggestion(idx);
        }
      });
      
      suggestionsList.appendChild(li);
    });
    suggestionsList.style.display = 'block';
  }

  function selectSuggestion(idx) {
    console.log('selectSuggestion called with idx:', idx);
    const item = lastResults[idx];
    if (!item) {
      console.log('No item found at index:', idx);
      return;
    }
    
    console.log('Selected item:', item);
    
    // Verificar se o endereço já foi selecionado
    const addressExists = selectedAddresses.some(addr => 
      addr.lat === item.lat && addr.lon === item.lon
    );
    
    if (addressExists) {
      console.log('Address already selected');
      return;
    }
    
    // Adicionar o endereço à lista
    const newAddress = {
      id: Date.now() + Math.random().toString(36).substr(2, 9),
      lat: item.lat,
      lon: item.lon,
      address: item.label,
      city: item.city,
      state: item.state,
      country: item.country
    };
    
    selectedAddresses.push(newAddress);
    
    // Limpar input e sugestões
    addressInput.value = '';
    clearSuggestions();
    
    // Atualizar interface
    updateSelectedAddressesDisplay();
    
    console.log('Address added:', newAddress);
    console.log('Total addresses:', selectedAddresses);
  }

  function updateSelectedAddressesDisplay() {
    if (selectedAddresses.length === 0) {
      selectedAddressesContainer.style.display = 'none';
      return;
    }
    
    selectedAddressesContainer.style.display = 'block';
    selectedAddressCount.textContent = `${selectedAddresses.length} endereço${selectedAddresses.length > 1 ? 's' : ''} selecionado${selectedAddresses.length > 1 ? 's' : ''}`;
    
    // Limpar chips existentes
    addressChips.innerHTML = '';
    
    // Criar chips para cada endereço
    selectedAddresses.forEach((address, index) => {
      const chip = document.createElement('div');
      chip.className = 'address-chip';
      
      const icon = document.createElement('i');
      icon.className = 'fas fa-map-marker-alt';
      
      const text = document.createElement('span');
      text.textContent = address.address;
      
      const removeBtn = document.createElement('button');
      removeBtn.innerHTML = '<i class="fas fa-times"></i>';
      removeBtn.title = 'Remover endereço';
      removeBtn.addEventListener('click', (e) => {
        e.preventDefault();
        removeAddress(address.id);
      });
      
      chip.appendChild(icon);
      chip.appendChild(text);
      chip.appendChild(removeBtn);
      addressChips.appendChild(chip);
    });
  }

  function removeAddress(addressId) {
    selectedAddresses = selectedAddresses.filter(addr => addr.id !== addressId);
    updateSelectedAddressesDisplay();
    console.log('Address removed. Total addresses:', selectedAddresses);
  }

  function clearAllAddresses() {
    selectedAddresses = [];
    updateSelectedAddressesDisplay();
    console.log('All addresses cleared');
  }

  addressInput.addEventListener('input', function() {
    const value = addressInput.value.trim();
    if (debounceTimeout) clearTimeout(debounceTimeout);
    if (!value) {
      clearSuggestions();
      return;
    }
    
    debounceTimeout = setTimeout(() => {
      showLoading();
      fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(value)}&limit=5`)
        .then(r => {
          if (!r.ok) {
            throw new Error(`HTTP ${r.status}: ${r.statusText}`);
          }
          return r.json();
        })
        .then(data => {
          hideLoading();
          if (!data || !data.features) {
            clearSuggestions();
            return;
          }
          lastResults = data.features.map(f => ({
            label: f.properties.label || f.properties.name,
            lat: f.geometry.coordinates[1],
            lon: f.geometry.coordinates[0],
            city: f.properties.city || f.properties.name,
            state: f.properties.state,
            country: f.properties.country
          }));
          showSuggestions(lastResults);
        })
        .catch(error => {
          hideLoading();
          console.error('Photon API error:', error);
          clearSuggestions();
        });
    }, 300);
  });

  addressInput.addEventListener('blur', function() {
    // Aumentar o delay para dar tempo de clicar nas sugestões
    setTimeout(() => {
      // Só limpar se não houver um item sendo clicado
      const activeElement = document.activeElement;
      if (!activeElement || !activeElement.closest('#addressSuggestions')) {
        clearSuggestions();
      }
    }, 300);
  });

  // Adicionar event listener apenas se o form existir
  if (form) {
    form.addEventListener('submit', function(e) {
      e.preventDefault();
      if (lastResults.length > 0) {
        selectSuggestion(0);
      }
    });
  }

  // Event listener para limpar todos os endereços
  if (clearAllAddressesBtn) {
    clearAllAddressesBtn.addEventListener('click', function(e) {
      e.preventDefault();
      clearAllAddresses();
    });
  }

  // Expor as coordenadas selecionadas para o app principal
  window.getSelectedAddressCoordinates = function() {
    return selectedAddresses.length > 0 ? selectedAddresses : null;
  };

  // Função para limpar as coordenadas selecionadas
  window.clearSelectedAddress = function() {
    selectedAddresses = [];
    addressInput.value = '';
    updateSelectedAddressesDisplay();
  };

  // Expor funções para debug
  window.addressAutocomplete = {
    selectSuggestion: selectSuggestion,
    getLastResults: () => lastResults,
    setLastResults: (results) => { lastResults = results; }
  };
})();

// CSS for notifications (add to styles.css if needed)
const notificationStyles = `
.notification {
    position: fixed;
    top: 20px;
    right: 20px;
    max-width: 400px;
    z-index: 1050;
    animation: slideInRight 0.3s ease-out;
}

.notification-content {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 1rem;
    border-radius: var(--border-radius);
    box-shadow: var(--shadow-lg);
    color: white;
    font-weight: 500;
}

.notification-error .notification-content {
    background: var(--error-color);
}

.notification-success .notification-content {
    background: var(--success-color);
}

.notification-info .notification-content {
    background: var(--info-color);
}

.notification-warning .notification-content {
    background: var(--warning-color);
}

.notification-close {
    background: none;
    border: none;
    color: white;
    font-size: 1.2rem;
    cursor: pointer;
    padding: 0;
    margin-left: auto;
}

@keyframes slideInRight {
    from {
        transform: translateX(100%);
        opacity: 0;
    }
    to {
        transform: translateX(0);
        opacity: 1;
    }
}
`;

// Add notification styles to page
if (!document.querySelector('#notification-styles')) {
    const style = document.createElement('style');
    style.id = 'notification-styles';
    style.textContent = notificationStyles;
    document.head.appendChild(style);
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.mapBusinessFinderApp = new MapBusinessFinderApp();
});