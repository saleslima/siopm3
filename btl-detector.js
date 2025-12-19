// BTL Detection based on GeoJSON polygon maps
import L from 'https://esm.sh/leaflet@1.9.4';
import { getData } from './database.js';

// Fix Leaflet's default icon path issues with CDN
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

let btlPolygons = null;
let map = null;
let marker = null;
let currentPolygonLayer = null;

function updateMap(lat, lon) {
    const mapDiv = document.getElementById('btlMap');
    if (!mapDiv) return;

    mapDiv.style.display = 'block';

    if (!map) {
        map = L.map('btlMap').setView([lat, lon], 15);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors'
        }).addTo(map);
    } else {
        map.setView([lat, lon], 15);
        map.invalidateSize();
    }

    if (marker) {
        marker.setLatLng([lat, lon]);
    } else {
        marker = L.marker([lat, lon]).addTo(map);
    }
}

function updateMapPolygon(geojson) {
    if (!map) return;

    if (currentPolygonLayer) {
        map.removeLayer(currentPolygonLayer);
        currentPolygonLayer = null;
    }

    if (geojson) {
        currentPolygonLayer = L.geoJSON(geojson, {
            style: {
                color: '#3388ff',
                weight: 2,
                opacity: 0.6,
                fillOpacity: 0.1
            }
        }).addTo(map);
    }
}

// GeoJSON file mapping for each BTL - Using unique files from assets
export const BTL_FILES = {
    '01º BPM/M': '1.BPM_M (3).geojson',
    '02º BPM/M': '2.BPM_M (3).geojson',
    '03º BPM/M': '3.BPM_M (5).geojson',
    '04º BPM/M': '4.BPM_M.geojson',
    '05º BPM/M': '5.BPM_M.geojson',
    '06º BPM/M': '6.BPM_M.geojson',
    '07º BPM/M': '7.BPM_M (8).geojson',
    '08º BPM/M': '8.BPM_M.geojson',
    '09º BPM/M': '9.BPM_M.geojson',
    '10º BPM/M': '10.BPM_M.geojson',
    '11º BPM/M': '11.BPM_M (6).geojson',
    '12º BPM/M': '12.BPM_M.geojson',
    '13º BPM/M': '13.BPM_M (6).geojson',
    '14º BPM/M': '14.BPM_M.geojson',
    '15º BPM/M': '15.BPM_M.geojson',
    '16º BPM/M': '16.BPM_M.geojson',
    '17º BPM/M': '17.BPM_M.geojson',
    '18º BPM/M': '18.BPM_M.geojson',
    '19º BPM/M': '19.BPM_M.geojson',
    '20º BPM/M': '20.BPM_M.geojson',
    '21º BPM/M': '21.BPM_M.geojson',
    '22º BPM/M': '22.BPM_M (4).geojson',
    '23º BPM/M': '23.BPM_M.geojson',
    '24º BPM/M': '24.BPM_M.geojson',
    '25º BPM/M': '25.BPM_M.geojson',
    '26º BPM/M': '26.BPM_M.geojson',
    '27º BPM/M': '27.BPM_M.geojson',
    '28º BPM/M': '28.BPM_M (4).geojson',
    '29º BPM/M': '29.BPM_M.geojson',
    '30º BPM/M': '30.BPM_M.geojson',
    '31º BPM/M': '31.BPM_M.geojson',
    '32º BPM/M': '32.BPM_M.geojson',
    '33º BPM/M': '33.BPM_M.geojson',
    '35º BPM/M': '35.BPM_M.geojson',
    '36º BPM/M': '36.BPM_M.geojson',
    '37º BPM/M': '37.BPM_M.geojson',
    '38º BPM/M': '38.BPM_M.geojson',
    '39º BPM/M': '39.BPM_M.geojson',
    '43º BPM/M': '43.BPM_M.geojson',
    '46º BPM/M': '46.BPM_M.geojson',
    '48º BPM/M': '48.BPM_M.geojson',
    '49º BPM/M': '49.BPM_M.geojson'
};

async function findHistoricalBTL(rua, numero, municipio) {
    if (!rua || !numero) return null;
    
    try {
        const atendimentos = await getData('atendimentos');
        if (!atendimentos) return null;

        const ruaSearch = rua.toUpperCase().trim();
        const numeroSearch = numero.toUpperCase().trim();
        const municipioSearch = municipio ? municipio.toUpperCase().trim() : '';

        // Sort occurrences by date descending to find most recent
        const entries = Object.values(atendimentos).sort((a, b) => b.timestamp - a.timestamp);

        for (const atendimento of entries) {
            if (!atendimento.rua || !atendimento.numero || !atendimento.btl) continue;
            
            const r = atendimento.rua.toUpperCase().trim();
            const n = atendimento.numero.toUpperCase().trim();
            
            if (r === ruaSearch && n === numeroSearch) {
                // If municipio is present in both, verify match
                if (municipioSearch && atendimento.municipio) {
                    if (atendimento.municipio.toUpperCase().trim() === municipioSearch) {
                        return atendimento.btl;
                    }
                } else {
                    // Weak match (no municipality check) - accept if just street/num matched
                    return atendimento.btl;
                }
            }
        }
        return null;
    } catch (error) {
        console.error('Error finding historical BTL:', error);
        return null;
    }
}

