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
  Grid,
  useTheme,
  InputAdornment
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import CloseIcon from '@mui/icons-material/Close';
import PersonIcon from '@mui/icons-material/Person';
import { type Vendedor, type UserPermissions } from '../types';

interface VendedoresCadastroProps {
  vendedores: Vendedor[];
  onAdicionarVendedor: (vendedor: Vendedor) => void;
  onExcluirVendedor: (id: string) => void;
  permissoes: UserPermissions;
}

export const VendedoresCadastro: React.FC<VendedoresCadastroProps> = ({
  vendedores,
  onAdicionarVendedor,
  onExcluirVendedor,
  permissoes
}) => {
  const theme = useTheme();
  const [openDialog, setOpenDialog] = useState(false);
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [percentualComissao, setPercentualComissao] = useState<number | ''>('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleOpenDialog = () => {
    setNome('');
    setEmail('');
    setPercentualComissao('');
    setErrors({});
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
  };

  const handleSalvarVendedor = () => {
    const tempErrors: Record<string, string> = {};
    if (!nome.trim()) tempErrors.nome = 'Nome do vendedor é obrigatório.';
    if (!email.trim()) {
      tempErrors.email = 'E-mail do vendedor é obrigatório.';
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      tempErrors.email = 'Insira um e-mail válido.';
    }
    if (percentualComissao !== '' && (Number(percentualComissao) < 0 || Number(percentualComissao) > 100)) {
      tempErrors.percentualComissao = 'Insira um percentual válido entre 0% e 100%.';
    }

    setErrors(tempErrors);

    if (Object.keys(tempErrors).length > 0) return;

    const novoVendedor: Vendedor = {
      id: `vend_${Date.now()}`,
      nome: nome.trim(),
      email: email.trim(),
      ativo: true,
      percentualComissao: percentualComissao === '' ? 0 : Number(percentualComissao)
    };

    onAdicionarVendedor(novoVendedor);
    handleCloseDialog();
  };

  return (
    <Box>
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          mb: 3
        }}
      >
        <Box>
          <Typography
            variant="h5"
            sx={{ fontWeight: 700, fontFamily: 'Outfit, sans-serif', color: theme.palette.mode === 'dark' ? '#f8fafc' : '#0f172a' }}
          >
            Cadastro de Vendedores
          </Typography>
          <Typography variant="body2" sx={{ color: theme.palette.mode === 'dark' ? '#94a3b8' : '#64748b' }}>
            Gerencie os vendedores da consultoria para associá-los aos lançamentos e simulações.
          </Typography>
        </Box>
        {permissoes?.cadastrarVendedores && (
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={handleOpenDialog}
            sx={{
              borderRadius: 2.5,
              textTransform: 'none',
              fontWeight: 600,
              fontFamily: 'Outfit, sans-serif',
              boxShadow: '0 4px 12px rgba(99, 102, 241, 0.25)',
              background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`
            }}
          >
            Novo Vendedor
          </Button>
        )}
      </Box>

      <TableContainer
        component={Paper}
        elevation={0}
        sx={{
          borderRadius: 4,
          border: `1px solid ${theme.palette.mode === 'dark' ? '#334155' : '#e2e8f0'}`,
          background: theme.palette.mode === 'dark' ? '#1e293b' : '#ffffff'
        }}
      >
        <Table size="small">
          <TableHead sx={{ background: theme.palette.mode === 'dark' ? '#0f172a' : '#f8fafc' }}>
            <TableRow>
              <TableCell sx={{ fontWeight: 700, color: theme.palette.mode === 'dark' ? '#cbd5e1' : '#475569', py: 1.5 }}>
                Nome Completo
              </TableCell>
              <TableCell sx={{ fontWeight: 700, color: theme.palette.mode === 'dark' ? '#cbd5e1' : '#475569', py: 1.5 }}>
                E-mail
              </TableCell>
              <TableCell align="right" sx={{ fontWeight: 700, color: theme.palette.mode === 'dark' ? '#cbd5e1' : '#475569', py: 1.5 }}>
                Comissão Padrão (%)
              </TableCell>
              {permissoes?.cadastrarVendedores && (
                <TableCell align="center" sx={{ fontWeight: 700, color: theme.palette.mode === 'dark' ? '#cbd5e1' : '#475569', py: 1.5, width: 120 }}>
                  Ações
                </TableCell>
              )}
            </TableRow>
          </TableHead>
          <TableBody>
            {vendedores.length === 0 ? (
              <TableRow>
                <TableCell colSpan={permissoes?.cadastrarVendedores ? 4 : 3} align="center" sx={{ py: 6 }}>
                  <PersonIcon sx={{ fontSize: 40, color: '#64748b', mb: 1, opacity: 0.5 }} />
                  <Typography variant="body1" sx={{ color: theme.palette.mode === 'dark' ? '#64748b' : '#94a3b8' }}>
                    Nenhum vendedor cadastrado.
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              vendedores.map((vendedor) => (
                <TableRow
                  key={vendedor.id}
                  sx={{
                    '&:hover': {
                      background: theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.02)' : 'rgba(0, 0, 0, 0.01)'
                    },
                    transition: 'background 0.2s',
                    borderBottom: `1px solid ${theme.palette.mode === 'dark' ? '#334155' : '#e2e8f0'}`
                  }}
                >
                  <TableCell sx={{ fontWeight: 600, color: theme.palette.mode === 'dark' ? '#f1f5f9' : '#1e293b', py: 1.5 }}>
                    {vendedor.nome}
                  </TableCell>
                  <TableCell sx={{ color: theme.palette.mode === 'dark' ? '#cbd5e1' : '#475569', py: 1.5 }}>
                    {vendedor.email}
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 650, color: theme.palette.success.main, py: 1.5 }}>
                    {Number(vendedor.percentualComissao || 0).toFixed(2).replace('.', ',')}%
                  </TableCell>
                  {permissoes?.cadastrarVendedores && (
                    <TableCell align="center" sx={{ py: 1 }}>
                      <IconButton
                        color="error"
                        onClick={() => onExcluirVendedor(vendedor.id)}
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
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Dialog para Novo Vendedor */}
      <Dialog
        open={openDialog}
        onClose={handleCloseDialog}
        maxWidth="sm"
        fullWidth
        slotProps={{
          paper: {
            sx: {
              borderRadius: 3,
              background: theme.palette.mode === 'dark' ? '#1e293b' : '#ffffff',
              backgroundImage: 'none',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3), 0 10px 10px -5px rgba(0, 0, 0, 0.2)'
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
          Novo Vendedor
          <IconButton onClick={handleCloseDialog} size="small">
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={3} sx={{ mt: 0.5 }}>
            <Grid size={{ xs: 12 }}>
              <TextField
                fullWidth
                label="Nome do Vendedor"
                placeholder="Ex: Carlos Silva"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                error={!!errors.nome}
                helperText={errors.nome}
              />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <TextField
                fullWidth
                label="E-mail"
                type="email"
                placeholder="Ex: carlos.silva@consultoria.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                error={!!errors.email}
                helperText={errors.email}
              />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <TextField
                fullWidth
                label="Comissão Padrão (%)"
                type="number"
                placeholder="Ex: 1.5"
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
            onClick={handleCloseDialog}
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
            onClick={handleSalvarVendedor}
            disabled={!nome.trim() || !email.trim()}
            sx={{
              borderRadius: 2,
              textTransform: 'none',
              fontWeight: 600,
              boxShadow: '0 4px 10px rgba(99, 102, 241, 0.2)'
            }}
          >
            Cadastrar
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
