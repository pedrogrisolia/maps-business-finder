/**
 * Utilitários para cálculos geográficos
 */

/**
 * Calcular distância entre duas coordenadas usando fórmula de Haversine
 * @param {number} lat1 - Latitude do ponto 1
 * @param {number} lng1 - Longitude do ponto 1  
 * @param {number} lat2 - Latitude do ponto 2
 * @param {number} lng2 - Longitude do ponto 2
 * @returns {number} Distância em quilômetros com 2 casas decimais
 */
function calculateDistance(lat1, lng1, lat2, lng2) {
    // Validar coordenadas
    if (!isValidCoordinate(lat1) || !isValidCoordinate(lng1) || 
        !isValidCoordinate(lat2) || !isValidCoordinate(lng2)) {
        return null;
    }

    const R = 6371; // Raio da Terra em km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) + 
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
              Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const distance = R * c;
    
    return Math.round(distance * 100) / 100; // 2 casas decimais
}

/**
 * Validar se uma coordenada é válida
 * @param {*} coord - Coordenada a ser validada
 * @returns {boolean} True se válida
 */
function isValidCoordinate(coord) {
    return typeof coord === 'number' &&
           !isNaN(coord) &&
           isFinite(coord);
}

/**
 * Extrair coordenadas de diferentes formatos de dados
 * @param {Object} business - Dados da empresa
 * @returns {Object|null} {lat, lng} ou null se não encontradas
 */
function extractCoordinates(business) {
    // Tentar diferentes propriedades onde coordenadas podem estar
    const sources = [
        business.coordinates,
        business.coords,
        business.location,
        business.position
    ];

    for (const source of sources) {
        if (source && typeof source === 'object') {
            const lat = source.lat || source.latitude;
            const lng = source.lng || source.lon || source.longitude;
            
            if (isValidCoordinate(lat) && isValidCoordinate(lng)) {
                return { lat, lng };
            }
        }
    }

    // Tentar propriedades diretas
    if (isValidCoordinate(business.lat) && isValidCoordinate(business.lng)) {
        return { lat: business.lat, lng: business.lng };
    }
    
    if (isValidCoordinate(business.latitude) && isValidCoordinate(business.longitude)) {
        return { lat: business.latitude, lng: business.longitude };
    }

    return null;
}

module.exports = {
    calculateDistance,
    isValidCoordinate,
    extractCoordinates
};