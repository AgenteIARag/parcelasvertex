const fs = require('fs');
const path = require('path');

// Carregar variáveis de ambiente do arquivo .env local de forma nativa (sem dependências)
function loadEnv() {
  const envPath = path.join(__dirname, '.env');
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf8');
    content.split(/\r?\n/).forEach(line => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const index = trimmed.indexOf('=');
        if (index !== -1) {
          const key = trimmed.substring(0, index).trim();
          const value = trimmed.substring(index + 1).trim();
          // Remove aspas simples ou duplas do início e fim, se houver
          const cleanedValue = value.replace(/^['"]|['"]$/g, '');
          process.env[key] = cleanedValue;
        }
      }
    });
  }
}

loadEnv();

const N8N_API_URL = process.env.N8N_API_URL;
const N8N_API_KEY = process.env.N8N_API_KEY;

if (!N8N_API_URL || !N8N_API_KEY) {
  console.error('\x1b[31mErro: N8N_API_URL ou N8N_API_KEY não foram definidos no arquivo .env!\x1b[0m');
  process.exit(1);
}

// Cabeçalhos padrão para a API do n8n
const headers = {
  'X-N8N-API-KEY': N8N_API_KEY,
  'Content-Type': 'application/json'
};

// Formatar nome do arquivo amigável
function sanitizeFilename(name) {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove acentos
    .replace(/[^a-z0-9]/g, '_') // Substitui caracteres especiais por underline
    .replace(/_+/g, '_') // Remove múltiplos underlines seguidos
    .replace(/^_+|_+$/g, ''); // Remove underlines no início ou fim
}

// 1. Listar Workflows
async function listWorkflows() {
  try {
    console.log('\x1b[36mConectando ao n8n e buscando workflows...\x1b[0m');
    const response = await fetch(`${N8N_API_URL}/workflows`, { headers });
    
    if (!response.ok) {
      throw new Error(`Erro na API (${response.status}): ${response.statusText}`);
    }
    
    const resData = await response.json();
    const workflows = resData.data || [];
    
    if (workflows.length === 0) {
      console.log('\x1b[33mNenhum workflow encontrado no n8n.\x1b[0m');
      return;
    }
    
    console.log('\n\x1b[32m=== WORKFLOWS NO N8N ===\x1b[0m');
    console.table(workflows.map(w => ({
      ID: w.id,
      Nome: w.name,
      Ativo: w.active ? 'Sim (Ativo)' : 'Não (Inativo)',
      Nós: w.nodes ? w.nodes.length : 0,
      Atualizado: new Date(w.updatedAt).toLocaleString('pt-BR')
    })));
  } catch (error) {
    console.error('\x1b[31mErro ao listar workflows:\x1b[0m', error.message);
  }
}

// 2. Backup dos Workflows para arquivos JSON locais
async function backupWorkflows() {
  try {
    console.log('\x1b[36mIniciando backup dos workflows do n8n...\x1b[0m');
    const response = await fetch(`${N8N_API_URL}/workflows`, { headers });
    
    if (!response.ok) {
      throw new Error(`Erro na API (${response.status}): ${response.statusText}`);
    }
    
    const resData = await response.json();
    const workflows = resData.data || [];
    
    if (workflows.length === 0) {
      console.log('\x1b[33mNenhum workflow encontrado para fazer backup.\x1b[0m');
      return;
    }
    
    const backupDir = path.join(__dirname, 'workflows');
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }
    
    console.log(`\nSalvando arquivos na pasta: \x1b[34m${backupDir}\x1b[0m\n`);
    
    for (const w of workflows) {
      // Faz fetch detalhado do workflow para garantir que temos nodes e connections
      const detailResponse = await fetch(`${N8N_API_URL}/workflows/${w.id}`, { headers });
      if (!detailResponse.ok) {
        console.warn(`\x1b[33mNão foi possível baixar os detalhes do workflow ID: ${w.id}\x1b[0m`);
        continue;
      }
      
      const fullWorkflow = await detailResponse.json();
      const filename = `${sanitizeFilename(w.name)}_${w.id}.json`;
      const filePath = path.join(backupDir, filename);
      
      fs.writeFileSync(filePath, JSON.stringify(fullWorkflow, null, 2), 'utf8');
      console.log(`\x1b[32m✔ Salvo com sucesso:\x1b[0m ${filename}`);
    }
    
    console.log('\n\x1b[32mBackup concluído com sucesso!\x1b[0m');
  } catch (error) {
    console.error('\x1b[31mErro ao fazer backup:\x1b[0m', error.message);
  }
}

