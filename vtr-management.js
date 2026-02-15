import { getData } from './database.js';
import { getCurrentUser } from './auth.js';

export async function loadVTRPanels(btlNumber) {
    try {
        const vtrsDisponiveis = await getData('vtrsDisponiveis') || {};
        const vtrAssignments = await getData('vtrAssignments') || {};
        const atendimentos = await getData('atendimentos') || {};

        const assignedVTRNumbers = new Set(Object.values(vtrAssignments).map(v => v.vtrNumber));

        let btlPrefix = btlNumber.substring(0, 2);

        if (window.selectedBTL) {
            btlPrefix = window.selectedBTL.substring(0, 2);
        }

        const availableVTRs = Object.entries(vtrsDisponiveis)
            .filter(([key, vtr]) => {
                if (assignedVTRNumbers.has(vtr.vtrNumber)) return false;

                const vtrPrefix = vtr.vtrNumber.substring(0, 2);
                return vtrPrefix === btlPrefix;
            })
            .sort((a, b) => {
                const statusA = a[1].status || 'DISPONIVEL';
                const statusB = b[1].status || 'DISPONIVEL';
                
                // Priority: DISPONIVEL and RONDA ESCOLAR first
                const priorityA = (statusA === 'DISPONIVEL' || statusA === 'RONDA ESCOLAR') ? 0 : 1;
                const priorityB = (statusB === 'DISPONIVEL' || statusB === 'RONDA ESCOLAR') ? 0 : 1;
                
                if (priorityA !== priorityB) return priorityA - priorityB;
                
                return a[1].vtrNumber.localeCompare(b[1].vtrNumber);
            });

        const vtrDisponiveisContent = document.getElementById('vtrDisponiveisContent');
        
        // Add filter dropdown if not exists
        const vtrPanelRight = document.getElementById('vtrDisponiveis');
        let filterSelect = document.getElementById('vtrStatusFilter');
        if (!filterSelect && vtrPanelRight) {
            const filterContainer = document.createElement('div');
            filterContainer.style.cssText = 'margin-bottom: 10px;';
            filterContainer.innerHTML = `
                <select id="vtrStatusFilter" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 13px;">
                    <option value="TODAS">Exibir Todas</option>
                    <option value="DISPONIVEL">Somente Disponíveis</option>
                </select>
            `;
            vtrPanelRight.insertBefore(filterContainer, vtrDisponiveisContent);
            filterSelect = document.getElementById('vtrStatusFilter');
            
            filterSelect.addEventListener('change', async () => {
                await loadVTRPanels(btlNumber);
            });
        }
        
        const filterValue = filterSelect ? filterSelect.value : 'TODAS';
        
        let filteredVTRs = availableVTRs;
        if (filterValue === 'DISPONIVEL') {
            filteredVTRs = availableVTRs.filter(([key, vtr]) => vtr.status === 'DISPONIVEL');
        }
        
        if (filteredVTRs.length === 0) {
            vtrDisponiveisContent.innerHTML = '<p class="no-vtrs">Nenhuma VTR disponível</p>';
        } else {
            let html = '';
            filteredVTRs.forEach(([key, vtr]) => {
                const status = vtr.status || 'DISPONIVEL';
                const statusClass = `vtr-status-${status.toLowerCase().replace(/\s+/g, '-')}`;
                const isAvailable = status === 'DISPONIVEL' || status === 'RONDA ESCOLAR';
                const textOpacity = isAvailable ? '1' : '0.4';
                
                let icon = '';
                switch(status) {
                    case 'DISPONIVEL':
                        icon = '🫡 ';
                        break;
                    case 'RONDA ESCOLAR':
                        icon = '📚 ';
                        break;
                    case 'OPERACAO ESPECIAL':
                        icon = '⚔️ ';
                        break;
                    case 'ALIMENTACAO':
                        icon = '🍴 ';
                        break;
                    case 'BAIXA MECANICA':
                        icon = '👎 ';
                        break;
                    default:
                        icon = '';
                }
                
                html += `
                    <div class="vtr-disponivel-item ${statusClass}" data-vtr="${vtr.vtrNumber}" data-vtr-key="${key}" style="opacity: ${textOpacity}; cursor: pointer; position: relative;">
                        ${icon}${vtr.vtrNumber}
                    </div>
                `;
            });
            vtrDisponiveisContent.innerHTML = html;
            
            // Add click handlers to change status (both right-click and double-click)
            document.querySelectorAll('.vtr-disponivel-item').forEach(item => {
                item.addEventListener('contextmenu', async (e) => {
                    e.preventDefault();
                    const vtrKey = item.getAttribute('data-vtr-key');
                    const vtrNum = item.getAttribute('data-vtr');
                    await showStatusChangeMenu(vtrKey, vtrNum, btlNumber);
                });
                
                item.addEventListener('dblclick', async (e) => {
                    const vtrKey = item.getAttribute('data-vtr-key');
                    const vtrNum = item.getAttribute('data-vtr');
                    await showStatusChangeMenu(vtrKey, vtrNum, btlNumber);
                });
            });
        }

        // Group assignments by VTR number so each VTR appears only once
        const empenhadasForBTL = Object.entries(vtrAssignments)
            .filter(([key, assignment]) => {
                const vtrPrefix = assignment.vtrNumber.substring(0, 2);
                return vtrPrefix === btlPrefix;
            });

        const groupedByVTR = {};
        empenhadasForBTL.forEach(([assignKey, assignment]) => {
            const vtrNum = assignment.vtrNumber;
            if (!groupedByVTR[vtrNum]) groupedByVTR[vtrNum] = [];
            const ocorrencia = atendimentos[assignment.ocorrenciaId];
            if (ocorrencia) {
                groupedByVTR[vtrNum].push({
                    assignKey,
                    ocorrenciaKey: assignment.ocorrenciaId,
                    ocorrencia
                });
            }
        });

        const vtrEmpenhadasContent = document.getElementById('vtrEmpenhadasContent');
        const vtrIds = Object.keys(groupedByVTR).sort();

        if (vtrIds.length === 0) {
            vtrEmpenhadasContent.innerHTML = '<p class="no-vtrs">Nenhuma VTR empenhada</p>';
        } else {
            let html = '<div class="vtr-list">';
            vtrIds.forEach(vtrNum => {
                const list = groupedByVTR[vtrNum];
                const exampleOcc = list[0].ocorrencia;
                const gravidadeClass = exampleOcc ? `gravidade-${exampleOcc.gravidade.toLowerCase()}` : '';
                html += `
                    <div class="vtr-item" data-vtr="${vtrNum}" style="display: flex; align-items: center; justify-content: space-between; padding: 12px;">
                        <div>
                            <div class="vtr-number" style="font-weight:600">VTR ${vtrNum}</div>
                            <div class="vtr-occurrence" style="font-size:13px; color:#666;">${list.length} ocorrência(s) atribuída(s)</div>
                        </div>
                        <div style="display:flex; flex-direction:column; align-items:flex-end; gap:6px;">
                            <div class="${gravidadeClass}" style="font-size:12px;">${exampleOcc ? exampleOcc.gravidade : ''}</div>
                            <button class="btn-secondary btn-vtr-open" data-vtr="${vtrNum}" style="padding:6px 10px; font-size:13px;">Ver Ocorrências</button>
                        </div>
                    </div>
                `;
            });
            html += '</div>';
            vtrEmpenhadasContent.innerHTML = html;

            // Attach handler: when user clicks "Ver Ocorrências" show a selection of occurrences for that VTR
            document.querySelectorAll('.btn-vtr-open').forEach(btn => {
                btn.addEventListener('click', async (ev) => {
                    const vtrNumber = btn.getAttribute('data-vtr');
                    const list = groupedByVTR[vtrNumber] || [];
                    if (list.length === 0) return;

                    // Build modal content listing occurrences for this VTR
                    const modal = document.getElementById('ocorrenciaModal');
                    const modalContent = document.getElementById('ocorrenciaModalContent');

                    let html = `<h2>VTR ${vtrNumber} — Ocorrências (${list.length})</h2><div style="display:flex;flex-direction:column;gap:10px;">`;
                    list.forEach(item => {
                        const o = item.ocorrencia;
                        html += `
                            <div style="padding:10px; background:#fff; border:1px solid #ddd; border-radius:4px; display:flex; justify-content:space-between; align-items:center;">
                                <div>
                                    <div style="font-weight:700;">#${o.numeroRegistro} — ${o.rua}, ${o.numero} - ${o.bairro}</div>
                                    <div style="font-size:13px; color:#666;">${o.dataHora} — ${o.natureza}</div>
                                </div>
                                <div style="display:flex; flex-direction:column; gap:6px;">
                                    <button class="btn-cadastro btn-open-occ" data-key="${item.ocorrenciaKey}">Abrir</button>
                                </div>
                            </div>
                        `;
                    });
                    html += `<div style="margin-top:12px;"><button id="btnCloseVtrList" class="btn-secondary" style="width:100%;">Fechar</button></div></div>`;

                    modalContent.innerHTML = html;
                    modal.style.display = 'block';

                    // Attach handlers for each "Abrir" button to open the detailed VTR occurrence modal
                    modalContent.querySelectorAll('.btn-open-occ').forEach(openBtn => {
                        openBtn.addEventListener('click', async () => {
                            const ocorrenciaKey = openBtn.getAttribute('data-key');
                            const ocorrencia = atendimentos[ocorrenciaKey];
                            modal.style.display = 'none';
                            const { showVTROcorrenciaDetails } = await import('./vtr-occurrence-modal.js');
                            showVTROcorrenciaDetails(ocorrenciaKey, ocorrencia, vtrNumber);
                        });
                    });

                    // close button
                    const closeBtn = document.getElementById('btnCloseVtrList');
                    if (closeBtn) {
                        closeBtn.addEventListener('click', () => {
                            modal.style.display = 'none';
                        });
                    }

                });
            });
        }
    } catch (error) {
        console.error('Erro ao carregar VTRs:', error);
    }
}

