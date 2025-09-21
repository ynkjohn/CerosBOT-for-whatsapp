// ==================== ATIVIDADE ====================
async function refreshActivity() {
    try {
        console.log('Carregando atividades...');
        const result = await apiCall('/activity');
        console.log('Atividades recebidas:', result);
        displayActivity(result.data);
    } catch (error) {
        console.error('Erro ao carregar atividades:', error);
        document.getElementById('activityContainer').innerHTML = '<p class="text-center">Erro ao carregar atividade</p>';
    }
}

function displayActivity(logs) {
    const container = document.getElementById('activityContainer');
    if (!logs || logs.length === 0) {
        container.innerHTML = '<p class="text-center">Nenhuma atividade registrada</p>';
        return;
    }
    
    const html = logs.slice(-50).reverse().map(entry => {
        // Formatar o número do usuário de forma mais legível (só se não for o bot)
        let displayUser = entry.user;
        if (entry.user !== 'Bot CerosAI' && entry.user.includes('@c.us')) {
            displayUser = entry.user.replace('@c.us', '').replace(/(\d{2})(\d{2})(\d{4,5})(\d{4})/, '+$1 ($2) $3-$4');
        }
        
        // Definir emoji e texto baseado no tipo
        let typeEmoji, typeText, cssClass;
        switch(entry.type) {
            case 'mensagem':
                typeEmoji = '💬';
                typeText = 'Mensagem';
                cssClass = 'message';
                break;
            case 'mencao':
                typeEmoji = '🏷️';
                typeText = 'Menção ao Bot';
                cssClass = 'mention';
                break;
            case 'comando':
                typeEmoji = '⚡';
                typeText = 'Comando';
                cssClass = 'command';
                break;
            case 'resposta_bot':
                typeEmoji = '🤖';
                typeText = 'Resposta do Bot';
                cssClass = 'bot-response';
                break;
            default:
                typeEmoji = '📝';
                typeText = 'Atividade';
                cssClass = 'activity';
        }
        
        return `
            <div class="log-entry ${cssClass}">
                <div class="log-time">${new Date(entry.timestamp).toLocaleString()}</div>
                <div class="log-type">${typeEmoji} ${typeText}</div>
                <div class="log-message">
                    <strong>${displayUser}</strong> em <em>${entry.chatName}</em>:<br>
                    <span class="message-content">"${entry.body}"</span>
                </div>
            </div>
        `;
    }).join('');
    
    container.innerHTML = html;
}
// app.js - Lógica principal do Control Panel
const API_BASE = 'http://127.0.0.1:3001/api';

// Estado global da aplicação
const state = {
    connected: false,
    currentPage: 'dashboard',
    config: {},
    status: null,
    refreshInterval: null
};

// Inicialização da aplicação
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
});

function initializeApp() {
    setupNavigation();
    setupModals();
    startStatusPolling();
    loadDashboard();
    
    // Carrega configurações iniciais
    loadConfig();
    
    console.log('Ceros AI Control Panel iniciado');
}

// ==================== NAVEGAÇÃO ====================
function setupNavigation() {
    const navItems = document.querySelectorAll('.nav-item');
    
    navItems.forEach(item => {
        item.addEventListener('click', function() {
            const page = this.dataset.page;
            navigateToPage(page);
        });
    });
}

function navigateToPage(pageId) {
    // Remove active de todos os nav-items
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
    });
    
    // Remove active de todas as pages
    document.querySelectorAll('.page').forEach(page => {
        page.classList.remove('active');
    });
    
    // Ativa o nav-item correto
    document.querySelector(`[data-page="${pageId}"]`).classList.add('active');
    
    // Ativa a page correta
    document.getElementById(pageId).classList.add('active');
    
    state.currentPage = pageId;
    
    // Carrega dados específicos da página
    loadPageData(pageId);
}

function loadPageData(pageId) {
    switch(pageId) {
        case 'dashboard':
            refreshDashboard();
            break;
        case 'config':
            loadConfig();
            break;
        case 'stats':
            refreshStats();
            break;
        case 'logs':
            refreshLogs();
            break;
        case 'backups':
            loadBackups();
            break;
        case 'users':
            loadUsers();
            break;
        case 'activity':
            refreshActivity();
            break;
        case 'actions':
            // Página de ações não precisa carregar dados
            break;
    }
}

