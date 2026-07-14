# Integração e Sincronização Local com o n8n

Este diretório contém ferramentas utilitárias para conectar, fazer backup e sincronizar seus workflows do **n8n** localmente. Isso permite manter o controle de versão dos seus fluxos de trabalho (workflows) como código no seu repositório Git.

## Configuração

1. Certifique-se de que o arquivo `.env` foi criado e contém as chaves correspondentes. Se necessário, copie o arquivo `.env.example`:
   ```bash
   cp .env.example .env
   ```
2. Adicione as informações corretas no seu `.env`:
   - `N8N_API_URL`: O endpoint base da API pública do seu n8n (geralmente `https://seu-n8n.com/api/v1`).
   - `N8N_API_KEY`: A chave da API pública gerada dentro das configurações do seu n8n.

## Comandos Disponíveis

O script utilitário `sync.cjs` foi escrito em Node.js puro e **não possui dependências externas**, rodando nativamente em qualquer instalação do Node.js (v18 ou superior).

### 1. Listar Workflows
Lista todos os workflows presentes no seu n8n, mostrando ID, Nome, Status (Ativo/Inativo), número de nós e a data da última modificação:
```bash
node sync.cjs list
```

### 2. Backup de Workflows
Baixa todos os workflows do seu n8n e os salva como arquivos JSON formatados dentro da pasta local `workflows/`:
```bash
node sync.cjs backup
```
> **Nota:** Os arquivos serão salvos com a nomenclatura `nome_do_workflow_id.json`.

### 3. Enviar / Atualizar um Workflow (Push)
Envia um arquivo JSON de workflow local de volta para o n8n:
```bash
node sync.cjs push <nome-do-arquivo-ou-caminho>
```
* **Se o JSON contiver um ID válido do n8n:** O script tentará atualizar o workflow correspondente usando uma requisição `PUT`.
* **Se o ID não existir no n8n ou o JSON não contiver ID:** O script criará um novo workflow no n8n usando uma requisição `POST` e retornará o novo ID gerado.

**Exemplo:**
```bash
node sync.cjs push sdr_cisp3xhwr3nlthww.json
```
*(O script procura automaticamente na pasta `workflows/` se o caminho relativo direto não for encontrado).*
