#!/usr/bin/env node
// scripts/test-intelligence.js - Teste de inteligência do modelo
import 'dotenv/config';
import { askLLM } from '../src/lib/llm.js';

const intelligenceTests = [
  {
    name: "Consistência de Contexto",
    messages: [
      { role: 'system', content: 'Você é Fernando AI, um assistente inteligente.' },
      { role: 'user', content: 'Meu nome é João e eu trabalho com vendas.' },
      { role: 'assistant', content: 'Prazer em conhecê-lo, João! Vendas é uma área muito interessante.' },
      { role: 'user', content: 'Qual é o meu nome e profissão que eu mencionei?' }
    ],
    expectedPattern: /joão.*venda/i,
    description: "Deve lembrar do nome (João) e profissão (vendas)"
  },
  
  {
    name: "Raciocínio Matemático", 
    messages: [
      { role: 'system', content: 'Você é Fernando AI, um assistente inteligente.' },
      { role: 'user', content: 'Se eu tenho 10 maçãs e como 3, depois compro mais 5, quantas maçãs tenho no total?' }
    ],
    expectedPattern: /12|doze/i,
    description: "Deve calcular: 10 - 3 + 5 = 12"
  },
  
  {
    name: "Compreensão de Contexto",
    messages: [
      { role: 'system', content: 'Você é Fernando AI, um assistente inteligente.' },
      { role: 'user', content: 'Estou fazendo um bolo de chocolate. Preciso de 3 ovos mas só tenho 2.' },
      { role: 'user', content: 'O que devo fazer?' }
    ],
    expectedPattern: /comprar|ovo|falta|precisa/i,
    description: "Deve sugerir comprar ovos ou alternativa"
  },
  
  {
    name: "Consistência de Personalidade",
    messages: [
      { role: 'system', content: 'Você é Fernando AI, um assistente inteligente.' },
      { role: 'user', content: 'Como você se chama?' }
    ],
    expectedPattern: /fernando|ai/i,
    description: "Deve responder consistentemente com o nome Fernando AI"
  },
  
  {
    name: "Lógica Sequencial",
    messages: [
      { role: 'system', content: 'Você é Fernando AI, um assistente inteligente.' },
      { role: 'user', content: 'Complete a sequência: 2, 4, 6, 8, ?' }
    ],
    expectedPattern: /10|dez/i,
    description: "Deve identificar padrão e responder 10"
  }
];

async function runTest(test) {
  console.log(`\n🧪 Testando: ${test.name}`);
  console.log(`📋 Esperado: ${test.description}`);
  
  try {
    const response = await askLLM(test.messages);
    const passed = test.expectedPattern.test(response);
    
    console.log(`💬 Resposta: "${response}"`);
    console.log(`${passed ? '✅' : '❌'} Resultado: ${passed ? 'PASSOU' : 'FALHOU'}`);
    
    return passed;
    
  } catch (error) {
    console.log(`❌ Erro no teste: ${error.message}`);
    return false;
  }
}

async function main() {
  console.log('🤖 Fernando AI - Teste de Inteligência\n');
  console.log('Testando capacidades cognitivas do modelo...\n');
  
  let passedTests = 0;
  const totalTests = intelligenceTests.length;
  
  for (const test of intelligenceTests) {
    const passed = await runTest(test);
    if (passed) passedTests++;
    
    // Pausa entre testes para não sobrecarregar
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  console.log('\n' + '='.repeat(50));
  console.log(`📊 RESULTADO FINAL: ${passedTests}/${totalTests} testes passaram`);
  
  const percentage = Math.round((passedTests / totalTests) * 100);
  console.log(`🎯 Taxa de sucesso: ${percentage}%`);
  
  let assessment;
  if (percentage >= 80) {
    assessment = '🟢 EXCELENTE - Modelo muito inteligente';
  } else if (percentage >= 60) {
    assessment = '🟡 BOM - Modelo funcionando adequadamente';
  } else if (percentage >= 40) {
    assessment = '🟠 REGULAR - Modelo com algumas limitações';
  } else {
    assessment = '🔴 RUIM - Modelo precisa de ajustes';
  }
  
  console.log(`📈 Avaliação: ${assessment}`);
  
  if (percentage < 60) {
    console.log('\n💡 SUGESTÕES DE MELHORIA:');
    console.log('  • Verificar se o modelo está funcionando corretamente');
    console.log('  • Considerar usar modelo mais avançado');
    console.log('  • Ajustar parâmetros de temperatura (mais baixo = mais preciso)');
    console.log('  • Verificar se há interferência de outros prompts');
  }
  
  console.log('\n🔧 Para melhorar a inteligência:');
  console.log('  • TEMPERATURE=0.3 (mais preciso)');
  console.log('  • MAX_HISTORY_MESSAGES=100 (mais contexto)');
  console.log('  • TOP_P=0.85 (respostas mais focadas)');
}

main().catch(error => {
  console.error('💥 Erro fatal:', error);
  process.exit(1);
});
