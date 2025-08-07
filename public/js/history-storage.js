class HistoryStorage {
  constructor() {
    this.dbName = 'MapsBusinessFinderDB';
    this.storeName = 'extractions';
    this.db = null;
    this.DB_VERSION = 1;
    this.MAX_RECORDS = 100; // Limite de registros para auto-limpeza
  }

  /**
   * Inicializa o banco de dados IndexedDB.
   * @returns {Promise<void>}
   */
  async initDB() {
    return new Promise((resolve, reject) => {
      if (this.db) {
        resolve();
        return;
      }

      const request = indexedDB.open(this.dbName, this.DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          db.createObjectStore(this.storeName, { keyPath: 'id' });
        }
      };

      request.onsuccess = (event) => {
        this.db = event.target.result;
        console.log('IndexedDB inicializado com sucesso.');
        resolve();
      };

      request.onerror = (event) => {
        console.error('Erro ao inicializar IndexedDB:', event.target.error);
        reject(event.target.error);
      };
    });
  }

  /**
   * Valida os dados de extração antes de salvar.
   * @param {object} data - Dados da extração.
   * @returns {boolean} - True se os dados são válidos, false caso contrário.
   */
  validateExtractionData(data) {
      // Validação mais flexível para permitir dados históricos
      if (!data.searchTerm || typeof data.searchTerm !== 'string') {
          console.warn(
              'Validação: searchTerm não fornecido, usando valor padrão.'
          );
          data.searchTerm = 'Busca sem termo';
      }
      if (!data.searchLocation || typeof data.searchLocation !== 'string') {
          console.warn(
              'Validação: searchLocation não fornecido, usando valor padrão.'
          );
          data.searchLocation = 'Localização Padrão';
      }
      if (typeof data.totalResults !== 'number' || data.totalResults < 0) {
          console.error(
              'Validação falhou: totalResults é obrigatório e deve ser um número não negativo.'
          );
          return false;
      }
      if (
          typeof data.avgRating !== 'number' ||
          data.avgRating < 0 ||
          data.avgRating > 5
      ) {
          console.warn('Validação: avgRating inválido, usando valor padrão.');
          data.avgRating = 0;
      }
      if (!Array.isArray(data.results)) {
          console.error(
              'Validação falhou: results é obrigatório e deve ser um array.'
          );
          return false;
      }
      return true;
  }

  /**
   * Gera um UUID v4.
   * @returns {string} - Um UUID v4 único.
   */
  generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  /**
   * Persiste uma nova extração no IndexedDB.
   * @param {object} data - Os dados da extração a serem salvos.
   * @returns {Promise<string>} - Promise que resolve com o ID da extração salva.
   */
  async saveExtraction(data) {
    await this.initDB();

    if (!this.validateExtractionData(data)) {
      throw new Error('Dados de extração inválidos.');
    }

    const newId = this.generateUUID();
    const timestamp = new Date().toISOString();
    const extractionToSave = { ...data, id: newId, timestamp };

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.add(extractionToSave);

      request.onsuccess = () => {
        console.log('Extração salva com sucesso:', extractionToSave.id);
        this.cleanupOldExtractions().catch(console.error); // Limpa registros antigos em segundo plano
        resolve(extractionToSave.id);
      };

      request.onerror = (event) => {
        console.error('Erro ao salvar extração:', event.target.error);
        reject(event.target.error);
      };
    });
  }

  /**
   * Recupera todas as extrações do IndexedDB, ordenadas por timestamp.
   * @returns {Promise<Array<object>>} - Promise que resolve com um array de extrações.
   */
  async getAllExtractions() {
    await this.initDB();
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.getAll();

      request.onsuccess = (event) => {
        const allExtractions = event.target.result;
        // Ordena as extrações do mais recente para o mais antigo, se houver timestamp
        const sortedExtractions = allExtractions.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        resolve(sortedExtractions);
      };

      request.onerror = (event) => {
        console.error('Erro ao recuperar extrações:', event.target.error);
        reject(event.target.error);
      };
    });
  }

  /**
   * Busca uma extração específica pelo seu ID.
   * @param {string} id - O ID da extração.
   * @returns {Promise<object|undefined>} - Promise que resolve com a extração ou undefined se não encontrada.
   */
  async getExtractionById(id) {
    await this.initDB();
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.get(id);

      request.onsuccess = (event) => {
        resolve(event.target.result);
      };

      request.onerror = (event) => {
        console.error('Erro ao buscar extração por ID:', event.target.error);
        reject(event.target.error);
      };
    });
  }

  /**
   * Remove uma extração pelo seu ID.
   * @param {string} id - O ID da extração a ser removida.
   * @returns {Promise<void>}
   */
  async deleteExtraction(id) {
    await this.initDB();
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.delete(id);

      request.onsuccess = () => {
        console.log('Extração removida com sucesso:', id);
        resolve();
      };

      request.onerror = (event) => {
        console.error('Erro ao remover extração:', event.target.error);
        reject(event.target.error);
      };
    });
  }

  /**
   * Limpa as extrações mais antigas, mantendo apenas o limite MAX_RECORDS.
   * Implementa a lógica FIFO (First-In, First-Out).
   * @returns {Promise<void>}
   */
  async cleanupOldExtractions() {
    await this.initDB();
    const allExtractions = await this.getAllExtractions(); // getAllExtractions já retorna ordenado
    
    if (allExtractions.length > this.MAX_RECORDS) {
      const oldExtractionsToRemove = allExtractions.slice(this.MAX_RECORDS);
      console.log(`Iniciando limpeza: removendo ${oldExtractionsToRemove.length} extrações antigas.`);
      
      const deletePromises = oldExtractionsToRemove.map(ext => this.deleteExtraction(ext.id));
      await Promise.all(deletePromises);
      console.log('Limpeza de extrações antigas concluída.');
    }
  }
}

// Exporta uma instância única para uso em toda a aplicação
// Isso garante que apenas uma conexão com o banco de dados seja mantida.
const historyStorage = new HistoryStorage();