// ==================== API CALLS ====================
async function apiCall(endpoint, method = 'GET', data = null) {
    try {
        const options = {
            method: method,
            headers: {
                'Content-Type': 'application/json',
            }
        };
        
        if (data) {
            options.body = JSON.stringify(data);
        }
        
        const response = await fetch(`${API_BASE}${endpoint}`, options);
        const result = await response.json();
        
        if (!response.ok) {
            throw new Error(result.error || `HTTP ${response.status}`);
        }
        
        return result;
    } catch (error) {
        console.error(`Erro na API ${endpoint}:`, error);
        showToast('Erro de conexão com o bot', error.message, 'error');
        updateConnectionStatus(false);
        throw error;
    }
}

// ==================== STATUS E POLLING ====================
function startStatusPolling() {
    // Atualiza status a cada 3 segundos
    state.refreshInterval = setInterval(updateStatus, 3000);
    
    // Primeira atualização imediata
    updateStatus();
}

async function updateStatus() {
    try {
        const result = await apiCall('/status');
        state.status = result.data;
        state.connected = true;
        
        updateConnectionStatus(true);
        updateDashboardData(result.data);
        
    } catch (error) {
        state.connected = false;
        updateConnectionStatus(false);
    }
}

function updateConnectionStatus(connected) {
    const statusDot = document.getElementById('statusDot');
    const statusText = document.getElementById('statusText');
    
    if (connected) {
        statusDot.classList.add('online');
        statusText.textContent = 'Online';
    } else {
        statusDot.classList.remove('online');
        statusText.textContent = 'Offline';
    }
}

// ==================== DASHBOARD ====================
function loadDashboard() {
    navigateToPage('dashboard');
}

function refreshDashboard() {
    updateStatus();
}

function updateDashboardData(data) {
    if (!data) return;
    
    // Status do Bot
    document.getElementById('botConnectionStatus').textContent = 
        data.bot.connected ? 'Online' : 'Offline';
    
    const uptimeHours = Math.floor(data.bot.uptime / 3600);
    const uptimeMinutes = Math.floor((data.bot.uptime % 3600) / 60);
    document.getElementById('botUptime').textContent = `${uptimeHours}h ${uptimeMinutes}m`;
    
    document.getElementById('aiModel').textContent = data.model.name || 'N/A';
    
    // Memória
    document.getElementById('chatCount').textContent = data.memory.chatCount || 0;
    document.getElementById('messageCount').textContent = data.memory.totalMessages || 0;
    document.getElementById('memorySize').textContent = `${data.memory.memorySizeKB || 0} KB`;
    
    // Rate Limiting
    document.getElementById('totalUsers').textContent = data.rateLimit.totalUsers || 0;
    document.getElementById('activeUsers').textContent = data.rateLimit.activeUsersHour || 0;
    document.getElementById('totalRequests').textContent = data.rateLimit.totalRequestsHour || 0;
    
    // Sistema
    document.getElementById('nodeMemory').textContent = `${data.system.nodeMemoryMB || 0} MB`;
    document.getElementById('platform').textContent = data.system.platform || 'N/A';
}

// ==================== CONFIGURAÇÕES ====================
async function loadConfig() {
    try {
        const result = await apiCall('/config');
        state.config = result.data;
        updateConfigForm(result.data);
    } catch (error) {
        console.error('Erro ao carregar configurações:', error);
    }
}

function updateConfigForm(config) {
    // Preenche os campos do formulário
    // Remove /v1/chat/completions do endpoint para exibir apenas a URL base
    let displayEndpoint = config.API_ENDPOINT;
    if (displayEndpoint && displayEndpoint.endsWith('/v1/chat/completions')) {
        displayEndpoint = displayEndpoint.replace('/v1/chat/completions', '');
    }
    setValue('apiEndpoint', displayEndpoint);
    setValue('modelName', config.MODEL_NAME);
    setValue('maxTokens', config.MAX_TOKENS);
    setValue('temperature', config.TEMPERATURE);
    setValue('topP', config.TOP_P);
    setValue('adminNumbers', config.ADMIN_NUMBERS);
    setValue('duplicateTimeout', config.DUPLICATE_TIMEOUT);
    setValue('groupRandomChance', config.GROUP_RANDOM_CHANCE);
    setValue('maxRequestsPerMinute', config.MAX_REQUESTS_PER_MINUTE);
    setValue('maxRequestsPerHour', config.MAX_REQUESTS_PER_HOUR);
    setValue('maxHistoryMessages', config.MAX_HISTORY_MESSAGES);
    setValue('maxBackups', config.MAX_BACKUPS);
    
    // Atualiza valores dos sliders
    updateSliderValue('maxTokens', 'maxTokensValue');
    updateSliderValue('temperature', 'temperatureValue');
    updateSliderValue('topP', 'topPValue');
    updateSliderValue('groupRandomChance', 'groupRandomChanceValue');
}

