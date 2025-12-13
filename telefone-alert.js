import { getData } from './database.js';
import { reiterarOcorrencia } from './attendance.js';
import { createElement, insertAfter } from './dom-helpers.js';
import { 
    clearVeiculos, 
    clearPessoas, 
    clearImeis, 
    addVeiculo, 
    addPessoa, 
    addImei, 
    renderVeiculos, 
    renderPessoas,
    renderImeis,
    getVeiculos,
    getPessoas,
    getImeis
} from './attendance.js';
import { getRef } from './database.js';
import { update } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

export async function checkAndDisplayExistingOcorrencias(telefone) {
    try {
        const atendimentos = await getData('atendimentos');
        
        if (!atendimentos) {
            return;
        }
        
        const now = Date.now();
        const sixMonthsAgo = now - (6 * 30 * 24 * 60 * 60 * 1000);
        
        const matchingOcorrencias = Object.entries(atendimentos)
            .filter(([key, atendimento]) => {
                return atendimento.telefone === telefone && 
                       atendimento.timestamp >= sixMonthsAgo;
            })
            .sort((a, b) => b[1].timestamp - a[1].timestamp);
        
        if (matchingOcorrencias.length > 0) {
            await showMultipleOcorrenciasAlert(matchingOcorrencias);
        }
    } catch (error) {
        console.error('Erro ao verificar ocorrências:', error);
    }
}

export async function showMultipleOcorrenciasAlert(matchingOcorrencias) {
    const existingAlert = document.querySelector('.telefone-alert');
    if (existingAlert) {
        existingAlert.remove();
    }

    const vtrAssignments = await getData('vtrAssignments') || {};
    
    const encerradas = [];
    const pendentesOuEmAtendimento = [];
    
    for (const [key, ocorrencia] of matchingOcorrencias) {
        if (ocorrencia.encerrado) {
            encerradas.push([key, ocorrencia]);
        } else {
            pendentesOuEmAtendimento.push([key, ocorrencia]);
        }
    }

    const alertDiv = createElement('div', {
        className: 'telefone-alert',
        style: {
            background: '#fff3cd',
            border: '1px solid #ffc107',
            padding: '15px',
            borderRadius: '4px',
            marginTop: '10px',
            marginBottom: '10px'
        }
    });

    let html = '<p style="margin: 0 0 10px 0; font-size: 14px; font-weight: 600;">Ocorrências encontradas:</p>';

    for (const [key, ocorrencia] of matchingOcorrencias) {
        let statusText = '';
        let statusColor = '';
        
        if (ocorrencia.encerrado) {
            statusText = 'ENCERRADA';
            statusColor = '#d32f2f';
        } else {
            const hasVTR = Object.values(vtrAssignments).some(v => v.ocorrenciaId === key);
            statusText = hasVTR ? 'EM ATENDIMENTO' : 'PENDENTE';
            statusColor = hasVTR ? '#1976d2' : '#ff9800';
        }
        
        html += `
            <div style="background: #f9f9f9; padding: 10px; margin-bottom: 10px; border-radius: 4px; border-left: 4px solid ${statusColor};">
                <p style="margin: 0 0 5px 0; font-size: 13px;"><strong>#${ocorrencia.numeroRegistro}</strong> - <span style="color: ${statusColor}; font-weight: 600;">${statusText}</span></p>
                <p style="margin: 0 0 3px 0; font-size: 12px;">${ocorrencia.dataHora}</p>
                <p style="margin: 0 0 3px 0; font-size: 12px;">${ocorrencia.rua}, ${ocorrencia.numero} - ${ocorrencia.bairro}</p>
                <p style="margin: 0; font-size: 12px;">${ocorrencia.natureza}</p>
            </div>
        `;
    }

    let buttonsHTML = '<div style="display: flex; flex-wrap: wrap; gap: 10px; margin-top: 10px;">';
    
    if (encerradas.length > 0) {
        const [key, ocorrencia] = encerradas[0];
        buttonsHTML += `<button id="btnResgatarOcorrencia" data-key="${key}" class="btn-cadastro" style="padding: 8px 16px; font-size: 14px; flex: 1;">Resgatar #${ocorrencia.numeroRegistro}</button>`;
    }
    
    if (pendentesOuEmAtendimento.length > 0) {
        const [key, ocorrencia] = pendentesOuEmAtendimento[0];
        buttonsHTML += `
            <button id="btnReiterarOcorrencia" data-key="${key}" class="btn-secondary" style="padding: 8px 16px; font-size: 14px; flex: 1;">Reiterar #${ocorrencia.numeroRegistro}</button>
            <button id="btnReiterarComComplemento" data-key="${key}" class="btn-secondary" style="padding: 8px 16px; font-size: 14px; flex: 1;">Reiterar com Complemento #${ocorrencia.numeroRegistro}</button>
        `;
    }
    
    buttonsHTML += `<button id="btnCancelarAlerta" class="btn-secondary" style="padding: 8px 16px; font-size: 14px; flex: 1;">Cancelar</button></div>`;
    
    html += buttonsHTML;

    html += `
        <div id="reiteracaoComplementoSection" style="display: none; margin-top: 15px;">
            <label for="reiteracaoComplemento" style="display: block; margin-bottom: 5px; font-weight: 600; font-size: 14px;">Histórico Complementar:</label>
            <textarea id="reiteracaoComplemento" rows="4" style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 4px; font-family: inherit; font-size: 14px; margin-bottom: 10px;"></textarea>
            <button id="btnSalvarReiteracaoComplemento" class="btn-cadastro" style="padding: 8px 16px; font-size: 14px; width: 100%;">Salvar Reiteração</button>
        </div>
    `;

    alertDiv.innerHTML = html;

    const telefoneInput = document.getElementById('telefone');
    insertAfter(alertDiv, telefoneInput.parentNode);

    setupMultipleOcorrenciasHandlers(matchingOcorrencias, encerradas, pendentesOuEmAtendimento, alertDiv, telefoneInput);
}

