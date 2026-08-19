import React, { useState, useEffect, useMemo } from 'react';
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
  Chip,
  useTheme,
  Alert,
  Switch,
  FormControlLabel,
  Tooltip,
  CircularProgress,
  InputAdornment
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import CloseIcon from '@mui/icons-material/Close';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import SearchIcon from '@mui/icons-material/Search';
import ClearIcon from '@mui/icons-material/Clear';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import BlockIcon from '@mui/icons-material/Block';
import type { Administradora, RegraMaster, LancamentoVenda } from '../types';
import {
  obterAdministradorasSupabase,
  salvarAdministradoraSupabase,
  excluirAdministradoraSupabase
} from '../utils/supabase';

interface AdministradorasCadastroProps {
  regras?: RegraMaster[];
  vendas?: LancamentoVenda[];
  onAdministradorasChange?: (administradoras: Administradora[]) => void;
}

export const AdministradorasCadastro: React.FC<AdministradorasCadastroProps> = ({
  regras = [],
  vendas = [],
  onAdministradorasChange
}) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  const [administradoras, setAdministradoras] = useState<Administradora[]>([]);
  const [loading, setLoading] = useState(false);
  const [dbError, setDbError] = useState<string | null>(null);
  const [buscaTexto, setBuscaTexto] = useState('');

  // Dialog estados
  const [openDialog, setOpenDialog] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [nome, setNome] = useState('');
  const [ativo, setAtivo] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const carregarAdministradoras = async () => {
    setLoading(true);
    setDbError(null);
    try {
      const data = await obterAdministradorasSupabase();
      setAdministradoras(data);
      if (onAdministradorasChange) {
        onAdministradorasChange(data);
      }
    } catch {
      setDbError('Não foi possível carregar as administradoras.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarAdministradoras();
  }, []);

  const resetForm = () => {
    setNome('');
    setAtivo(true);
    setErrors({});
    setEditId(null);
  };

  const handleOpenNova = () => {
    resetForm();
    setOpenDialog(true);
  };

  const handleOpenEditar = (adm: Administradora) => {
    setEditId(adm.id);
    setNome(adm.nome);
    setAtivo(adm.ativo);
    setErrors({});
    setOpenDialog(true);
  };

  const handleClose = () => {
    setOpenDialog(false);
    resetForm();
  };

  const validar = (): boolean => {
    const e: Record<string, string> = {};
    if (!nome.trim() || nome.trim().length < 2) {
      e.nome = 'Nome da administradora deve ter pelo menos 2 caracteres.';
    }
    const jaExiste = administradoras.some(
      a => a.id !== editId && a.nome.trim().toLowerCase() === nome.trim().toLowerCase()
    );
    if (jaExiste) {
      e.nome = 'Já existe uma administradora com este nome cadastrado.';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSalvar = async () => {
    if (!validar()) return;
    setLoading(true);
    try {
      const id = editId || `adm_${nome.trim().toLowerCase().replace(/\s+/g, '_')}_${Date.now()}`;
      const nova: Administradora = {
        id,
        nome: nome.trim(),
        ativo
      };
      await salvarAdministradoraSupabase(nova);
      await carregarAdministradoras();
      handleClose();
    } catch {
      setErrors({ geral: 'Erro ao salvar administradora.' });
    } finally {
      setLoading(false);
    }
  };

  const handleToggleAtivo = async (adm: Administradora) => {
    const atualizada = { ...adm, ativo: !adm.ativo };
    try {
      await salvarAdministradoraSupabase(atualizada);
      setAdministradoras(prev => prev.map(a => a.id === adm.id ? atualizada : a));
      if (onAdministradorasChange) {
        onAdministradorasChange(administradoras.map(a => a.id === adm.id ? atualizada : a));
      }
    } catch (e) {
      console.error('Erro ao alternar status da administradora:', e);
    }
  };

  const handleExcluir = async (id: string) => {
    setLoading(true);
    try {
      await excluirAdministradoraSupabase(id);
      const novas = administradoras.filter(a => a.id !== id);
      setAdministradoras(novas);
      if (onAdministradorasChange) {
        onAdministradorasChange(novas);
      }
    } catch {
      setDbError('Erro ao excluir administradora.');
    } finally {
      setLoading(false);
      setConfirmDeleteId(null);
    }
  };

  const administradorasFiltradas = useMemo(() => {
    if (!buscaTexto.trim()) return administradoras;
    const termo = buscaTexto.toLowerCase().trim();
    return administradoras.filter(a => a.nome.toLowerCase().includes(termo));
  }, [administradoras, buscaTexto]);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <AccountBalanceIcon sx={{ color: theme.palette.primary.main, fontSize: 28 }} />
            <Typography variant="h5" sx={{ fontWeight: 700, fontFamily: 'Outfit, sans-serif' }}>
              Administradoras de Consórcio
            </Typography>
          </Box>
          <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
            Cadastre e gerencie as administradoras parceiras para vincular às tabelas de comissão e lançamentos de vendas.
          </Typography>
        </Box>

        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={handleOpenNova}
          sx={{
            background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
            borderRadius: 2.5,
            fontWeight: 700,
            textTransform: 'none',
            boxShadow: '0 4px 12px rgba(99,102,241,0.25)',
            fontFamily: 'Outfit, sans-serif',
          }}
        >
          Nova Administradora
        </Button>
      </Box>

      {dbError && (
        <Alert severity="error" onClose={() => setDbError(null)} sx={{ borderRadius: 2 }}>
          {dbError}
        </Alert>
      )}

      {/* Barra de Filtros e Busca */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
        <TextField
          size="small"
          placeholder="Buscar administradora..."
          value={buscaTexto}
          onChange={e => setBuscaTexto(e.target.value)}
          sx={{
            minWidth: { xs: '100%', sm: 300 },
            '& .MuiOutlinedInput-root': {
              borderRadius: 2.5,
              bgcolor: isDark ? 'rgba(30, 41, 59, 0.6)' : '#ffffff',
            }
          }}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                </InputAdornment>
              ),
              endAdornment: buscaTexto ? (
                <InputAdornment position="end">
                  <IconButton size="small" onClick={() => setBuscaTexto('')} edge="end">
                    <ClearIcon sx={{ fontSize: 16 }} />
                  </IconButton>
                </InputAdornment>
              ) : null
            }
          }}
        />

        <Chip
          label={`${administradoras.length} administradora(s) cadastrada(s)`}
          variant="outlined"
          sx={{ fontWeight: 600, borderRadius: 2 }}
        />
      </Box>

      {/* Tabela de Administradoras */}
      {loading && administradoras.length === 0 ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress />
        </Box>
      ) : (
        <TableContainer
          component={Paper}
          elevation={0}
          sx={{
            borderRadius: 3,
            border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
            bgcolor: isDark ? '#1e293b' : '#ffffff',
            overflow: 'hidden'
          }}
        >
          <Table sx={{ minWidth: 650 }}>
            <TableHead sx={{ bgcolor: isDark ? '#0f172a' : '#f8fafc' }}>
              <TableRow>
                <TableCell sx={{ fontWeight: 700, fontSize: '0.8rem', color: 'text.secondary', textTransform: 'uppercase' }}>
                  Administradora
                </TableCell>
                <TableCell sx={{ fontWeight: 700, fontSize: '0.8rem', color: 'text.secondary', textTransform: 'uppercase', textAlign: 'center' }}>
                  Tabelas Vinculadas
                </TableCell>
                <TableCell sx={{ fontWeight: 700, fontSize: '0.8rem', color: 'text.secondary', textTransform: 'uppercase', textAlign: 'center' }}>
                  Vendas Vinculadas
                </TableCell>
                <TableCell sx={{ fontWeight: 700, fontSize: '0.8rem', color: 'text.secondary', textTransform: 'uppercase', textAlign: 'center' }}>
                  Status
                </TableCell>
                <TableCell sx={{ fontWeight: 700, fontSize: '0.8rem', color: 'text.secondary', textTransform: 'uppercase', textAlign: 'right' }}>
                  Ações
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {administradorasFiltradas.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} sx={{ textAlign: 'center', py: 4, color: 'text.secondary' }}>
                    {buscaTexto ? `Nenhuma administradora encontrada para "${buscaTexto}".` : 'Nenhuma administradora cadastrada.'}
                  </TableCell>
                </TableRow>
              ) : (
                administradorasFiltradas.map(adm => {
                  const qtdRegras = regras.filter(r => r.administradoraId === adm.id || r.administradoraNome === adm.nome).length;
                  const qtdVendas = vendas.filter(v => v.administradoraId === adm.id || v.administradoraNome === adm.nome).length;

                  return (
                    <TableRow
                      key={adm.id}
                      sx={{
                        '&:hover': { bgcolor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)' },
                        '&:last-child td': { border: 0 }
                      }}
                    >
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                          <Box
                            sx={{
                              width: 36,
                              height: 36,
                              borderRadius: 2,
                              bgcolor: 'rgba(99, 102, 241, 0.12)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: '#818cf8'
                            }}
                          >
                            <AccountBalanceIcon sx={{ fontSize: 20 }} />
                          </Box>
                          <Box>
                            <Typography sx={{ fontWeight: 700, fontSize: '0.9rem' }}>
                              {adm.nome}
                            </Typography>
                            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                              ID: {adm.id}
                            </Typography>
                          </Box>
                        </Box>
                      </TableCell>

                      <TableCell sx={{ textAlign: 'center' }}>
                        <Chip
                          label={`${qtdRegras} tabela(s)`}
                          size="small"
                          sx={{
                            fontWeight: 600,
                            fontSize: '0.75rem',
                            bgcolor: qtdRegras > 0 ? 'rgba(99,102,241,0.12)' : 'transparent',
                            color: qtdRegras > 0 ? '#818cf8' : 'text.secondary',
                            border: `1px solid ${qtdRegras > 0 ? 'rgba(99,102,241,0.3)' : (isDark ? '#334155' : '#cbd5e1')}`
                          }}
                        />
                      </TableCell>

                      <TableCell sx={{ textAlign: 'center' }}>
                        <Chip
                          label={`${qtdVendas} venda(s)`}
                          size="small"
                          sx={{
                            fontWeight: 600,
                            fontSize: '0.75rem',
                            bgcolor: qtdVendas > 0 ? 'rgba(16,185,129,0.12)' : 'transparent',
                            color: qtdVendas > 0 ? '#34d399' : 'text.secondary',
                            border: `1px solid ${qtdVendas > 0 ? 'rgba(16,185,129,0.3)' : (isDark ? '#334155' : '#cbd5e1')}`
                          }}
                        />
                      </TableCell>

                      <TableCell sx={{ textAlign: 'center' }}>
                        <Tooltip title={adm.ativo ? 'Clique para desativar' : 'Clique para ativar'}>
                          <Chip
                            icon={adm.ativo ? <CheckCircleIcon sx={{ fontSize: 14 }} /> : <BlockIcon sx={{ fontSize: 14 }} />}
                            label={adm.ativo ? 'Ativa' : 'Inativa'}
                            size="small"
                            onClick={() => handleToggleAtivo(adm)}
                            sx={{
                              cursor: 'pointer',
                              fontWeight: 700,
                              fontSize: '0.75rem',
                              bgcolor: adm.ativo ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)',
                              color: adm.ativo ? '#34d399' : '#f87171',
                              border: `1px solid ${adm.ativo ? 'rgba(16,185,129,0.25)' : 'rgba(239,68,68,0.25)'}`
                            }}
                          />
                        </Tooltip>
                      </TableCell>

                      <TableCell sx={{ textAlign: 'right' }}>
                        <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 0.5 }}>
                          <Tooltip title="Editar Administradora">
                            <IconButton
                              size="small"
                              onClick={() => handleOpenEditar(adm)}
                              sx={{ color: 'text.secondary', '&:hover': { color: 'primary.main' } }}
                            >
                              <EditIcon sx={{ fontSize: 18 }} />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Excluir Administradora">
                            <IconButton
                              size="small"
                              onClick={() => setConfirmDeleteId(adm.id)}
                              sx={{ color: 'text.secondary', '&:hover': { color: 'error.main' } }}
                            >
                              <DeleteIcon sx={{ fontSize: 18 }} />
                            </IconButton>
                          </Tooltip>
                        </Box>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Dialog para Nova/Editar Administradora */}
      <Dialog
        open={openDialog}
        onClose={handleClose}
        fullWidth
        maxWidth="xs"
        slotProps={{
          paper: {
            sx: {
              borderRadius: 3,
              bgcolor: isDark ? '#1e293b' : '#ffffff',
              p: 1
            }
          }
        }}
      >
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pb: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <AccountBalanceIcon sx={{ color: theme.palette.primary.main }} />
            <Typography variant="h6" sx={{ fontWeight: 700, fontFamily: 'Outfit, sans-serif' }}>
              {editId ? 'Editar Administradora' : 'Nova Administradora'}
            </Typography>
          </Box>
          <IconButton size="small" onClick={handleClose}>
            <CloseIcon sx={{ fontSize: 20 }} />
          </IconButton>
        </DialogTitle>

        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, pt: '12px !important' }}>
          {errors.geral && <Alert severity="error">{errors.geral}</Alert>}

          <TextField
            label="Nome da Administradora *"
            value={nome}
            onChange={e => setNome(e.target.value)}
            error={!!errors.nome}
            helperText={errors.nome}
            placeholder="Ex: Porto Seguro, Embracon, Rodobens..."
            fullWidth
            size="small"
            autoFocus
          />

          <FormControlLabel
            control={
              <Switch
                checked={ativo}
                onChange={e => setAtivo(e.target.checked)}
                color="primary"
              />
            }
            label={
              <Box>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  Administradora Ativa
                </Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  Disponível para seleção em novas regras e vendas
                </Typography>
              </Box>
            }
          />
        </DialogContent>

        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={handleClose} sx={{ textTransform: 'none', fontWeight: 600 }}>
            Cancelar
          </Button>
          <Button
            variant="contained"
            onClick={handleSalvar}
            disabled={loading}
            sx={{
              borderRadius: 2,
              fontWeight: 700,
              textTransform: 'none',
              background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
              px: 3
            }}
          >
            {loading ? <CircularProgress size={18} color="inherit" /> : 'Salvar'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog de Confirmação de Exclusão */}
      <Dialog
        open={!!confirmDeleteId}
        onClose={() => setConfirmDeleteId(null)}
        maxWidth="xs"
        fullWidth
        slotProps={{
          paper: {
            sx: { borderRadius: 3, p: 1 }
          }
        }}
      >
        <DialogTitle sx={{ fontWeight: 700 }}>Confirmar Exclusão</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            Tem certeza que deseja remover esta administradora? As regras e vendas já cadastradas manterão os registros existentes.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setConfirmDeleteId(null)} sx={{ textTransform: 'none', fontWeight: 600 }}>
            Cancelar
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={() => confirmDeleteId && handleExcluir(confirmDeleteId)}
            sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 700 }}
          >
            Excluir
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