async function showStatusChangeMenu(vtrKey, vtrNum, btlNumber) {
    const currentVTR = await getData(`vtrsDisponiveis/${vtrKey}`);
    const currentStatus = currentVTR?.status || 'DISPONIVEL';
    
    const modal = document.getElementById('ocorrenciaModal');
    const modalContent = document.getElementById('ocorrenciaModalContent');
    
    let html = `
        <h2>Alterar Status - VTR ${vtrNum}</h2>
        <div style="margin: 20px 0;">
            <p style="margin-bottom: 15px;"><strong>Status Atual:</strong> ${currentStatus}</p>
            <div style="display: flex; flex-direction: column; gap: 10px;">
                <button class="btn-status" data-status="DISPONIVEL" style="background: #4caf50; color: white; padding: 12px; border: none; border-radius: 4px; cursor: pointer; font-weight: 600;">DISPONÍVEL</button>
                <button class="btn-status" data-status="RONDA ESCOLAR" style="background: #4caf50; color: white; padding: 12px; border: none; border-radius: 4px; cursor: pointer; font-weight: 600;">📚 RONDA ESCOLAR</button>
                <button class="btn-status" data-status="OPERACAO ESPECIAL" style="background: #ffc107; color: black; padding: 12px; border: none; border-radius: 4px; cursor: pointer; font-weight: 600;">OPERAÇÃO ESPECIAL</button>
                <button class="btn-status" data-status="ALIMENTACAO" style="background: #ff9800; color: white; padding: 12px; border: none; border-radius: 4px; cursor: pointer; font-weight: 600;">ALIMENTAÇÃO</button>
                <button class="btn-status" data-status="BAIXA MECANICA" style="background: #f44336; color: white; padding: 12px; border: none; border-radius: 4px; cursor: pointer; font-weight: 600;">BAIXA MECÂNICA</button>
            </div>
            <button id="btnCancelarStatus" class="btn-secondary" style="width: 100%; margin-top: 15px;">Cancelar</button>
        </div>
    `;
    
    modalContent.innerHTML = html;
    modal.style.display = 'block';
    
    document.querySelectorAll('.btn-status').forEach(btn => {
        btn.addEventListener('click', async () => {
            const newStatus = btn.getAttribute('data-status');
            const { updateData } = await import('./database.js');
            
            await updateData(`vtrsDisponiveis/${vtrKey}`, {
                status: newStatus
            });
            
            modal.style.display = 'none';
            await loadVTRPanels(btlNumber);
        });
    });
    
    document.getElementById('btnCancelarStatus').addEventListener('click', () => {
        modal.style.display = 'none';
    });
}