function setValue(id, value) {
    const element = document.getElementById(id);
    if (element && value !== undefined) {
        element.value = value;
    }
}

function updateSliderValue(sliderId, displayId) {
    const slider = document.getElementById(sliderId);
    const display = document.getElementById(displayId);
    if (slider && display) {
        display.textContent = slider.value;
    }
}

async function saveConfig() {
    // Processa o endpoint para adicionar o caminho completo se necessário
    let apiEndpoint = document.getElementById('apiEndpoint').value.trim();
    
    // Se não termina com o caminho da API, adiciona automaticamente
    if (apiEndpoint && !apiEndpoint.includes('/v1/chat/completions')) {
        // Remove trailing slash se existir
        apiEndpoint = apiEndpoint.replace(/\/$/, '');
        // Adiciona o caminho padrão da API
        apiEndpoint += '/v1/chat/completions';
    }
    
    const config = {
        API_ENDPOINT: apiEndpoint,
        MODEL_NAME: document.getElementById('modelName').value,
        MAX_TOKENS: document.getElementById('maxTokens').value,
        TEMPERATURE: document.getElementById('temperature').value,
        TOP_P: document.getElementById('topP').value,
        ADMIN_NUMBERS: document.getElementById('adminNumbers').value,
        DUPLICATE_TIMEOUT: document.getElementById('duplicateTimeout').value,
        GROUP_RANDOM_CHANCE: document.getElementById('groupRandomChance').value,
        MAX_REQUESTS_PER_MINUTE: document.getElementById('maxRequestsPerMinute').value,
        MAX_REQUESTS_PER_HOUR: document.getElementById('maxRequestsPerHour').value,
        MAX_HISTORY_MESSAGES: document.getElementById('maxHistoryMessages').value,
        MAX_BACKUPS: document.getElementById('maxBackups').value
    };
    
    try {
        await apiCall('/config', 'POST', config);
        showToast('Sucesso', 'Configurações salvas! Reinicie o bot para aplicar as mudanças.', 'success');
    } catch (error) {
        showToast('Erro', 'Erro ao salvar configurações: ' + error.message, 'error');
    }
}

// ==================== ESTATÍSTICAS ====================
async function refreshStats() {
    try {
        const result = await apiCall('/stats');
        displayStats(result.data);
    } catch (error) {
        document.getElementById('statsContent').innerHTML = 
            '<div class="card"><div class="card-content"><p class="text-center">Erro ao carregar estatísticas</p></div></div>';
    }
}

