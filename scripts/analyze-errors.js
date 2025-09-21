#!/usr/bin/env node
// scripts/analyze-errors.js - Análise avançada de logs de erro
import 'dotenv/config';
import { promises as fs } from 'fs';
import { join } from 'path';
import { errorLogger } from '../src/lib/errorHandler.js';

const ERROR_LOG_DIR = process.env.ERROR_LOG_DIR || './logs/errors';

async function loadAllErrorLogs() {
  try {
    const files = await fs.readdir(ERROR_LOG_DIR);
    const errorFiles = files.filter(f => f.startsWith('error_') && f.endsWith('.json'));
    
    const allErrors = [];
    
    for (const file of errorFiles) {
      try {
        const content = await fs.readFile(join(ERROR_LOG_DIR, file), 'utf-8');
        const errors = JSON.parse(content);
        allErrors.push(...errors);
      } catch (e) {
        console.log(`⚠️ Erro ao ler ${file}: ${e.message}`);
      }
    }
    
    return allErrors.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  } catch (error) {
    console.log('❌ Erro ao carregar logs:', error.message);
    return [];
  }
}

function analyzeErrorPatterns(errors) {
  const patterns = {
    byCategory: {},
    bySeverity: {},
    byTime: {},
    recurring: {},
    trends: []
  };
  
  errors.forEach(error => {
    // Por categoria
    patterns.byCategory[error.category] = (patterns.byCategory[error.category] || 0) + 1;
    
    // Por severidade
    patterns.bySeverity[error.severity] = (patterns.bySeverity[error.severity] || 0) + 1;
    
    // Por hora do dia
    const hour = new Date(error.timestamp).getHours();
    patterns.byTime[hour] = (patterns.byTime[hour] || 0) + 1;
    
    // Erros recorrentes
    const key = `${error.category}:${error.errorType}`;
    patterns.recurring[key] = (patterns.recurring[key] || 0) + 1;
  });
  
  return patterns;
}

function generateRecommendations(patterns, errors) {
  const recommendations = [];
  
  // Recomendações baseadas na categoria mais comum
  const topCategory = Object.entries(patterns.byCategory)
    .sort(([,a], [,b]) => b - a)[0];
    
  if (topCategory) {
    const [category, count] = topCategory;
    
    switch (category) {
      case 'connection':
        recommendations.push({
          priority: 'HIGH',
          issue: `${count} erros de conexão detectados`,
          solutions: [
            'Verificar estabilidade do LM Studio',
            'Configurar restart automático do LM Studio',
            'Implementar health check mais frequente',
            'Considerar usar Docker para LM Studio'
          ]
        });
        break;
        
      case 'timeout':
        recommendations.push({
          priority: 'HIGH',
          issue: `${count} timeouts detectados`,
          solutions: [
            'Executar: npm run optimize',
            'Aumentar REQUEST_TIMEOUT para 180000ms',
            'Reduzir MAX_HISTORY_MESSAGES para 10',
            'Usar modelo mais rápido ou configurar GPU'
          ]
        });
        break;
        
      case 'memory':
        recommendations.push({
          priority: 'CRITICAL',
          issue: `${count} erros de memória detectados`,
          solutions: [
            'Reiniciar o bot imediatamente',
            'Executar: npm run cleanup',
            'Reduzir MAX_HISTORY_MESSAGES drasticamente',
            'Monitorar uso de RAM do sistema'
          ]
        });
        break;
        
      case 'whatsapp_auth':
        recommendations.push({
          priority: 'HIGH', 
          issue: `${count} erros de autenticação WhatsApp`,
          solutions: [
            'Deletar pasta wwebjs_auth e reconectar',
            'Verificar se WhatsApp não foi deslogado no celular',
            'Implementar reconexão automática'
          ]
        });
        break;
    }
  }
  
  // Recomendações baseadas em severidade
  const criticalCount = patterns.bySeverity.high || 0;
  if (criticalCount > 5) {
    recommendations.push({
      priority: 'CRITICAL',
      issue: `${criticalCount} erros críticos nas últimas sessões`,
      solutions: [
        'Revisar configurações imediatamente',
        'Executar: npm run health',
        'Considerar rollback para configuração anterior',
        'Monitorar logs em tempo real'
      ]
    });
  }
  
  // Recomendações baseadas em padrões temporais
  const timeEntries = Object.entries(patterns.byTime);
  if (timeEntries.length > 0) {
    const peakHour = timeEntries.sort(([,a], [,b]) => b - a)[0];
    const [hour, errorCount] = peakHour;
    
    if (errorCount > 10) {
      recommendations.push({
        priority: 'MEDIUM',
        issue: `Pico de erros às ${hour}h (${errorCount} erros)`,
        solutions: [
          'Investigar o que acontece neste horário',
          'Verificar se há processos scheduled',
          'Monitorar recursos do sistema neste período'
        ]
      });
    }
  }
  
  return recommendations;
}

