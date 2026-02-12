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
            .sort((a, b) => a[1].vtrNumber.localeCompare(b[1].vtrNumber));

        const vtrDisponiveisContent = document.getElementById('vtrDisponiveisContent');
        if (availableVTRs.length === 0) {
            vtrDisponiveisContent.innerHTML = '<p class="no-vtrs">Nenhuma VTR disponível</p>';
        } else {
            let html = '';
            availableVTRs.forEach(([key, vtr]) => {
                html += `<div class="vtr-disponivel-item" data-vtr="${vtr.vtrNumber}">${vtr.vtrNumber}</div>`;
            });
            vtrDisponiveisContent.innerHTML = html;
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