function displayStats(data) {
    const container = document.getElementById('statsContent');
    
    const html = `
        <div class="dashboard-grid">
            <div class="card">
                <div class="card-header">
                    <h3><i class="fas fa-memory"></i> Memória Detalhada</h3>
                </div>
                <div class="card-content">
                    <div class="status-item">
                        <span class="label">Chats Ativos:</span>
                        <span class="value">${data.memory.chatCount}</span>
                    </div>
                    <div class="status-item">
                        <span class="label">Total Mensagens:</span>
                        <span class="value">${data.memory.totalMessages}</span>
                    </div>
                    <div class="status-item">
                        <span class="label">Média por Chat:</span>
                        <span class="value">${data.memory.avgMessagesPerChat}</span>
                    </div>
                    <div class="status-item">
                        <span class="label">Chat Mais Ativo:</span>
                        <span class="value">${data.memory.mostActiveChat || 'N/A'}</span>
                    </div>
                    <div class="status-item">
                        <span class="label">Tamanho em Memória:</span>
                        <span class="value">${data.memory.memorySizeKB} KB</span>
                    </div>
                </div>
            </div>

            <div class="card">
                <div class="card-header">
                    <h3><i class="fas fa-tachometer-alt"></i> Rate Limiting</h3>
                </div>
                <div class="card-content">
                    <div class="status-item">
                        <span class="label">Usuários Únicos:</span>
                        <span class="value">${data.rateLimit.totalUsers}</span>
                    </div>
                    <div class="status-item">
                        <span class="label">Ativos (1h):</span>
                        <span class="value">${data.rateLimit.activeUsersHour}</span>
                    </div>
                    <div class="status-item">
                        <span class="label">Requests (1h):</span>
                        <span class="value">${data.rateLimit.totalRequestsHour}</span>
                    </div>
                    <div class="status-item">
                        <span class="label">Usuário Mais Ativo:</span>
                        <span class="value">${data.rateLimit.mostActiveUser || 'N/A'}</span>
                    </div>
                </div>
            </div>
            
            <div class="card">
                <div class="card-header">
                    <h3><i class="fas fa-server"></i> Sistema</h3>
                </div>
                <div class="card-content">
                    <div class="status-item">
                        <span class="label">Memória Node.js:</span>
                        <span class="value">${data.system.nodeMemoryMB} MB</span>
                    </div>
                    <div class="status-item">
                        <span class="label">CPU:</span>
                        <span class="value">${data.system.cpuUsage}%</span>
                    </div>
                    <div class="status-item">
                        <span class="label">Plataforma:</span>
                        <span class="value">${data.system.platform}</span>
                    </div>
                    <div class="status-item">
                        <span class="label">Node Version:</span>
                        <span class="value">${data.system.nodeVersion}</span>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    container.innerHTML = html;
}

// ==================== LOGS ====================
async function refreshLogs() {
    try {
        console.log('Carregando logs...');
        const result = await apiCall('/logs');
        console.log('Logs recebidos:', result);
        displayLogs(result.data);
    } catch (error) {
        console.error('Erro ao carregar logs:', error);
        document.getElementById('logsContainer').innerHTML = 
            '<p class="text-center">Erro ao carregar logs</p>';
    }
}

function displayLogs(data) {
    const container = document.getElementById('logsContainer');
    
    // Check if data has errors property (new API structure)
    const logs = data && data.errors ? data.errors : (Array.isArray(data) ? data : []);
    
    if (!logs || logs.length === 0) {
        container.innerHTML = '<p class="text-center">Nenhum log disponível</p>';
        return;
    }
    
    const html = logs.map(log => `
        <div class="log-entry ${log.severity || log.level || 'info'}">
            <div class="log-time">${new Date(log.timestamp).toLocaleString()}</div>
            <div class="log-category">[${log.category || 'SISTEMA'}]</div>
            <div class="log-message">${log.message}</div>
            ${log.possibleCauses && log.possibleCauses.length > 0 ? `
                <div class="log-details">
                    <strong>Possíveis causas:</strong>
                    <ul>${log.possibleCauses.map(cause => `<li>${cause}</li>`).join('')}</ul>
                </div>
            ` : ''}
        </div>
    `).join('');
    
    container.innerHTML = html;
}

async function clearLogs() {
    if (confirm('Tem certeza que deseja limpar todos os logs?')) {
        try {
            await apiCall('/logs', 'DELETE');
            showToast('Sucesso', 'Logs limpos com sucesso', 'success');
            refreshLogs();
        } catch (error) {
            showToast('Erro', 'Erro ao limpar logs: ' + error.message, 'error');
        }
    }
}

// ==================== BACKUPS ====================
async function loadBackups() {
    try {
        const result = await apiCall('/backups');
        displayBackups(result.data);
    } catch (error) {
        document.getElementById('backupsContainer').innerHTML = 
            '<p class="text-center">Erro ao carregar backups</p>';
    }
}

function displayBackups(backups) {
    const container = document.getElementById('backupsContainer');
    
    if (!backups || backups.length === 0) {
        container.innerHTML = '<p class="text-center">Nenhum backup disponível</p>';
        return;
    }
    
    const html = backups.map(backup => `
        <div class="backup-item">
            <div class="backup-info">
                <h4>${backup.id}</h4>
                <p>${backup.date} - ${backup.size}</p>
                <p>${backup.chats} chats, ${backup.messages} mensagens</p>
                <p>${backup.description}</p>
            </div>
            <div class="backup-actions">
                <button class="btn btn-success" onclick="restoreBackup('${backup.id}')">
                    <i class="fas fa-undo"></i> Restaurar
                </button>
                <button class="btn btn-danger" onclick="deleteBackup('${backup.id}')">
                    <i class="fas fa-trash"></i> Deletar
                </button>
            </div>
        </div>
    `).join('');
    
    container.innerHTML = html;
}

async function createBackup() {
    try {
        const result = await apiCall('/actions/create-backup', 'POST');
        showToast('Sucesso', `Backup criado: ${result.data.backupId}`, 'success');
        if (state.currentPage === 'backups') {
            loadBackups();
        }
    } catch (error) {
        showToast('Erro', 'Erro ao criar backup: ' + error.message, 'error');
    }
}

async function restoreBackup(filename) {
    if (confirm(`Tem certeza que deseja restaurar o backup ${filename}? Isso irá substituir os dados atuais.`)) {
        try {
            await apiCall('/backups/restore', 'POST', { filename });
            showToast('Sucesso', 'Backup restaurado com sucesso', 'success');
        } catch (error) {
            showToast('Erro', 'Erro ao restaurar backup: ' + error.message, 'error');
        }
    }
}

async function deleteBackup(filename) {
    if (confirm(`Tem certeza que deseja deletar o backup ${filename}?`)) {
        try {
            await apiCall('/backups/' + filename, 'DELETE');
            showToast('Sucesso', 'Backup deletado', 'success');
            loadBackups();
        } catch (error) {
            showToast('Erro', 'Erro ao deletar backup: ' + error.message, 'error');
        }
    }
}

// ==================== USERS ====================
async function loadUsers() {
    try {
        const result = await apiCall('/users');
    displayUsers(result.data.users);
    } catch (error) {
        document.getElementById('usersContainer').innerHTML = 
            '<p class="text-center">Erro ao carregar usuários</p>';
    }
}

function displayUsers(users) {
    const container = document.getElementById('usersContainer');
    
    if (!users || users.length === 0) {
        container.innerHTML = '<p class="text-center">Nenhum usuário cadastrado</p>';
        return;
    }
    
    const html = users.map(user => `
        <div class="user-item">
            <div class="user-info">
                <h4>${user.username}</h4>
                <p>Criado em: ${user.createdAt}</p>
                <p>Último login: ${user.lastLogin}</p>
                <p>Criado por: ${user.createdBy}</p>
            </div>
            <button class="btn btn-danger" onclick="deleteUser('${user.username}')">
                <i class="fas fa-trash"></i> Deletar
            </button>
        </div>
    `).join('');
    
    container.innerHTML = html;
}

async function createUser() {
    const username = document.getElementById('newUsername').value;
    const password = document.getElementById('newPassword').value;
    
    if (!username || !password) {
        showToast('Erro', 'Preencha todos os campos', 'warning');
        return;
    }
    
    try {
        await apiCall('/users', 'POST', { username, password });
        showToast('Sucesso', 'Usuário criado com sucesso', 'success');
        document.getElementById('newUsername').value = '';
        document.getElementById('newPassword').value = '';
        loadUsers();
    } catch (error) {
        showToast('Erro', 'Erro ao criar usuário: ' + error.message, 'error');
    }
}

async function deleteUser(username) {
    if (confirm(`Tem certeza que deseja deletar o usuário "${username}"?`)) {
        try {
            await apiCall('/users/' + username, 'DELETE');
            showToast('Sucesso', 'Usuário deletado com sucesso', 'success');
            loadUsers();
        } catch (error) {
            showToast('Erro', 'Erro ao deletar usuário: ' + error.message, 'error');
        }
    }
}

// ==================== AÇÕES ====================
async function clearMemory() {
    if (confirm('Tem certeza que deseja limpar toda a memória do bot?')) {
        try {
            await apiCall('/actions/clear-memory', 'POST');
            showToast('Sucesso', 'Memória limpa com sucesso', 'success');
            updateStatus();
        } catch (error) {
            showToast('Erro', 'Erro ao limpar memória: ' + error.message, 'error');
        }
    }
}

function clearMemoryConfirm() {
    showModal(
        'Confirmar Limpeza de Memória',
        'Esta ação irá apagar TODOS os históricos de conversa. Esta ação não pode ser desfeita. Deseja continuar?',
        () => clearMemory()
    );
}

async function cleanupChats() {
    const days = document.getElementById('cleanupDays').value;
    if (confirm(`Limpar chats inativos há mais de ${days} dias?`)) {
        try {
            const result = await apiCall('/actions/cleanup-chats', 'POST', { params: { days: parseInt(days) } });
            showToast('Sucesso', `${result.data.removed} chats removidos`, 'success');
            updateStatus();
        } catch (error) {
            showToast('Erro', 'Erro no cleanup: ' + error.message, 'error');
        }
    }
}

async function resetAllRateLimit() {
    if (confirm('Resetar rate limit de TODOS os usuários?')) {
        try {
            await apiCall('/actions/reset-rate-limit', 'POST', { params: { phone: 'all' } });
            showToast('Sucesso', 'Rate limits resetados', 'success');
            updateStatus();
        } catch (error) {
            showToast('Erro', 'Erro ao resetar rate limits: ' + error.message, 'error');
        }
    }
}

async function resetUserRateLimit() {
    const phone = document.getElementById('resetPhone').value;
    if (!phone) {
        showToast('Erro', 'Digite o número do telefone', 'warning');
        return;
    }
    
    try {
        await apiCall('/actions/reset-rate-limit', 'POST', { params: { phone } });
        showToast('Sucesso', `Rate limit resetado para ${phone}`, 'success');
        document.getElementById('resetPhone').value = '';
    } catch (error) {
        showToast('Erro', 'Erro ao resetar rate limit: ' + error.message, 'error');
    }
}

async function testLLM() {
    showToast('Info', 'Testando conexão com IA...', 'info');
    try {
        const result = await apiCall('/test-llm', 'POST');
        showToast('Sucesso', 'IA funcionando! Resposta: ' + result.data.response, 'success');
    } catch (error) {
        showToast('Erro', 'Erro ao testar IA: ' + error.message, 'error');
    }
}

async function restartBot() {
    try {
        await apiCall('/actions/restart-bot', 'POST');
        showToast('Sucesso', 'Bot reiniciado com sucesso', 'success');
        setTimeout(() => updateStatus(), 3000);
    } catch (error) {
        showToast('Info', 'Bot reiniciando...', 'info');
    }
}

function restartBotConfirm() {
    showModal(
        'Reiniciar Bot',
        'O bot ficará offline por alguns segundos. Deseja continuar?',
        () => restartBot()
    );
}

// ==================== MODAL ====================
function setupModals() {
    const modal = document.getElementById('modal');
    const closeBtn = document.querySelector('.modal-close');
    
    closeBtn.addEventListener('click', closeModal);
    
    window.addEventListener('click', (event) => {
        if (event.target === modal) {
            closeModal();
        }
    });
}

function showModal(title, message, onConfirm) {
    const modal = document.getElementById('modal');
    document.getElementById('modalTitle').textContent = title;
    document.getElementById('modalMessage').textContent = message;
    
    const confirmBtn = document.getElementById('modalConfirmBtn');
    confirmBtn.onclick = () => {
        if (onConfirm) onConfirm();
        closeModal();
    };
    
    modal.classList.add('show');
}

function closeModal() {
    document.getElementById('modal').classList.remove('show');
}

// ==================== TOAST NOTIFICATIONS ====================
function showToast(title, message, type = 'info') {
    const container = document.getElementById('toastContainer');
    const id = 'toast-' + Date.now();
    
    const toast = document.createElement('div');
    toast.id = id;
    toast.className = `toast ${type}`;
    toast.innerHTML = `
        <div class="toast-header">
            <span class="toast-title">${title}</span>
            <span class="toast-close" onclick="closeToast('${id}')">&times;</span>
        </div>
        <div class="toast-message">${message}</div>
    `;
    
    container.appendChild(toast);
    
    // Remove automaticamente após 5 segundos
    setTimeout(() => {
        closeToast(id);
    }, 5000);
}

function closeToast(id) {
    const toast = document.getElementById(id);
    if (toast) {
        toast.style.animation = 'slideOutRight 0.3s ease';
        setTimeout(() => {
            toast.remove();
        }, 300);
    }
}

// ==================== UTILS ====================
function showCreateUser() {
    // Foca no campo de username
    document.getElementById('newUsername').focus();
}

// Cleanup ao sair
window.addEventListener('beforeunload', () => {
    if (state.refreshInterval) {
        clearInterval(state.refreshInterval);
    }
});