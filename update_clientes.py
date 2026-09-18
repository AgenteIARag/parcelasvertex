import re
with open('src/components/ClientesCadastro.tsx', 'r', encoding='utf-8') as f:
    cc = f.read()

cc = cc.replace('import type { Cliente, LancamentoVenda } from \'../types\';', 'import type { Cliente, LancamentoVenda, Empresa } from \'../types\';')

cc = cc.replace('interface ClientesCadastroProps {\n  clientes: Cliente[];', 'interface ClientesCadastroProps {\n  clientes: Cliente[];\n  empresas: Empresa[];')

cc = cc.replace('export const ClientesCadastro: React.FC<ClientesCadastroProps> = ({\n  clientes,\n  vendas,', 'export const ClientesCadastro: React.FC<ClientesCadastroProps> = ({\n  clientes,\n  empresas,\n  vendas,')

cc = cc.replace('<TableCell sx={{ fontWeight: 600 }}>Documento</TableCell>', '<TableCell sx={{ fontWeight: 600 }}>Status</TableCell>')

cc = cc.replace('<RowCliente \n                  key={cliente.id} \n                  cliente={cliente} \n                  vendas={vendas}', '<RowCliente \n                  key={cliente.id} \n                  cliente={cliente} \n                  vendas={vendas}\n                  empresas={empresas}')

cc = cc.replace('const RowCliente = ({ cliente, vendas, onEdit, onDelete, theme }: any) => {', 'const RowCliente = ({ cliente, vendas, empresas, onEdit, onDelete, theme }: any) => {')

nome_cell_old = '''        <TableCell sx={{ fontWeight: 500 }}>
          {cliente.nome}
        </TableCell>'''

nome_cell_new = '''        <TableCell sx={{ fontWeight: 500 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column' }}>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>{cliente.nome}</Typography>
            <Chip 
              label={empresas?.find((e: Empresa) => e.id === (cliente.empresaId || 'emp_vertex'))?.nome || 'Matriz'} 
              size="small" 
              sx={{ width: 'fit-content', height: 18, fontSize: '0.65rem', mt: 0.5, bgcolor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }} 
            />
          </Box>
        </TableCell>'''

cc = cc.replace(nome_cell_old, nome_cell_new)

doc_cell_old = '''        <TableCell>
          {cliente.cpfCnpj || '-'}
        </TableCell>'''

doc_cell_new = '''        <TableCell>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            {totais.ativos > 0 ? (
              <Chip label="Ativo" size="small" color="success" sx={{ width: 'fit-content', height: 20, fontSize: '0.7rem' }} />
            ) : (
              <Chip label="Inativo" size="small" color="default" sx={{ width: 'fit-content', height: 20, fontSize: '0.7rem' }} />
            )}
            <Typography variant="caption" color="text.secondary">
              {totais.ativos} ativas / {totais.cancelados} inativas
            </Typography>
          </Box>
        </TableCell>'''

cc = cc.replace(doc_cell_old, doc_cell_new)

with open('src/components/ClientesCadastro.tsx', 'w', encoding='utf-8') as f:
    f.write(cc)
