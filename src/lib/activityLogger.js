// src/lib/activityLogger.js
import { promises as fs } from 'fs';
import { join } from 'path';

const LOG_PATH = join(process.cwd(), 'logs', 'activity.json');
const MAX_LOG_ENTRIES = 1000; // Limite para evitar vazamento de memória
let activityLog = [];

export async function logActivity(entry) {
	activityLog.push({ ...entry, timestamp: new Date() });
	
	// Limita o tamanho do log em memória
	if (activityLog.length > MAX_LOG_ENTRIES) {
		activityLog = activityLog.slice(-MAX_LOG_ENTRIES);
	}
	
	try {
		// Garante que a pasta existe
		await fs.mkdir(join(process.cwd(), 'logs'), { recursive: true });
		await fs.writeFile(LOG_PATH, JSON.stringify(activityLog, null, 2));
	} catch (err) {
		console.error('Erro ao salvar log de atividade:', err);
	}
}

export async function getActivityLog() {
	try {
		const data = await fs.readFile(LOG_PATH, 'utf-8');
		activityLog = JSON.parse(data);
	} catch (err) {}
	return activityLog;
}