async function loadBTLPolygons() {
    if (btlPolygons) return btlPolygons;

    try {
        console.log('\n=== ARQUIVOS GEOJSON USADOS NO CÓDIGO ===\n');
        console.log('📁 ARQUIVOS GEOJSON (usados em btl-detector.js para detecção automática de BTL):\n');
        Object.entries(BTL_FILES).forEach(([btl, filename]) => {
            console.log(`  ✓ ${btl}: ${filename}`);
        });
        console.log(`\n📊 Total de arquivos GeoJSON em uso: ${Object.keys(BTL_FILES).length}`);
        console.log('\n================================================\n');

        btlPolygons = {};

        for (const [btl, filename] of Object.entries(BTL_FILES)) {
            try {
                const response = await fetch(`/${filename}`);
                if (response.ok) {
                    btlPolygons[btl] = await response.json();
                } else {
                    console.warn(`Could not load ${filename}`);
                }
            } catch (err) {
                console.warn(`Error loading ${filename}:`, err);
            }
        }

        return btlPolygons;
    } catch (error) {
        console.error('Error loading BTL polygons:', error);
        return null;
    }
}

function pointInPolygon(point, polygon) {
    const [x, y] = point;
    let inside = false;

    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        const [xi, yi] = polygon[i];
        const [xj, yj] = polygon[j];

        const intersect = ((yi > y) !== (yj > y))
            && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
        if (intersect) inside = !inside;
    }

    return inside;
}

function checkPointInGeoJSON(lat, lon, geojson) {
    if (!geojson || !geojson.features) return false;

    for (const feature of geojson.features) {
        if (feature.geometry.type === 'Polygon') {
            for (const ring of feature.geometry.coordinates) {
                if (pointInPolygon([lon, lat], ring)) {
                    return true;
                }
            }
        } else if (feature.geometry.type === 'MultiPolygon') {
            for (const polygon of feature.geometry.coordinates) {
                for (const ring of polygon) {
                    if (pointInPolygon([lon, lat], ring)) {
                        return true;
                    }
                }
            }
        }
    }

    return false;
}

export async function detectBTLFromAddress(rua, numero, municipio, estado) {
    const btlSelect = document.getElementById('btl');
    const btlStatus = document.getElementById('btlStatus');
    const btlMap = document.getElementById('btlMap');

    if (btlMap) btlMap.style.display = 'none'; // Reset visibility at start of detection

    if (!btlStatus) return;

    btlStatus.textContent = 'Detectando BTL...';
    btlStatus.style.color = '#666';

    try {
        // 1. Check Historical Data First
        const historicalBTL = await findHistoricalBTL(rua, numero, municipio);
        
        if (historicalBTL) {
            btlSelect.value = historicalBTL;
            btlStatus.textContent = `BTL Histórico: ${historicalBTL}`;
            btlStatus.style.color = '#1976d2';
        }

        // 2. Geocode the address (for map and backup detection)
        let address;
        if (numero) {
            address = `${rua}, ${numero}, ${municipio}, ${estado}, Brasil`;
        } else {
            address = `${rua}, ${municipio}, ${estado}, Brasil`;
        }

        const geocodeUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}`;

        const response = await fetch(geocodeUrl, {
            headers: {
                'User-Agent': 'COPOM-APP'
            }
        });

        const results = await response.json();

        if (results.length === 0) {
            if (!historicalBTL) {
                btlStatus.textContent = 'Endereço não encontrado no mapa';
                btlStatus.style.color = '#ff9800';
            }
            return;
        }

        const lat = parseFloat(results[0].lat);
        const lon = parseFloat(results[0].lon);

        updateMap(lat, lon);

        // Load BTL polygons
        const polygons = await loadBTLPolygons();

        if (!polygons) {
            if (!historicalBTL) {
                btlStatus.textContent = 'Erro ao carregar mapas';
                btlStatus.style.color = '#d32f2f';
            }
            return;
        }

        // Check which BTL the point falls into
        let mapBTL = null;
        for (const [btl, geojson] of Object.entries(polygons)) {
            if (checkPointInGeoJSON(lat, lon, geojson)) {
                mapBTL = btl;
                break;
            }
        }

        // Decision logic: Historical takes precedence over Map if available
        let finalBTL = historicalBTL || mapBTL;

        if (finalBTL) {
            btlSelect.value = finalBTL;
            
            if (historicalBTL) {
                btlStatus.textContent = `BTL Histórico: ${historicalBTL}`;
                btlStatus.style.color = '#1976d2';
            } else {
                btlStatus.textContent = `BTL Detectado: ${mapBTL}`;
                btlStatus.style.color = '#388e3c';
            }
            
            // Show polygon for the selected BTL (whether historical or map)
            if (polygons[finalBTL]) {
                updateMapPolygon(polygons[finalBTL]);
            }
        } else {
            btlStatus.textContent = 'BTL não identificado automaticamente';
            btlStatus.style.color = '#ff9800';
            
            if (currentPolygonLayer && map) {
                map.removeLayer(currentPolygonLayer);
                currentPolygonLayer = null;
            }
        }

    } catch (error) {
        console.error('Error detecting BTL:', error);
        btlStatus.textContent = 'Erro na detecção';
        btlStatus.style.color = '#d32f2f';
    }
}