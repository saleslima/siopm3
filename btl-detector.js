// BTL Detection based on GeoJSON polygon maps

let btlPolygons = null;

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

    if (!btlStatus) return;

    btlStatus.textContent = 'Detectando BTL...';
    btlStatus.style.color = '#666';

    try {
        // Geocode the address
        const address = `${rua}, ${numero}, ${municipio}, ${estado}, Brasil`;
        const geocodeUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}`;

        const response = await fetch(geocodeUrl, {
            headers: {
                'User-Agent': 'COPOM-APP'
            }
        });

        const results = await response.json();

        if (results.length === 0) {
            btlStatus.textContent = 'Endereço não encontrado';
            btlStatus.style.color = '#ff9800';
            return;
        }

        const lat = parseFloat(results[0].lat);
        const lon = parseFloat(results[0].lon);

        // Load BTL polygons
        const polygons = await loadBTLPolygons();

        if (!polygons) {
            btlStatus.textContent = 'Erro ao carregar mapas';
            btlStatus.style.color = '#d32f2f';
            return;
        }

        // Check which BTL the point falls into
        let detectedBTL = null;

        for (const [btl, geojson] of Object.entries(polygons)) {
            if (checkPointInGeoJSON(lat, lon, geojson)) {
                detectedBTL = btl;
                break;
            }
        }

        if (detectedBTL) {
            btlSelect.value = detectedBTL;
            btlStatus.textContent = ` BTL detectado: ${detectedBTL}`;
            btlStatus.style.color = '#388e3c';
        } else {
            btlStatus.textContent = 'BTL não identificado automaticamente';
            btlStatus.style.color = '#ff9800';
        }

    } catch (error) {
        console.error('Error detecting BTL:', error);
        btlStatus.textContent = 'Erro na detecção';
        btlStatus.style.color = '#d32f2f';
    }
}