function setupMultipleOcorrenciasHandlers(allOcorrencias, encerradas, pendentes, alertDiv, telefoneInput) {
    const btnReiterar = document.getElementById('btnReiterarOcorrencia');
    const btnResgatar = document.getElementById('btnResgatarOcorrencia');
    const btnReiterarComComplemento = document.getElementById('btnReiterarComComplemento');
    const btnCancelarAlerta = document.getElementById('btnCancelarAlerta');
    const reiteracaoComplementoTextarea = document.getElementById('reiteracaoComplemento');
    const attendanceForm = document.getElementById('attendanceForm');
    const btnVeiculos = document.getElementById('btnVeiculos');
    const btnPessoas = document.getElementById('btnPessoas');
    const btnBackFromAttendance = document.getElementById('btnBackFromAttendance');

    if (reiteracaoComplementoTextarea) {
        reiteracaoComplementoTextarea.addEventListener('input', (e) => {
            e.target.value = e.target.value.toUpperCase();
        });
    }

    if (btnReiterarComComplemento && pendentes.length > 0) {
        btnReiterarComComplemento.addEventListener('click', () => {
            const key = btnReiterarComComplemento.getAttribute('data-key');
            const ocorrencia = allOcorrencias.find(([k]) => k === key)[1];
            
            const section = document.getElementById('reiteracaoComplementoSection');
            
            if (section.style.display === 'block') {
                 // If hiding, restore form fields
                restoreFormFields();
                section.style.display = 'none';
            } else {
                // If showing, customize form fields
                section.style.display = 'block';
                section.setAttribute('data-key', key);
                
                // --- CUSTOM REITERATION FORM SETUP ---
                
                // Identify all main input sections outside the auxiliary buttons/sections
                const mainInputsToHide = document.querySelectorAll('#attendanceForm > .form-row, #attendanceForm > .form-group:not(:has(textarea#historico))');
                
                mainInputsToHide.forEach(el => {
                    el.style.display = 'none';
                });

                const btnVeiculos = document.getElementById('btnVeiculos');
                const btnPessoas = document.getElementById('btnPessoas');
                const btnImei = document.getElementById('btnImei');
                const formButtonGroup = attendanceForm.querySelector('.button-group');

                // Show the required buttons
                if (btnVeiculos) btnVeiculos.style.display = 'inline-block';
                if (btnPessoas) btnPessoas.style.display = 'inline-block';
                if (btnImei) btnImei.style.display = 'inline-block';

                // Hide main buttons not relevant for reiteration
                document.getElementById('btnMinhasOcorrencias').style.display = 'none';
                document.getElementById('btnPesquisarOcorrencias').style.display = 'none';
                attendanceForm.querySelector('.btn-cadastro').style.display = 'none'; // Hide 'Salvar Atendimento'

                // Ensure helper sections are initially hidden but buttons are visible
                document.getElementById('veiculosSection').style.display = 'none';
                document.getElementById('pessoasSection').style.display = 'none';
                document.getElementById('imeiSection').style.display = 'none';
                
                // Restore visibility of historico input
                const historicoField = document.getElementById('historico');
                historicoField.value = ocorrencia.historico;
                historicoField.readOnly = false;
                historicoField.closest('.form-group').style.display = 'block';

                btnBackFromAttendance.style.display = 'none';

                // Pre-load existing data for editing/adding
                clearVeiculos();
                clearPessoas();
                clearImeis();
                
                if (ocorrencia.veiculos) {
                    ocorrencia.veiculos.forEach(v => addVeiculo({ ...v, id: Date.now() + Math.random() }));
                }
                renderVeiculos(document.getElementById('veiculosAdicionados'));

                if (ocorrencia.pessoas) {
                    ocorrencia.pessoas.forEach(p => addPessoa({ ...p, id: Date.now() + Math.random() }));
                }
                renderPessoas(document.getElementById('pessoasAdicionadas'));
                
                if (ocorrencia.imeis) {
                    ocorrencia.imeis.forEach(i => addImei({ ...i, id: Date.now() + Math.random() }));
                }
                renderImeis(document.getElementById('imeisAdicionados'));

                let btnSalvarHistorico = document.getElementById('btnSalvarHistoricoReiteracao');
                if (!btnSalvarHistorico) {
                    btnSalvarHistorico = document.createElement('button');
                    btnSalvarHistorico.id = 'btnSalvarHistoricoReiteracao';
                    btnSalvarHistorico.type = 'button';
                    btnSalvarHistorico.className = 'btn-cadastro';
                    btnSalvarHistorico.textContent = 'Salvar Reiteração Completa';
                    btnSalvarHistorico.style.cssText = 'margin-top: 20px; width: 100%;';
                    
                    // Find the location to insert this button: just before btnBackFromAttendance
                    const containerElement = document.getElementById('attendanceScreen');
                    containerElement.insertBefore(btnSalvarHistorico, btnBackFromAttendance);

                    btnSalvarHistorico.addEventListener('click', async () => {
                        const currentKey = section.getAttribute('data-key');
                        const currentOcorrencia = allOcorrencias.find(([k]) => k === currentKey)[1];
                        await handleSalvarHistoricoReiteracao(currentKey, currentOcorrencia, alertDiv, telefoneInput);
                    });
                } else {
                    btnSalvarHistorico.textContent = 'Salvar Reiteração Completa';
                    btnSalvarHistorico.style.display = 'block';
                }
                
                // Hide the simple complement save button
                document.getElementById('btnSalvarReiteracaoComplemento').style.display = 'none';
            }
        });
    }

    const btnSalvarReiteracaoComplemento = document.getElementById('btnSalvarReiteracaoComplemento');
    if (btnSalvarReiteracaoComplemento && pendentes.length > 0) {
        btnSalvarReiteracaoComplemento.addEventListener('click', async () => {
            const section = document.getElementById('reiteracaoComplementoSection');
            const key = section.getAttribute('data-key');
            const ocorrencia = allOcorrencias.find(([k]) => k === key)[1];
            await handleSalvarHistoricoReiteracao(key, ocorrencia, alertDiv, telefoneInput, true);
        });
    }

    if (btnReiterar && pendentes.length > 0) {
        btnReiterar.addEventListener('click', async () => {
            const key = btnReiterar.getAttribute('data-key');
            const ocorrencia = allOcorrencias.find(([k]) => k === key)[1];
            
            const success = await reiterarOcorrencia(key);
            if (success) {
                alert(`Ocorrência #${ocorrencia.numeroRegistro} reiterada com sucesso!`);
                alertDiv.remove();
                telefoneInput.value = '';
            } else {
                alert('Erro ao reiterar ocorrência');
            }
        });
    }

    if (btnResgatar && encerradas.length > 0) {
        btnResgatar.addEventListener('click', async () => {
            const key = btnResgatar.getAttribute('data-key');
            const ocorrencia = allOcorrencias.find(([k]) => k === key)[1];
            
            document.getElementById('telefone').value = ocorrencia.telefone;
            document.getElementById('nomeAtendimento').value = ocorrencia.nome;
            document.getElementById('cep').value = ocorrencia.cep;
            document.getElementById('rua').value = ocorrencia.rua;
            document.getElementById('numero').value = ocorrencia.numero;
            document.getElementById('bairro').value = ocorrencia.bairro;
            document.getElementById('municipio').value = ocorrencia.municipio;
            document.getElementById('estado').value = ocorrencia.estado;
            document.getElementById('btl').value = ocorrencia.btl;
            document.getElementById('referencia').value = ocorrencia.referencia;
            document.getElementById('historico').value = ocorrencia.historico;
            document.getElementById('natureza').value = ocorrencia.natureza;
            document.getElementById('gravidade').value = ocorrencia.gravidade;

            // Load additional data
            clearVeiculos();
            if (ocorrencia.veiculos && ocorrencia.veiculos.length > 0) {
                ocorrencia.veiculos.forEach(v => {
                    addVeiculo({ ...v, id: Date.now() + Math.random() });
                });
            }
            renderVeiculos(document.getElementById('veiculosAdicionados'));

            clearPessoas();
            if (ocorrencia.pessoas && ocorrencia.pessoas.length > 0) {
                ocorrencia.pessoas.forEach(p => {
                    addPessoa({ ...p, id: Date.now() + Math.random() });
                });
            }
            renderPessoas(document.getElementById('pessoasAdicionadas'));
            
            clearImeis();
            if (ocorrencia.imeis && ocorrencia.imeis.length > 0) {
                ocorrencia.imeis.forEach(i => {
                    addImei({ ...i, id: Date.now() + Math.random() });
                });
            }
            renderImeis(document.getElementById('imeisAdicionados'));

            window.resgatandoOcorrenciaKey = key;

            alert(`Formulário preenchido com dados da ocorrência #${ocorrencia.numeroRegistro}. Você pode adicionar informações ao histórico antes de salvar.`);
            alertDiv.remove();
        });
    }

    if (btnCancelarAlerta) {
        btnCancelarAlerta.addEventListener('click', () => {
            alertDiv.remove();
            clearVeiculos();
            clearPessoas();
            clearImeis();
            restoreFormFields(); // Use imported global restore
        });
    }
}

