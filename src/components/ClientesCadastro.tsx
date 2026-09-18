import React, { useState, useMemo } from 'react';
import {
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Button,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Grid,
  useTheme,
  Collapse,
  Chip,
  InputAdornment,
  MenuItem
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import SearchIcon from '@mui/icons-material/Search';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import MonetizationOnIcon from '@mui/icons-material/MonetizationOn';
import AssignmentIcon from '@mui/icons-material/Assignment';

import type { Cliente, LancamentoVenda, Empresa } from '../types';
import { formatarMoeda } from '../utils/formatters';

interface ClientesCadastroProps {
  clientes: Cliente[];
  empresas: Empresa[];
  vendas: LancamentoVenda[];
  onAdicionar: (cliente: Cliente) => void;
  onAtualizar: (cliente: Cliente) => void;
  onExcluir: (id: string) => void;
  isSuperMaster?: boolean;
}

export const ClientesCadastro: React.FC<ClientesCadastroProps> = ({
  clientes,
  empresas,
  vendas,
  onAdicionar,
  onAtualizar,
  onExcluir,
  isSuperMaster
}) => {
  const theme = useTheme();
  
  const [openDialog, setOpenDialog] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  const [nome, setNome] = useState('');
  const [cpfCnpj, setCpfCnpj] = useState('');
  const [telefone, setTelefone] = useState('');
  const [email, setEmail] = useState('');
  const [observacoes, setObservacoes] = useState('');
  
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [termoBusca, setTermoBusca] = useState('');
  const [filtroStatus, setFiltroStatus] = useState<string>('Todos');
  const [filtroAdministradora, setFiltroAdministradora] = useState<string>('Todas');
  const [filtroVendedor, setFiltroVendedor] = useState<string>('Todos');

  const administradorasUnicas = useMemo(() => {
    const adms = vendas.map(v => v.administradoraNome).filter(Boolean);
    const unicas = Array.from(new Set(adms)) as string[];
    return ['Todas', ...unicas.sort()];
  }, [vendas]);

  const vendedoresUnicos = useMemo(() => {
    const vends = vendas.map(v => v.vendedorNome).filter(Boolean);
    const unicos = Array.from(new Set(vends)) as string[];
    return ['Todos', ...unicos.sort()];
  }, [vendas]);

  const handleOpenDialog = (cliente?: Cliente) => {
    if (cliente) {
      setEditingId(cliente.id);
      setNome(cliente.nome);
      setCpfCnpj(cliente.cpfCnpj || '');
      setTelefone(cliente.telefone || '');
      setEmail(cliente.email || '');
      setObservacoes(cliente.observacoes || '');
    } else {
      setEditingId(null);
      setNome('');
      setCpfCnpj('');
      setTelefone('');
      setEmail('');
      setObservacoes('');
    }
    setErrors({});
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
  };

  const handleSave = () => {
    const tempErrors: Record<string, string> = {};
    if (!nome.trim()) tempErrors.nome = 'Nome do cliente é obrigatório.';

    if (Object.keys(tempErrors).length > 0) {
      setErrors(tempErrors);
      return;
    }

    const payload: Cliente = {
      id: editingId || `cli_${Date.now()}`,
      nome: nome.trim(),
      cpfCnpj: cpfCnpj.trim() || undefined,
      telefone: telefone.trim() || undefined,
      email: email.trim() || undefined,
      observacoes: observacoes.trim() || undefined
    };

    if (editingId) {
      onAtualizar(payload);
    } else {
      onAdicionar(payload);
    }
    handleCloseDialog();
  };

  const clientesFiltrados = useMemo(() => {
    return clientes.filter(c => {
      // Filtro de texto
      const busca = termoBusca.toLowerCase();
      const bateuTexto = 
        c.nome.toLowerCase().includes(busca) ||
        (c.cpfCnpj && c.cpfCnpj.includes(busca)) ||
        (c.telefone && c.telefone.includes(busca));

      if (!bateuTexto) return false;

      // Obtém os contratos do cliente
      const contratos = vendas.filter(v => 
        v.clienteId === c.id || 
        (!v.clienteId && v.cliente && v.cliente.toLowerCase().trim() === c.nome.toLowerCase().trim())
      );

      // Status
      if (filtroStatus !== 'Todos') {
        let ativos = 0;
        contratos.forEach(v => {
          let mesCancelamento: string | null = null;
          const mesesProjecao = Object.keys(v.projecaoMensal || {}).sort();
          mesesProjecao.forEach(mes => {
            if (v.projecaoMensal[mes].status === 'Cancelada' && !mesCancelamento) {
              mesCancelamento = mes;
            }
          });
          const isCancelado = v.statusCliente?.toLowerCase() === 'cancelado' || mesCancelamento !== null;
          if (!isCancelado) ativos++;
        });
        const clienteAtivo = ativos > 0;
        
        if (filtroStatus === 'Ativos' && !clienteAtivo) return false;
        if (filtroStatus === 'Inativos' && clienteAtivo) return false;
      }

      // Administradora
      if (filtroAdministradora !== 'Todas') {
        const temAdministradora = contratos.some(v => v.administradoraNome === filtroAdministradora);
        if (!temAdministradora) return false;
      }

      // Vendedor
      if (filtroVendedor !== 'Todos') {
        const temVendedor = contratos.some(v => v.vendedorNome === filtroVendedor);
        if (!temVendedor) return false;
      }

      return true;
    });
  }, [clientes, vendas, termoBusca, filtroStatus, filtroAdministradora, filtroVendedor]);

  return (
    <Box sx={{ p: 1 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3 }}>
        <Box>
          <Typography variant="h5" sx={{ fontFamily: 'Outfit, sans-serif', fontWeight: 700 }}>
            Clientes Cadastrados
          </Typography>
          <Typography variant="caption" sx={{ color: '#94a3b8' }}>
            Gerencie sua base de clientes, visualize o histórico de contratos e o LTV gerado.
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => handleOpenDialog()}
          sx={{
            borderRadius: 2,
            textTransform: 'none',
            fontWeight: 600
          }}
        >
          Novo Cliente
        </Button>
      </Box>

      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, md: 4 }}>
          <TextField
            fullWidth
            placeholder="Buscar por nome, CPF/CNPJ ou telefone..."
            value={termoBusca}
            onChange={(e) => setTermoBusca(e.target.value)}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon sx={{ color: 'text.secondary' }} />
                  </InputAdornment>
                ),
                sx: { borderRadius: 3 }
              }
            }}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 4, md: 2 }}>
          <TextField
            select
            fullWidth
            label="Status"
            value={filtroStatus}
            onChange={(e) => setFiltroStatus(e.target.value)}
            slotProps={{ input: { sx: { borderRadius: 3 } } }}
          >
            {['Todos', 'Ativos', 'Inativos'].map(opt => (
              <MenuItem key={opt} value={opt}>{opt}</MenuItem>
            ))}
          </TextField>
        </Grid>
        <Grid size={{ xs: 12, sm: 4, md: 3 }}>
          <TextField
            select
            fullWidth
            label="Administradora"
            value={filtroAdministradora}
            onChange={(e) => setFiltroAdministradora(e.target.value)}
            slotProps={{ input: { sx: { borderRadius: 3 } } }}
          >
            {administradorasUnicas.map(opt => (
              <MenuItem key={opt} value={opt}>{opt}</MenuItem>
            ))}
          </TextField>
        </Grid>
        <Grid size={{ xs: 12, sm: 4, md: 3 }}>
          <TextField
            select
            fullWidth
            label="Vendedor"
            value={filtroVendedor}
            onChange={(e) => setFiltroVendedor(e.target.value)}
            slotProps={{ input: { sx: { borderRadius: 3 } } }}
          >
            {vendedoresUnicos.map(opt => (
              <MenuItem key={opt} value={opt}>{opt}</MenuItem>
            ))}
          </TextField>
        </Grid>
      </Grid>

      <TableContainer 
        component={Paper} 
        elevation={0}
        sx={{ 
          borderRadius: 4, 
          border: `1px solid ${theme.palette.mode === 'dark' ? '#1f2937' : '#e5e7eb'}`,
          background: theme.palette.mode === 'dark' ? '#111827' : '#ffffff' 
        }}
      >
        <Table>
          <TableHead>
            <TableRow>
              <TableCell width={50}></TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Nome do Cliente</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Contato</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
              <TableCell sx={{ fontWeight: 600 }} align="center">Total de Contratos</TableCell>
              <TableCell sx={{ fontWeight: 600 }} align="right">Lucro Total (LTV)</TableCell>
              <TableCell align="center" width={100} sx={{ fontWeight: 600 }}>Ações</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {clientesFiltrados.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                  Nenhum cliente encontrado.
                </TableCell>
              </TableRow>
            ) : (
              clientesFiltrados.map((cliente) => (
                <RowCliente 
                  key={cliente.id} 
                  cliente={cliente} 
                  vendas={vendas}
                  empresas={empresas} 
                  onEdit={() => handleOpenDialog(cliente)}
                  onDelete={() => onExcluir(cliente.id)}
                  theme={theme}
                  isSuperMaster={isSuperMaster}
                />
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="sm" fullWidth slotProps={{ paper: { sx: { borderRadius: 3 } } }}>
        <DialogTitle sx={{ fontWeight: 700 }}>
          {editingId ? 'Editar Cliente' : 'Novo Cliente'}
        </DialogTitle>
        <DialogContent dividers>
          <Grid container spacing={2}>
            <Grid size={{ xs: 12 }}>
              <TextField
                fullWidth
                label="Nome Completo"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                error={!!errors.nome}
                helperText={errors.nome}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                label="CPF ou CNPJ"
                value={cpfCnpj}
                onChange={(e) => setCpfCnpj(e.target.value)}
                placeholder="Apenas números"
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                label="Telefone (WhatsApp)"
                value={telefone}
                onChange={(e) => setTelefone(e.target.value)}
                placeholder="(00) 00000-0000"
              />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <TextField
                fullWidth
                label="E-mail"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="email@exemplo.com"
              />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <TextField
                fullWidth
                label="Observações"
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                multiline
                rows={3}
                placeholder="Detalhes adicionais sobre o cliente..."
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={handleCloseDialog} color="inherit">
            Cancelar
          </Button>
          <Button onClick={handleSave} variant="contained" sx={{ borderRadius: 2 }}>
            Salvar
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

const RowCliente = ({ cliente, vendas, empresas, onEdit, onDelete, theme, isSuperMaster }: any) => {
  const [open, setOpen] = useState(false);
  
  // Filtrar as vendas vinculadas a este cliente
  // Tentar pelo clienteId (novo padrão) ou pelo nome exato (legado compatível)
  const contratos = useMemo(() => {
    return vendas.filter((v: LancamentoVenda) => 
      v.clienteId === cliente.id || 
      (!v.clienteId && v.cliente && v.cliente.toLowerCase().trim() === cliente.nome.toLowerCase().trim())
    );
  }, [vendas, cliente]);

  const totais = useMemo(() => {
    let lucro = 0;
    let vgvAtivo = 0;
    let ativos = 0;
    let cancelados = 0;

    contratos.forEach((v: LancamentoVenda) => {
      let lucroDesteContrato = 0;
      let mesCancelamento: string | null = null;
      
      const mesesProjecao = Object.keys(v.projecaoMensal || {}).sort();
      mesesProjecao.forEach(mes => {
        const celula = v.projecaoMensal[mes];
        if (celula.status === 'Paga') {
          lucroDesteContrato += (celula.comissaoGerada || 0);
        }
        if (celula.status === 'Cancelada' && !mesCancelamento) {
          mesCancelamento = mes;
        }
      });

      const isCancelado = v.statusCliente?.toLowerCase() === 'cancelado' || mesCancelamento !== null;
      
      if (isCancelado) {
        cancelados++;
      } else {
        ativos++;
        vgvAtivo += Number(v.valorVenda) || 0;
      }
      
      lucro += lucroDesteContrato;
    });

    return { lucro, vgvAtivo, ativos, cancelados, totalContratos: contratos.length };
  }, [contratos]);

  return (
    <React.Fragment>
      <TableRow sx={{ '& > *': { borderBottom: 'unset' } }}>
        <TableCell>
          <IconButton
            aria-label="expand row"
            size="small"
            onClick={() => setOpen(!open)}
          >
            {open ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon />}
          </IconButton>
        </TableCell>
        <TableCell sx={{ fontWeight: 500 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column' }}>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>{cliente.nome}</Typography>
            <Chip 
              label={empresas?.find((e: Empresa) => e.id === (cliente.empresaId || 'emp_vertex'))?.nome || 'Matriz'} 
              size="small" 
              sx={{ width: 'fit-content', height: 18, fontSize: '0.65rem', mt: 0.5, bgcolor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }} 
            />
          </Box>
        </TableCell>
        <TableCell>
          {cliente.telefone || '-'}
          {cliente.email && <Typography variant="caption" sx={{ display: 'block' }} color="text.secondary">{cliente.email}</Typography>}
        </TableCell>
        <TableCell>
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
        </TableCell>
        <TableCell align="center">
          <Chip 
            label={`${totais.totalContratos} PAC(s)`} 
            size="small" 
            sx={{ 
              fontWeight: 600, 
              bgcolor: totais.ativos > 0 ? 'rgba(59, 130, 246, 0.1)' : 'rgba(148, 163, 184, 0.1)',
              color: totais.ativos > 0 ? 'info.main' : 'text.secondary'
            }} 
          />
        </TableCell>
        <TableCell align="right" sx={{ fontWeight: 600, color: 'success.main' }}>
          {formatarMoeda(totais.lucro)}
        </TableCell>
        <TableCell align="center">
          <IconButton size="small" onClick={onEdit} color="primary">
            <EditIcon fontSize="small" />
          </IconButton>
          {isSuperMaster && (
            <IconButton size="small" onClick={onDelete} color="error">
              <DeleteIcon fontSize="small" />
            </IconButton>
          )}
        </TableCell>
      </TableRow>
      <TableRow>
        <TableCell style={{ paddingBottom: 0, paddingTop: 0 }} colSpan={7}>
          <Collapse in={open} timeout="auto" unmountOnExit>
            <Box sx={{ margin: 2, p: 3, bgcolor: theme.palette.mode === 'dark' ? 'rgba(15, 23, 42, 0.5)' : '#f8fafc', borderRadius: 3 }}>
              
              <Box sx={{ display: 'flex', gap: 3, mb: 3 }}>
                <Box>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <CheckCircleIcon sx={{ fontSize: 16, color: 'success.main' }} /> Ativos
                  </Typography>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>{totais.ativos} cotas</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <CancelIcon sx={{ fontSize: 16, color: 'error.main' }} /> Cancelados
                  </Typography>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>{totais.cancelados} cotas</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <MonetizationOnIcon sx={{ fontSize: 16, color: 'primary.main' }} /> VGV Ativo
                  </Typography>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>{formatarMoeda(totais.vgvAtivo)}</Typography>
                </Box>
                {cliente.observacoes && (
                  <Box sx={{ ml: 'auto', maxWidth: 400 }}>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <AssignmentIcon sx={{ fontSize: 16 }} /> Observações
                    </Typography>
                    <Typography variant="caption" sx={{ fontStyle: 'italic' }}>"{cliente.observacoes}"</Typography>
                  </Box>
                )}
              </Box>

              <Typography variant="subtitle2" gutterBottom component="div" sx={{ fontWeight: 600 }}>
                Histórico de Contratos (PACs)
              </Typography>
              <Table size="small" aria-label="contratos">
                <TableHead>
                  <TableRow>
                    <TableCell>PAC</TableCell>
                    <TableCell>Segmento</TableCell>
                    <TableCell>Data da Venda</TableCell>
                    <TableCell align="right">Valor (Crédito)</TableCell>
                    <TableCell align="center">Status</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {contratos.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} align="center" sx={{ py: 2, color: 'text.secondary' }}>Nenhum contrato lançado</TableCell>
                    </TableRow>
                  ) : contratos.map((venda: LancamentoVenda) => {
                    let mesCancelamento: string | null = null;
                    Object.keys(venda.projecaoMensal || {}).sort().forEach(mes => {
                      if (venda.projecaoMensal[mes].status === 'Cancelada' && !mesCancelamento) {
                        mesCancelamento = mes;
                      }
                    });
                    const isCancelado = venda.statusCliente?.toLowerCase() === 'cancelado' || mesCancelamento !== null;

                    return (
                      <TableRow key={venda.id}>
                        <TableCell component="th" scope="row">
                          {venda.pac || '-'}
                        </TableCell>
                        <TableCell>{venda.segmento}</TableCell>
                        <TableCell>{venda.dataVenda ? new Date(venda.dataVenda + 'T00:00:00').toLocaleDateString('pt-BR') : '-'}</TableCell>
                        <TableCell align="right">{formatarMoeda(venda.valorVenda)}</TableCell>
                        <TableCell align="center">
                          <Chip 
                            label={isCancelado ? 'Cancelado' : 'Ativo'} 
                            size="small"
                            color={isCancelado ? 'error' : 'success'}
                            variant="outlined"
                          />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </Box>
          </Collapse>
        </TableCell>
      </TableRow>
    </React.Fragment>
  );
};
