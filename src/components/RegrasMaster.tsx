import React, { useState } from 'react';
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
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  InputAdornment,
  Grid,
  useTheme,
  Chip
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import AddIcon from '@mui/icons-material/Add';
import SaveIcon from '@mui/icons-material/Save';
import CloseIcon from '@mui/icons-material/Close';
import { type RegraMaster, type SegmentoType, type UserPermissions } from '../types';

interface RegrasMasterProps {
  regras: RegraMaster[];
  onAdicionarRegra: (regra: Omit<RegraMaster, 'id'>) => void;
  onEditarRegra: (regra: RegraMaster) => void;
  onExcluirRegra: (id: string) => void;
  permissoes: UserPermissions;
}

export const RegrasMaster: React.FC<RegrasMasterProps> = ({
  regras,
  onAdicionarRegra,
  onEditarRegra,
  onExcluirRegra,
  permissoes
}) => {
  const theme = useTheme();

  // Estados do Dialog de formulário
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [segmento, setSegmento] = useState<SegmentoType>('Imóveis');
  const [tabela, setTabela] = useState('');
  const [qtdParcelas, setQtdParcelas] = useState<number | ''>('');
  const [percentualComissao, setPercentualComissao] = useState<number | ''>('');

  // Erros de validação
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleOpen = (regra?: RegraMaster) => {
    if (regra) {
      setEditId(regra.id);
      setSegmento(regra.segmento);
      setTabela(regra.tabela);
      setQtdParcelas(regra.qtdParcelas);
      setPercentualComissao(regra.percentualComissao);
    } else {
      setEditId(null);
      setSegmento('Imóveis');
      setTabela('');
      setQtdParcelas('');
      setPercentualComissao('');
    }
    setErrors({});
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
  };

  const validarFormulario = () => {
    const tempErrors: Record<string, string> = {};
    if (!tabela.trim()) tempErrors.tabela = 'O nome da tabela é obrigatório.';
    if (!qtdParcelas || Number(qtdParcelas) <= 0) {
      tempErrors.qtdParcelas = 'Insira uma quantidade de parcelas válida (maior que 0).';
    }
    if (percentualComissao === '' || Number(percentualComissao) < 0 || Number(percentualComissao) > 100) {
      tempErrors.percentualComissao = 'Insira uma comissão válida entre 0% e 100%.';
    }
    setErrors(tempErrors);
    return Object.keys(tempErrors).length === 0;
  };

  const handleSalvar = () => {
    if (!validarFormulario()) return;

    const dadosRegra = {
      segmento,
      tabela: tabela.trim(),
      qtdParcelas: Number(qtdParcelas),
      percentualComissao: Number(percentualComissao)
    };

    if (editId) {
      onEditarRegra({ id: editId, ...dadosRegra });
    } else {
      onAdicionarRegra(dadosRegra);
    }
    handleClose();
  };

  const getCorChip = (seg: SegmentoType) => {
    switch (seg) {
      case 'Imóveis':
        return { bg: 'rgba(99, 102, 241, 0.15)', text: '#818cf8' };
      case 'Autos Leves':
        return { bg: 'rgba(16, 185, 129, 0.15)', text: '#34d399' };
      case 'Pesados':
        return { bg: 'rgba(245, 158, 11, 0.15)', text: '#fbbf24' };
      default:
        return { bg: 'rgba(100, 116, 139, 0.15)', text: '#94a3b8' };
    }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography
            variant="h5"
            sx={{ fontWeight: 700, fontFamily: 'Outfit, sans-serif', color: theme.palette.mode === 'dark' ? '#f8fafc' : '#0f172a' }}
          >
            Banco de Dados de Regras (BD Master)
          </Typography>
          <Typography variant="body2" sx={{ color: theme.palette.mode === 'dark' ? '#94a3b8' : '#64748b' }}>
            Gerencie as tabelas de comissionamento por segmento e número de parcelas
          </Typography>
        </Box>
        {permissoes?.cadastrarRegras && (
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => handleOpen()}
            sx={{
              borderRadius: 2.5,
              textTransform: 'none',
              fontWeight: 600,
              fontFamily: 'Outfit, sans-serif',
              boxShadow: '0 4px 12px rgba(99, 102, 241, 0.25)',
              background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`
            }}
          >
            Nova Regra
          </Button>
        )}
      </Box>

      <TableContainer
        component={Paper}
        elevation={0}
        sx={{
          borderRadius: 4,
          border: `1px solid ${theme.palette.mode === 'dark' ? '#334155' : '#e2e8f0'}`,
          background: theme.palette.mode === 'dark' ? '#1e293b' : '#ffffff',
          overflow: 'hidden'
        }}
      >
        <Table sx={{ minWidth: 650 }}>
          <TableHead sx={{ background: theme.palette.mode === 'dark' ? '#0f172a' : '#f8fafc' }}>
            <TableRow>
              <TableCell sx={{ fontWeight: 650, color: theme.palette.mode === 'dark' ? '#cbd5e1' : '#475569' }}>Segmento</TableCell>
              <TableCell sx={{ fontWeight: 650, color: theme.palette.mode === 'dark' ? '#cbd5e1' : '#475569' }}>Tabela</TableCell>
              <TableCell sx={{ fontWeight: 650, color: theme.palette.mode === 'dark' ? '#cbd5e1' : '#475569' }} align="right">Qtd. Parcelas</TableCell>
              <TableCell sx={{ fontWeight: 650, color: theme.palette.mode === 'dark' ? '#cbd5e1' : '#475569' }} align="right">% Comissão</TableCell>
              {permissoes?.cadastrarRegras && (
                <TableCell sx={{ fontWeight: 650, color: theme.palette.mode === 'dark' ? '#cbd5e1' : '#475569' }} align="center">Ações</TableCell>
              )}
            </TableRow>
          </TableHead>
          <TableBody>
            {regras.length === 0 ? (
              <TableRow>
                <TableCell colSpan={permissoes.cadastrarRegras ? 5 : 4} align="center" sx={{ py: 6 }}>
                  <Typography variant="body1" sx={{ color: theme.palette.mode === 'dark' ? '#64748b' : '#94a3b8' }}>
                    Nenhuma regra cadastrada.
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              regras.map((regra) => {
                const chipEstilo = getCorChip(regra.segmento);
                return (
                  <TableRow
                    key={regra.id}
                    sx={{
                      '&:hover': {
                        background: theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.02)' : 'rgba(0, 0, 0, 0.01)'
                      },
                      transition: 'background 0.2s',
                      borderColor: theme.palette.mode === 'dark' ? '#334155' : '#e2e8f0'
                    }}
                  >
                    <TableCell>
                      <Chip
                        label={regra.segmento}
                        size="small"
                        sx={{
                          bgcolor: chipEstilo.bg,
                          color: chipEstilo.text,
                          fontWeight: 700,
                          fontSize: '0.75rem',
                          borderRadius: 1.5
                        }}
                      />
                    </TableCell>
                    <TableCell sx={{ fontWeight: 500, color: theme.palette.mode === 'dark' ? '#f1f5f9' : '#1e293b' }}>
                      {regra.tabela}
                    </TableCell>
                    <TableCell align="right" sx={{ color: theme.palette.mode === 'dark' ? '#cbd5e1' : '#334155' }}>
                      {regra.qtdParcelas}x
                    </TableCell>
                    <TableCell
                      align="right"
                      sx={{
                        fontWeight: 600,
                        color: theme.palette.success.main
                      }}
                    >
                      {Number(regra.percentualComissao || 0).toFixed(2).replace('.', ',')}%
                    </TableCell>
                    {permissoes?.cadastrarRegras && (
                      <TableCell align="center">
                        <IconButton
                          color="primary"
                          onClick={() => handleOpen(regra)}
                          size="small"
                          sx={{
                            mr: 1,
                            bgcolor: theme.palette.mode === 'dark' ? 'rgba(99, 102, 241, 0.1)' : 'rgba(99, 102, 241, 0.05)',
                            '&:hover': { bgcolor: 'rgba(99, 102, 241, 0.2)' }
                          }}
                        >
                          <EditIcon fontSize="small" />
                        </IconButton>
                        <IconButton
                          color="error"
                          onClick={() => onExcluirRegra(regra.id)}
                          size="small"
                          sx={{
                            bgcolor: theme.palette.mode === 'dark' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(239, 68, 68, 0.05)',
                            '&:hover': { bgcolor: 'rgba(239, 68, 68, 0.2)' }
                          }}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Dialog para Formulário de Regra (Novo/Editar) */}
      <Dialog
        open={open}
        onClose={handleClose}
        fullWidth
        maxWidth="xs"
        slotProps={{
          paper: {
            sx: {
              borderRadius: 4,
              bgcolor: theme.palette.mode === 'dark' ? '#1e293b' : '#ffffff',
              border: `1px solid ${theme.palette.mode === 'dark' ? '#334155' : '#e2e8f0'}`,
              p: 1
            }
          }
        }}
      >
        <DialogTitle
          sx={{
            fontFamily: 'Outfit, sans-serif',
            fontWeight: 700,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            color: theme.palette.mode === 'dark' ? '#f8fafc' : '#0f172a'
          }}
        >
          {editId ? 'Editar Regra Master' : 'Nova Regra Master'}
          <IconButton onClick={handleClose} size="small">
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2.5} sx={{ mt: 0.5 }}>
            <Grid size={{ xs: 12 }}>
              <FormControl fullWidth>
                <InputLabel id="segmento-label">Segmento</InputLabel>
                <Select
                  labelId="segmento-label"
                  value={segmento}
                  label="Segmento"
                  onChange={(e) => setSegmento(e.target.value as SegmentoType)}
                >
                  <MenuItem value="Imóveis">Imóveis</MenuItem>
                  <MenuItem value="Autos Leves">Autos Leves</MenuItem>
                  <MenuItem value="Pesados">Pesados</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 12 }}>
              <TextField
                fullWidth
                label="Nome da Tabela"
                placeholder="Ex: Tabela Platinum"
                value={tabela}
                onChange={(e) => setTabela(e.target.value)}
                error={!!errors.tabela}
                helperText={errors.tabela}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                label="Qtd. Parcelas"
                type="number"
                placeholder="Ex: 120"
                value={qtdParcelas}
                onChange={(e) => {
                  const val = e.target.value === '' ? '' : Math.max(1, parseInt(e.target.value));
                  setQtdParcelas(val);
                }}
                error={!!errors.qtdParcelas}
                helperText={errors.qtdParcelas}
                slotProps={{
                  input: {
                    endAdornment: <InputAdornment position="end">x</InputAdornment>
                  }
                }}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                label="Comissão (%)"
                type="number"
                placeholder="Ex: 5.5"
                value={percentualComissao}
                onChange={(e) => {
                  const val = e.target.value === '' ? '' : Math.max(0, parseFloat(e.target.value));
                  setPercentualComissao(val);
                }}
                error={!!errors.percentualComissao}
                helperText={errors.percentualComissao}
                slotProps={{
                  input: {
                    endAdornment: <InputAdornment position="end">%</InputAdornment>
                  },
                  htmlInput: {
                    step: '0.1',
                    min: '0',
                    max: '100'
                  }
                }}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, pt: 1 }}>
          <Button
            onClick={handleClose}
            sx={{
              borderRadius: 2,
              textTransform: 'none',
              fontWeight: 600,
              color: theme.palette.mode === 'dark' ? '#94a3b8' : '#64748b'
            }}
          >
            Cancelar
          </Button>
          <Button
            variant="contained"
            onClick={handleSalvar}
            startIcon={<SaveIcon />}
            sx={{
              borderRadius: 2,
              textTransform: 'none',
              fontWeight: 600,
              boxShadow: '0 4px 10px rgba(99, 102, 241, 0.2)'
            }}
          >
            Salvar Regra
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