async function handleSalvarHistoricoReiteracao(key, ocorrencia, alertDiv, telefoneInput, complementOnly = false) {
    const historicoAtualizado = document.getElementById('historico').value.trim();

    if (!historicoAtualizado || historicoAtualizado === ocorrencia.historico) {
        if (!complementOnly) {
            alert('Por favor, modifique o histórico antes de salvar a reiteração completa.');
            return;
        }
    }

    const atendimentoRef = getRef(`atendimentos/${key}`);
    const now = new Date();

    const reiteracao = {
        dataHora: now.toLocaleString('pt-BR'),
        tipo: complementOnly ? 'REITERAÇÃO COM COMPLEMENTO SIMPLES' : 'REITERAÇÃO COMPLETA',
        historicoAnterior: ocorrencia.historico,
        historicoNovo: historicoAtualizado
    };

    const atendimentos = await getData('atendimentos');
    const ocorrenciaAtual = atendimentos[key];

    const reiteracoes = ocorrenciaAtual.reiteracoes || [];
    reiteracoes.push(reiteracao);
    
    // Prepare update data
    const updateData = {
        reiteracoes: reiteracoes,
        ultimaReiteracao: now.toLocaleString('pt-BR'),
        reiteracaoLida: false
    };

    if (historicoAtualizado) {
        updateData.historico = historicoAtualizado;
    }
    
    if (!complementOnly) {
        // If saving complete reiteration, include currently staged vehicles, people, and imeis
        const currentVeiculos = getVeiculos();
        const currentPessoas = getPessoas();
        const currentImeis = getImeis();
        
        updateData.veiculos = currentVeiculos.length > 0 ? currentVeiculos : null;
        updateData.pessoas = currentPessoas.length > 0 ? currentPessoas : null;
        updateData.imeis = currentImeis.length > 0 ? currentImeis : null;
    }

    await update(atendimentoRef, updateData);

    alert(`Ocorrência #${ocorrencia.numeroRegistro} reiterada com complemento e histórico atualizado!`);
    alertDiv.remove();
    telefoneInput.value = '';

    restoreFormFields(); // Use imported global restore

    document.getElementById('historico').value = '';
    
    clearVeiculos();
    clearPessoas();
    clearImeis();
    renderVeiculos(document.getElementById('veiculosAdicionados'));
    renderPessoas(document.getElementById('pessoasAdicionadas'));
    renderImeis(document.getElementById('imeisAdicionados'));
}