// 3. Enviar/Atualizar Workflow no n8n a partir de um JSON local
async function pushWorkflow(fileName) {
  try {
    let filePath = fileName;
    
    // Se o usuário passar apenas o nome do arquivo, procura na pasta workflows/
    if (!fs.existsSync(filePath)) {
      const potentialPath = path.join(__dirname, 'workflows', fileName);
      if (fs.existsSync(potentialPath)) {
        filePath = potentialPath;
      } else {
        throw new Error(`Arquivo não encontrado: ${fileName}`);
      }
    }
    
    console.log(`\x1b[36mLendo arquivo local: ${filePath}...\x1b[0m`);
    const fileContent = fs.readFileSync(filePath, 'utf8');
    const workflowData = JSON.parse(fileContent);
    
    if (!workflowData.name) {
      throw new Error('O arquivo de workflow JSON precisa ter um campo "name".');
    }
    
    const workflowId = workflowData.id;
    let response;
    
    if (workflowId) {
      console.log(`Tentando atualizar o workflow existente no n8n (ID: ${workflowId})...`);
      response = await fetch(`${N8N_API_URL}/workflows/${workflowId}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({
          name: workflowData.name,
          nodes: workflowData.nodes || [],
          connections: workflowData.connections || {},
          settings: workflowData.settings || {},
          staticData: workflowData.staticData || null
        })
      });
      
      if (response.status === 404) {
        console.log(`Workflow ID ${workflowId} não existe no n8n. Tentando criar como novo...`);
        // Remove o ID para criar um novo no n8n
        delete workflowData.id;
      }
    }
    
    // Se não tinha ID ou se o PUT retornou 404 e foi limpo
    if (!workflowId || response.status === 404) {
      console.log(`Criando novo workflow "${workflowData.name}" no n8n...`);
      response = await fetch(`${N8N_API_URL}/workflows`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          name: workflowData.name,
          nodes: workflowData.nodes || [],
          connections: workflowData.connections || {},
          settings: workflowData.settings || {},
          staticData: workflowData.staticData || null
        })
      });
    }
    
    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Erro na API (${response.status}): ${errText}`);
    }
    
    const resData = await response.json();
    console.log(`\n\x1b[32m✔ Workflow sincronizado com sucesso!\x1b[0m`);
    console.log(`Nome: \x1b[1m${resData.name}\x1b[0m`);
    console.log(`ID no n8n: \x1b[34m${resData.id}\x1b[0m`);
    console.log(`Status de Ativação: ${resData.active ? '\x1b[32mAtivo\x1b[0m' : '\x1b[33mInativo\x1b[0m'}`);
  } catch (error) {
    console.error('\x1b[31mErro ao sincronizar workflow:\x1b[0m', error.message);
  }
}

// Processar argumentos de linha de comando
const args = process.argv.slice(2);
const command = args[0] ? args[0].toLowerCase() : null;

if (!command) {
  console.log(`
\x1b[36m=== UTILIÁRIO DE SINCRONIZAÇÃO N8N ===\x1b[0m
Uso: node sync.cjs <comando> [argumentos]

Comandos disponíveis:
  \x1b[32mlist\x1b[0m           Lista todos os workflows presentes no n8n com ID, status e última atualização.
  \x1b[32mbackup\x1b[0m         Baixa todos os workflows do n8n e salva na pasta local 'workflows/' como JSON.
  \x1b[32mpush <arquivo>\x1b[0m Envia um workflow local (JSON) para o n8n. Se já possuir ID, atualiza; senão, cria um novo.

Exemplos:
  node sync.cjs list
  node sync.cjs backup
  node sync.cjs push sdr_CISP3XhWR3nLThWW.json
`);
  process.exit(0);
}

switch (command) {
  case 'list':
    listWorkflows();
    break;
  case 'backup':
    backupWorkflows();
    break;
  case 'push':
    const fileArg = args[1];
    if (!fileArg) {
      console.error('\x1b[31mErro: Você precisa especificar o nome do arquivo JSON para enviar!\x1b[0m');
      console.log('Exemplo: node sync.cjs push sdr_CISP3XhWR3nLThWW.json');
      process.exit(1);
    }
    pushWorkflow(fileArg);
    break;
  default:
    console.error(`\x1b[31mComando desconhecido: ${command}\x1b[0m`);
    console.log('Execute "node sync.cjs" para ver os comandos disponíveis.');
    process.exit(1);
}
