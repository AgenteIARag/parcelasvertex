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
  MenuItem,
  Card,
  CardContent,
  Avatar
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
import GroupIcon from '@mui/icons-material/Group';
import PaymentsIcon from '@mui/icons-material/Payments';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';

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

  // Métricas consolidadas para os cards totalizadores (respondem aos filtros)
  const metricas = useMemo(() => {
    let clientesAtivos = 0;
    let clientesInativos = 0;
    let totalContratos = 0;
    let contratosAtivos = 0;
    let contratosCancelados = 0;
    let vgvTotal = 0;
    let vgvAtivo = 0;
    let lucroComissaoTotal = 0;

    clientesFiltrados.forEach(c => {
      // Contratos do cliente
      let contratos = vendas.filter(v => 
        v.clienteId === c.id || 
        (!v.clienteId && v.cliente && v.cliente.toLowerCase().trim() === c.nome.toLowerCase().trim())
      );

      // Se há filtro por administradora ou vendedor, aplicamos nas cotas
      if (filtroAdministradora !== 'Todas') {
        contratos = contratos.filter(v => v.administradoraNome === filtroAdministradora);
      }
      if (filtroVendedor !== 'Todos') {
        contratos = contratos.filter(v => v.vendedorNome === filtroVendedor);
      }

      let temContratoAtivo = false;

      contratos.forEach(v => {
        totalContratos++;
        const valorVenda = Number(v.valorVenda) || 0;
        vgvTotal += valorVenda;

        let mesCancelamento: string | null = null;
        Object.keys(v.projecaoMensal || {}).sort().forEach(mes => {
          const celula = v.projecaoMensal[mes];
          if (celula.status === 'Paga') {
            lucroComissaoTotal += (celula.comissaoGerada || 0);
          }
          if (celula.status === 'Cancelada' && !mesCancelamento) {
            mesCancelamento = mes;
          }
        });

        const isCancelado = v.statusCliente?.toLowerCase() === 'cancelado' || mesCancelamento !== null;
        if (isCancelado) {
          contratosCancelados++;
        } else {
          contratosAtivos++;
          vgvAtivo += valorVenda;
          temContratoAtivo = true;
        }
      });

      if (temContratoAtivo) {
        clientesAtivos++;
      } else {
        clientesInativos++;
      }
    });

    return {
      totalClientes: clientesFiltrados.length,
      clientesAtivos,
      clientesInativos,
      totalContratos,
      contratosAtivos,
      contratosCancelados,
      vgvAtivo,
      vgvTotal,
      lucroComissaoTotal
    };
  }, [clientesFiltrados, vendas, filtroAdministradora, filtroVendedor]);

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

      {/* Cards Totalizadores de Valores e Quantidades (Respondem aos Filtros) */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {/* 1. Quantidade de Clientes */}
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card
            elevation={0}
            sx={{
              borderRadius: 3,
              border: `1px solid ${theme.palette.mode === 'dark' ? '#1f2937' : '#e5e7eb'}`,
              background: theme.palette.mode === 'dark' ? '#111827' : '#ffffff',
              transition: 'transform 0.2s, box-shadow 0.2s',
              '&:hover': { 
                transform: 'translateY(-2px)',
                boxShadow: theme.palette.mode === 'dark' ? '0 4px 20px rgba(0,0,0,0.5)' : '0 4px 20px rgba(0,0,0,0.05)'
              }
            }}
          >
            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  Total de Clientes
                </Typography>
                <Avatar sx={{ bgcolor: 'rgba(99, 102, 241, 0.12)', color: 'primary.main', width: 34, height: 34 }}>
                  <GroupIcon sx={{ fontSize: 19 }} />
                </Avatar>
              </Box>
              <Typography variant="h6" sx={{ fontWeight: 800, color: 'text.primary', lineHeight: 1.2 }}>
                {metricas.totalClientes} {metricas.totalClientes === 1 ? 'cliente' : 'clientes'}
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 0.5, fontSize: '0.73rem' }}>
                <Box component="span" sx={{ color: 'success.main', fontWeight: 600 }}>{metricas.clientesAtivos} ativos</Box>
                {' • '}
                <Box component="span" sx={{ color: 'text.secondary' }}>{metricas.clientesInativos} inativos</Box>
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        {/* 2. Quantidade de Contratos (PACs) */}
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card
            elevation={0}
            sx={{
              borderRadius: 3,
              border: `1px solid ${theme.palette.mode === 'dark' ? '#1f2937' : '#e5e7eb'}`,
              background: theme.palette.mode === 'dark' ? '#111827' : '#ffffff',
              transition: 'transform 0.2s, box-shadow 0.2s',
              '&:hover': { 
                transform: 'translateY(-2px)',
                boxShadow: theme.palette.mode === 'dark' ? '0 4px 20px rgba(0,0,0,0.5)' : '0 4px 20px rgba(0,0,0,0.05)'
              }
            }}
          >
            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  Total de Contratos (PACs)
                </Typography>
                <Avatar sx={{ bgcolor: 'rgba(59, 130, 246, 0.12)', color: 'info.main', width: 34, height: 34 }}>
                  <AssignmentIcon sx={{ fontSize: 19 }} />
                </Avatar>
              </Box>
              <Typography variant="h6" sx={{ fontWeight: 800, color: 'text.primary', lineHeight: 1.2 }}>
                {metricas.totalContratos} {metricas.totalContratos === 1 ? 'cota' : 'cotas'}
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 0.5, fontSize: '0.73rem' }}>
                <Box component="span" sx={{ color: 'info.main', fontWeight: 600 }}>{metricas.contratosAtivos} ativas</Box>
                {' • '}
                <Box component="span" sx={{ color: 'error.main' }}>{metricas.contratosCancelados} canceladas</Box>
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        {/* 3. Valor VGV Ativo em Carteira */}
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card
            elevation={0}
            sx={{
              borderRadius: 3,
              border: `1px solid ${theme.palette.mode === 'dark' ? '#1f2937' : '#e5e7eb'}`,
              background: theme.palette.mode === 'dark' ? '#111827' : '#ffffff',
              transition: 'transform 0.2s, box-shadow 0.2s',
              '&:hover': { 
                transform: 'translateY(-2px)',
                boxShadow: theme.palette.mode === 'dark' ? '0 4px 20px rgba(0,0,0,0.5)' : '0 4px 20px rgba(0,0,0,0.05)'
              }
            }}
          >
            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  VGV Ativo em Carteira
                </Typography>
                <Avatar sx={{ bgcolor: 'rgba(245, 158, 11, 0.12)', color: 'warning.main', width: 34, height: 34 }}>
                  <AccountBalanceWalletIcon sx={{ fontSize: 19 }} />
                </Avatar>
              </Box>
              <Typography variant="h6" sx={{ fontWeight: 800, color: 'text.primary', lineHeight: 1.2 }}>
                {formatarMoeda(metricas.vgvAtivo)}
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 0.5, fontSize: '0.73rem' }}>
                Crédito total em cotas ativas
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        {/* 4. Valor Lucro Total da Comissão (LTV) */}
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card
            elevation={0}
            sx={{
              borderRadius: 3,
              border: `1px solid ${theme.palette.mode === 'dark' ? '#1f2937' : '#e5e7eb'}`,
              background: theme.palette.mode === 'dark' ? '#111827' : '#ffffff',
              transition: 'transform 0.2s, box-shadow 0.2s',
              '&:hover': { 
                transform: 'translateY(-2px)',
                boxShadow: theme.palette.mode === 'dark' ? '0 4px 20px rgba(0,0,0,0.5)' : '0 4px 20px rgba(0,0,0,0.05)'
              }
            }}
          >
            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  Lucro da Comissão (LTV)
                </Typography>
                <Avatar sx={{ bgcolor: 'rgba(16, 185, 129, 0.12)', color: 'success.main', width: 34, height: 34 }}>
                  <PaymentsIcon sx={{ fontSize: 19 }} />
                </Avatar>
              </Box>
              <Typography variant="h6" sx={{ fontWeight: 800, color: 'success.main', lineHeight: 1.2 }}>
                {formatarMoeda(metricas.lucroComissaoTotal)}
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 0.5, fontSize: '0.73rem' }}>
                Total de comissões recebidas
              </Typography>
            </CardContent>
          </Card>
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
        <Table size="small">
          <TableHead>
            <TableRow sx={{ '& th': { py: 1, whiteSpace: 'nowrap', fontSize: '0.8rem' } }}>
              <TableCell width={40} sx={{ px: 1 }}></TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Nome do Cliente</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Contato</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
              <TableCell sx={{ fontWeight: 600 }} align="center">Total de Contratos</TableCell>
              <TableCell sx={{ fontWeight: 600 }} align="right">Lucro Total (LTV)</TableCell>
              <TableCell align="center" width={90} sx={{ fontWeight: 600, px: 1 }}>Ações</TableCell>
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
      <TableRow 
        hover
        sx={{ 
          '& > *': { 
            borderBottom: 'unset',
            py: 0.75,
            whiteSpace: 'nowrap'
          },
          '&:hover': {
            bgcolor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)'
          }
        }}
      >
        <TableCell width={40} sx={{ py: 0.75, px: 1 }}>
          <IconButton
            aria-label="expand row"
            size="small"
            onClick={() => setOpen(!open)}
            sx={{ p: 0.5 }}
          >
            {open ? <KeyboardArrowUpIcon fontSize="small" /> : <KeyboardArrowDownIcon fontSize="small" />}
          </IconButton>
        </TableCell>
        <TableCell sx={{ py: 0.75, fontWeight: 500 }}>
          <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '0.85rem' }}>{cliente.nome}</Typography>
            <Chip 
              label={empresas?.find((e: Empresa) => e.id === (cliente.empresaId || 'emp_vertex'))?.nome || 'Matriz'} 
              size="small" 
              sx={{ 
                height: 18, 
                fontSize: '0.65rem', 
                bgcolor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
                fontWeight: 500
              }} 
            />
          </Box>
        </TableCell>
        <TableCell sx={{ py: 0.75 }}>
          <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75, fontSize: '0.82rem' }}>
            <span>{cliente.telefone || '-'}</span>
            {cliente.email && (
              <Typography component="span" variant="caption" color="text.secondary" sx={{ fontSize: '0.78rem' }}>
                • {cliente.email}
              </Typography>
            )}
          </Box>
        </TableCell>
        <TableCell sx={{ py: 0.75 }}>
          <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75 }}>
            {totais.ativos > 0 ? (
              <Chip label="Ativo" size="small" color="success" sx={{ height: 20, fontSize: '0.68rem', fontWeight: 600 }} />
            ) : (
              <Chip label="Inativo" size="small" color="default" sx={{ height: 20, fontSize: '0.68rem' }} />
            )}
            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.75rem' }}>
              ({totais.ativos} ativ. / {totais.cancelados} inat.)
            </Typography>
          </Box>
        </TableCell>
        <TableCell align="center" sx={{ py: 0.75 }}>
          <Chip 
            label={`${totais.totalContratos} PAC(s)`} 
            size="small" 
            sx={{ 
              height: 20,
              fontSize: '0.72rem',
              fontWeight: 600, 
              bgcolor: totais.ativos > 0 ? 'rgba(59, 130, 246, 0.1)' : 'rgba(148, 163, 184, 0.1)',
              color: totais.ativos > 0 ? 'info.main' : 'text.secondary'
            }} 
          />
        </TableCell>
        <TableCell align="right" sx={{ py: 0.75, fontWeight: 700, color: 'success.main', fontSize: '0.85rem' }}>
          {formatarMoeda(totais.lucro)}
        </TableCell>
        <TableCell align="center" sx={{ py: 0.75, px: 1, whiteSpace: 'nowrap' }}>
          <IconButton size="small" onClick={onEdit} color="primary" sx={{ p: 0.5 }}>
            <EditIcon fontSize="small" />
          </IconButton>
          {isSuperMaster && (
            <IconButton size="small" onClick={onDelete} color="error" sx={{ p: 0.5, ml: 0.5 }}>
              <DeleteIcon fontSize="small" />
            </IconButton>
          )}
        </TableCell>
      </TableRow>
      <TableRow>
        <TableCell style={{ paddingBottom: 0, paddingTop: 0 }} colSpan={7}>
          <Collapse in={open} timeout="auto" unmountOnExit>
            <Box sx={{ margin: 1.5, p: 2.5, bgcolor: theme.palette.mode === 'dark' ? 'rgba(15, 23, 42, 0.5)' : '#f8fafc', borderRadius: 3, border: `1px solid ${theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.05)' : '#e2e8f0'}` }}>
              
              {/* Resumo do Cliente com Lucro Totalizado */}
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mb: 2.5, alignItems: 'center' }}>
                <Box sx={{ p: 1, px: 1.8, borderRadius: 2, bgcolor: theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.03)' : '#ffffff', border: `1px solid ${theme.palette.mode === 'dark' ? '#1f2937' : '#e2e8f0'}` }}>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <CheckCircleIcon sx={{ fontSize: 15, color: 'success.main' }} /> Ativos
                  </Typography>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>{totais.ativos} cotas</Typography>
                </Box>
                <Box sx={{ p: 1, px: 1.8, borderRadius: 2, bgcolor: theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.03)' : '#ffffff', border: `1px solid ${theme.palette.mode === 'dark' ? '#1f2937' : '#e2e8f0'}` }}>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <CancelIcon sx={{ fontSize: 15, color: 'error.main' }} /> Cancelados
                  </Typography>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>{totais.cancelados} cotas</Typography>
                </Box>
                <Box sx={{ p: 1, px: 1.8, borderRadius: 2, bgcolor: theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.03)' : '#ffffff', border: `1px solid ${theme.palette.mode === 'dark' ? '#1f2937' : '#e2e8f0'}` }}>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <MonetizationOnIcon sx={{ fontSize: 15, color: 'primary.main' }} /> VGV Ativo
                  </Typography>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>{formatarMoeda(totais.vgvAtivo)}</Typography>
                </Box>
                <Box sx={{ p: 1, px: 2, borderRadius: 2, bgcolor: theme.palette.mode === 'dark' ? 'rgba(34, 197, 94, 0.1)' : '#f0fdf4', border: '1px solid', borderColor: theme.palette.mode === 'dark' ? 'rgba(34, 197, 94, 0.25)' : '#bbf7d0' }}>
                  <Typography variant="caption" sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: 'success.main', fontWeight: 600 }}>
                    <MonetizationOnIcon sx={{ fontSize: 15, color: 'success.main' }} /> Lucro Total da Comissão (LTV)
                  </Typography>
                  <Typography variant="subtitle2" sx={{ fontWeight: 800, color: 'success.main', fontSize: '0.95rem' }}>
                    {formatarMoeda(totais.lucro)}
                  </Typography>
                </Box>
                {cliente.observacoes && (
                  <Box sx={{ ml: { xs: 0, sm: 'auto' }, maxWidth: 350, p: 1, px: 1.5, borderRadius: 2, bgcolor: theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.02)' : 'rgba(0, 0, 0, 0.02)' }}>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <AssignmentIcon sx={{ fontSize: 14 }} /> Observações:
                    </Typography>
                    <Typography variant="caption" sx={{ fontStyle: 'italic', display: 'block' }}>"{cliente.observacoes}"</Typography>
                  </Box>
                )}
              </Box>

              <Typography variant="subtitle2" gutterBottom component="div" sx={{ fontWeight: 600, fontSize: '0.85rem' }}>
                Histórico de Contratos (PACs)
              </Typography>
              <Table size="small" aria-label="contratos">
                <TableHead>
                  <TableRow sx={{ '& th': { py: 0.8, whiteSpace: 'nowrap', fontSize: '0.78rem' } }}>
                    <TableCell>PAC</TableCell>
                    <TableCell>Segmento</TableCell>
                    <TableCell>Data da Venda</TableCell>
                    <TableCell align="right">Valor (Crédito)</TableCell>
                    <TableCell align="right">Lucro da Comissão</TableCell>
                    <TableCell align="center">Status</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {contratos.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} align="center" sx={{ py: 2, color: 'text.secondary' }}>Nenhum contrato lançado</TableCell>
                    </TableRow>
                  ) : contratos.map((venda: LancamentoVenda) => {
                    let mesCancelamento: string | null = null;
                    let lucroDesteContrato = 0;
                    Object.keys(venda.projecaoMensal || {}).sort().forEach(mes => {
                      const celula = venda.projecaoMensal[mes];
                      if (celula.status === 'Paga') {
                        lucroDesteContrato += (celula.comissaoGerada || 0);
                      }
                      if (celula.status === 'Cancelada' && !mesCancelamento) {
                        mesCancelamento = mes;
                      }
                    });
                    const isCancelado = venda.statusCliente?.toLowerCase() === 'cancelado' || mesCancelamento !== null;

                    return (
                      <TableRow key={venda.id} hover sx={{ '& td': { py: 0.6 } }}>
                        <TableCell component="th" scope="row" sx={{ fontWeight: 500 }}>
                          {venda.pac || '-'}
                        </TableCell>
                        <TableCell>{venda.segmento}</TableCell>
                        <TableCell>{venda.dataVenda ? new Date(venda.dataVenda + 'T00:00:00').toLocaleDateString('pt-BR') : '-'}</TableCell>
                        <TableCell align="right">{formatarMoeda(venda.valorVenda)}</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 600, color: 'success.main' }}>
                          {formatarMoeda(lucroDesteContrato)}
                        </TableCell>
                        <TableCell align="center">
                          <Chip 
                            label={isCancelado ? 'Cancelado' : 'Ativo'} 
                            size="small"
                            color={isCancelado ? 'error' : 'success'}
                            variant="outlined"
                            sx={{ height: 18, fontSize: '0.65rem' }}
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