function formatReport(errors, patterns, recommendations) {
  let report = `
📋 RELATÓRIO DE ANÁLISE DE ERROS - ${new Date().toLocaleString('pt-BR')}
${'='.repeat(60)}

📊 RESUMO GERAL:
• Total de erros: ${errors.length}
• Período: ${errors.length > 0 ? new Date(errors[errors.length-1].timestamp).toLocaleDateString('pt-BR') : 'N/A'} até ${errors.length > 0 ? new Date(errors[0].timestamp).toLocaleDateString('pt-BR') : 'N/A'}
• Erro mais recente: ${errors.length > 0 ? Math.round((Date.now() - new Date(errors[0].timestamp)) / 1000 / 60) : 0} minutos atrás

🏷️  ERROS POR CATEGORIA:
`;

  Object.entries(patterns.byCategory)
    .sort(([,a], [,b]) => b - a)
    .forEach(([category, count]) => {
      const percentage = ((count / errors.length) * 100).toFixed(1);
      const emoji = {
        connection: '🔌',
        timeout: '⏰',
        whatsapp_auth: '📱',
        memory: '💾',
        filesystem: '📁',
        rate_limit: '🚦',
        api_error: '🌐',
        parsing: '📄',
        unknown: '❓'
      }[category] || '❌';
      
      report += `  ${emoji} ${category.padEnd(15)} ${count.toString().padStart(3)} erros (${percentage}%)\n`;
    });

  report += `
⚠️  SEVERIDADE:
`;
  Object.entries(patterns.bySeverity).forEach(([severity, count]) => {
    const emoji = { low: '🟡', medium: '🟠', high: '🔴' }[severity] || '⚫';
    report += `  ${emoji} ${severity.padEnd(8)} ${count} erros\n`;
  });

  if (Object.keys(patterns.byTime).length > 0) {
    report += `
⏰ DISTRIBUIÇÃO POR HORA:
`;
    Object.entries(patterns.byTime)
      .sort(([a], [b]) => parseInt(a) - parseInt(b))
      .forEach(([hour, count]) => {
        const bar = '█'.repeat(Math.ceil(count / Math.max(...Object.values(patterns.byTime)) * 20));
        report += `  ${hour.padStart(2)}h: ${bar} (${count})\n`;
      });
  }

  if (recommendations.length > 0) {
    report += `
🎯 RECOMENDAÇÕES:
`;
    recommendations.forEach((rec, index) => {
      const priorityEmoji = {
        LOW: '🟢',
        MEDIUM: '🟡',
        HIGH: '🟠', 
        CRITICAL: '🔴'
      }[rec.priority] || '⚫';
      
      report += `
${index + 1}. ${priorityEmoji} [${rec.priority}] ${rec.issue}
   Soluções:
`;
      rec.solutions.forEach(solution => {
        report += `     • ${solution}\n`;
      });
    });
  }

  // Top 5 erros mais comuns
  const topErrors = Object.entries(patterns.recurring)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 5);
    
  if (topErrors.length > 0) {
    report += `
🔝 TOP 5 ERROS MAIS FREQUENTES:
`;
    topErrors.forEach(([error, count], index) => {
      report += `  ${index + 1}. ${error.replace(':', ' - ')} (${count}x)\n`;
    });
  }

  report += `
${'='.repeat(60)}
💡 Para resolver erros específicos:
   • npm run health (diagnóstico geral)
   • npm run optimize (otimizar performance)
   • /errors no WhatsApp (ver erros recentes)
   • /errorstats no WhatsApp (estatísticas)

📁 Logs salvos em: ${ERROR_LOG_DIR}
`;

  return report;
}

async function exportReport(report) {
  const filename = `error-analysis-${new Date().toISOString().split('T')[0]}.txt`;
  const filepath = join('./logs', filename);
  
  try {
    await fs.mkdir('./logs', { recursive: true });
    await fs.writeFile(filepath, report, 'utf-8');
    console.log(`📄 Relatório salvo em: ${filepath}`);
  } catch (error) {
    console.log('⚠️ Erro ao salvar relatório:', error.message);
  }
}

async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'analyze';
  
  console.log('🔍 Fernando AI - Analisador de Erros\n');
  
  try {
    if (command === 'analyze') {
      console.log('📊 Carregando logs de erro...');
      const errors = await loadAllErrorLogs();
      
      if (errors.length === 0) {
        console.log('✅ Nenhum erro encontrado nos logs!');
        return;
      }
      
      console.log(`📋 Analisando ${errors.length} erros...`);
      
      const patterns = analyzeErrorPatterns(errors);
      const recommendations = generateRecommendations(patterns, errors);
      const report = formatReport(errors, patterns, recommendations);
      
      console.log(report);
      
      // Pergunta se quer salvar
      const { default: readline } = await import('readline');
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
      });
      
      rl.question('\n💾 Salvar relatório em arquivo? (s/N): ', async (answer) => {
        if (answer.toLowerCase() === 's') {
          await exportReport(report);
        }
        rl.close();
      });
      
    } else if (command === 'clean') {
      console.log('🧹 Limpando logs antigos...');
      const days = parseInt(args[1]) || 7;
      await errorLogger.cleanupOldLogs(days);
      console.log(`✅ Logs mais antigos que ${days} dias removidos`);
      
    } else if (command === 'stats') {
      const stats = errorLogger.getErrorStats();
      console.log('📊 Estatísticas atuais:');
      console.log(`  • Total de erros: ${stats.totalErrors}`);
      console.log(`  • Erros recentes: ${stats.recentErrorsCount}`);
      console.log(`  • Erros críticos: ${stats.criticalErrorsCount}`);
      
      if (stats.mostCommonError) {
        console.log(`  • Mais comum: ${stats.mostCommonError.error} (${stats.mostCommonError.count}x)`);
      }
      
    } else {
      console.log('❌ Comando inválido!');
      console.log('\nUso:');
      console.log('  npm run analyze-errors analyze        - Análise completa');
      console.log('  npm run analyze-errors clean [dias]   - Limpa logs antigos');
      console.log('  npm run analyze-errors stats          - Estatísticas rápidas');
    }
    
  } catch (error) {
    console.error('❌ Erro na análise:', error.message);
    process.exit(1);
  }
}

main();
