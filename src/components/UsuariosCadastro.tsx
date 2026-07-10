import React, { useState, useEffect } from 'react';
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
  Checkbox,
  FormControlLabel,
  Grid,
  Chip,
  useTheme,
  Alert
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import CloseIcon from '@mui/icons-material/Close';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import SecurityIcon from '@mui/icons-material/Security';
import { type Usuario, type UserRole, type UserPermissions } from '../types';
import { obterUsuariosSupabase, salvarUsuarioSupabase, excluirUsuarioSupabase } from '../utils/supabase';

export const UsuariosCadastro: React.FC = () => {
  const theme = useTheme();
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [openDialog, setOpenDialog] = useState(false);
  const [loading, setLoading] = useState(false);
  
  // Estados do formulário
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [role, setRole] = useState<UserRole>('visualizador');
  const [permissoes, setPermissoes] = useState<UserPermissions>({
    visualizar: true,
    editarVendas: false,
    cadastrarVendedores: false,
    cadastrarRegras: false
  });
  
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [dbError, setDbError] = useState<string | null>(null);

  // Carrega os usuários na inicialização
  const carregarUsuarios = async () => {
    setLoading(true);
    setDbError(null);
    try {
      const data = await obterUsuariosSupabase();
      setUsuarios(data);
    } catch (err) {
      console.error('Erro ao obter usuários:', err);
      setDbError('Não foi possível carregar os usuários do Supabase. Certifique-se de ter criado a tabela "usuarios".');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarUsuarios();
  }, []);

  const handleOpenDialog = () => {
    setNome('');
    setEmail('');
    setSenha('');
    setRole('visualizador');
    setPermissoes({
      visualizar: true,
      editarVendas: false,
      cadastrarVendedores: false,
      cadastrarRegras: false
    });
    setErrors({});
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
  };

  // Ajusta automaticamente as permissões padrão ao alterar a role no formulário
  const handleRoleChange = (selectedRole: UserRole) => {
    setRole(selectedRole);
    if (selectedRole === 'master') {
      setPermissoes({
        visualizar: true,
        editarVendas: true,
        cadastrarVendedores: true,
        cadastrarRegras: true
      });
    } else if (selectedRole === 'editor') {
      setPermissoes({
        visualizar: true,
        editarVendas: true,
        cadastrarVendedores: true,
        cadastrarRegras: false
      });
    } else {
      setPermissoes({
        visualizar: true,
        editarVendas: false,
        cadastrarVendedores: false,
        cadastrarRegras: false
      });
    }
  };

  const handleCheckboxChange = (campo: keyof UserPermissions, checked: boolean) => {
    setPermissoes((prev) => ({
      ...prev,
      [campo]: checked
    }));
  };

  const handleSalvar = async () => {
    const tempErrors: Record<string, string> = {};
    if (!nome.trim()) tempErrors.nome = 'Nome completo é obrigatório.';
    if (!email.trim() || !email.includes('@')) tempErrors.email = 'E-mail corporativo válido é obrigatório.';
    if (!senha.trim() || senha.length < 6) tempErrors.senha = 'Senha com no mínimo 6 caracteres é obrigatória.';

    setErrors(tempErrors);
    if (Object.keys(tempErrors).length > 0) return;

    const novoUsuario: Usuario = {
      id: `u_${Date.now()}`,
      nome: nome.trim(),
      email: email.trim().toLowerCase(),
      senha: senha.trim(),
      role,
      permissoes
    };

    setLoading(true);
    try {
      await salvarUsuarioSupabase(novoUsuario);
      await carregarUsuarios();
      setOpenDialog(false);
    } catch (err) {
      console.error('Erro ao cadastrar usuário:', err);
      setDbError('Erro ao gravar usuário no Supabase. Verifique a tabela e as políticas de RLS.');
    } finally {
      setLoading(false);
    }
  };

  const handleExcluir = async (id: string) => {
    if (id === 'u_master') {
      alert('Não é possível excluir o Administrador Master padrão.');
      return;
    }
    
    if (!window.confirm('Tem certeza que deseja remover este usuário do sistema?')) return;

    setLoading(true);
    try {
      await excluirUsuarioSupabase(id);
      await carregarUsuarios();
    } catch (err) {
      console.error('Erro ao excluir usuário:', err);
      setDbError('Erro ao excluir usuário do Supabase.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ p: 1 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3.5 }}>
        <Box>
          <Typography variant="h5" sx={{ fontFamily: 'Outfit, sans-serif', fontWeight: 700 }}>
            Configuração de Acessos e Usuários
          </Typography>
          <Typography variant="caption" sx={{ color: '#94a3b8' }}>
            Cadastre novos colaboradores e gerencie papéis e permissões no sistema
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={handleOpenDialog}
          sx={{
            borderRadius: 2,
            background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
            boxShadow: '0 4px 10px rgba(99, 102, 241, 0.2)',
            textTransform: 'none',
            fontWeight: 600
          }}
        >
          Novo Usuário
        </Button>
      </Box>

      {dbError && (
        <Alert severity="error" sx={{ mb: 3, borderRadius: 3 }}>
          {dbError}
        </Alert>
      )}

      <TableContainer
        component={Paper}
        sx={{
          borderRadius: 4,
          border: `1px solid ${theme.palette.mode === 'dark' ? '#1f2937' : '#e5e7eb'}`,
          background: theme.palette.mode === 'dark' ? '#111827' : '#ffffff',
          overflow: 'hidden'
        }}
      >
        <Table>
          <TableHead sx={{ bgcolor: theme.palette.mode === 'dark' ? '#1f2937' : '#f9fafb' }}>
            <TableRow>
              <TableCell sx={{ fontWeight: 700 }}>Nome Completo</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>E-mail corporativo</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Perfil / Função</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Permissões Ativas</TableCell>
              <TableCell align="center" sx={{ fontWeight: 700 }}>Ações</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {usuarios.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} align="center" sx={{ py: 6, color: '#64748b' }}>
                  Nenhum usuário secundário cadastrado no Supabase.
                </TableCell>
              </TableRow>
            ) : (
              usuarios.map((user) => (
                <TableRow key={user.id} sx={{ '&:hover': { bgcolor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.01)' : 'rgba(0,0,0,0.01)' } }}>
                  <TableCell sx={{ fontWeight: 600 }}>{user.nome}</TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>
                    <Chip
                      icon={<SecurityIcon style={{ fontSize: 13 }} />}
                      label={user.role.toUpperCase()}
                      size="small"
                      color={user.role === 'master' ? 'secondary' : user.role === 'editor' ? 'primary' : 'default'}
                      sx={{ fontWeight: 700, borderRadius: 1.5, fontSize: '0.68rem' }}
                    />
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                      {user.permissoes.editarVendas && <Chip label="Vendas" size="small" variant="outlined" sx={{ fontSize: '0.62rem', height: 20 }} />}
                      {user.permissoes.cadastrarVendedores && <Chip label="Vendedores" size="small" variant="outlined" sx={{ fontSize: '0.62rem', height: 20 }} />}
                      {user.permissoes.cadastrarRegras && <Chip label="Regras" size="small" variant="outlined" sx={{ fontSize: '0.62rem', height: 20 }} />}
                      {!user.permissoes.editarVendas && !user.permissoes.cadastrarVendedores && !user.permissoes.cadastrarRegras && (
                        <Chip label="Apenas Visualizar" size="small" variant="outlined" sx={{ fontSize: '0.62rem', height: 20, color: '#94a3b8' }} />
                      )}
                    </Box>
                  </TableCell>
                  <TableCell align="center">
                    <IconButton
                      size="small"
                      color="error"
                      onClick={() => handleExcluir(user.id)}
                      disabled={user.id === 'u_master'}
                      sx={{ '&:hover': { bgcolor: 'rgba(239, 68, 68, 0.15)' } }}
                    >
                      <DeleteIcon sx={{ fontSize: 18 }} />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Dialog para Cadastrar Novo Usuário */}
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
              backgroundImage: 'none'
            }
          }
        }}
      >
        <DialogTitle sx={{ fontFamily: 'Outfit, sans-serif', fontWeight: 700, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          Adicionar Novo Usuário
          <IconButton onClick={handleCloseDialog} size="small">
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers sx={{ borderColor: theme.palette.mode === 'dark' ? '#334155' : '#e2e8f0' }}>
          <Grid container spacing={2.5} sx={{ mt: 0.5 }}>
            <Grid size={{ xs: 12 }}>
              <TextField
                fullWidth
                label="Nome Completo"
                placeholder="Ex: Carlos Oliveira"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                error={!!errors.nome}
                helperText={errors.nome}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                label="E-mail corporativo"
                placeholder="Ex: carlos@apex.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                error={!!errors.email}
                helperText={errors.email}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                label="Senha Inicial"
                type="password"
                placeholder="Mínimo 6 caracteres"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                error={!!errors.senha}
                helperText={errors.senha}
              />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <FormControl fullWidth>
                <InputLabel id="role-select-label">Perfil / Função</InputLabel>
                <Select
                  labelId="role-select-label"
                  value={role}
                  label="Perfil / Função"
                  onChange={(e) => handleRoleChange(e.target.value as UserRole)}
                >
                  <MenuItem value="visualizador">Visualizador (Apenas consulta)</MenuItem>
                  <MenuItem value="editor">Editor (Lançar vendas e vendedores)</MenuItem>
                  <MenuItem value="master">Master (Controle administrativo completo)</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            
            {/* Bloco de permissões finas */}
            <Grid size={{ xs: 12 }}>
              <Typography variant="body2" sx={{ fontWeight: 700, mb: 1, color: '#94a3b8' }}>
                Configuração Fina de Permissões:
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, pl: 1 }}>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={permissoes.visualizar}
                      disabled
                    />
                  }
                  label="Permitir visualizar Dashboard e Timeline (Padrão)"
                />
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={permissoes.editarVendas}
                      onChange={(e) => handleCheckboxChange('editarVendas', e.target.checked)}
                      disabled={role === 'master'}
                    />
                  }
                  label="Permitir Adicionar, Editar e Cancelar lançamentos de Vendas"
                />
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={permissoes.cadastrarVendedores}
                      onChange={(e) => handleCheckboxChange('cadastrarVendedores', e.target.checked)}
                      disabled={role === 'master'}
                    />
                  }
                  label="Permitir Cadastrar e Remover Vendedores"
                />
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={permissoes.cadastrarRegras}
                      onChange={(e) => handleCheckboxChange('cadastrarRegras', e.target.checked)}
                      disabled={role === 'master' || role === 'editor'}
                    />
                  }
                  label="Permitir Alterar o Banco de Regras (BD Master)"
                />
              </Box>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={handleCloseDialog} sx={{ textTransform: 'none', fontWeight: 600 }}>
            Cancelar
          </Button>
          <Button
            variant="contained"
            onClick={handleSalvar}
            disabled={loading}
            startIcon={<PersonAddIcon />}
            sx={{
              borderRadius: 2,
              background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
              textTransform: 'none',
              fontWeight: 600,
              px: 2.5
            }}
          >
            {loading ? 'Salvando...' : 'Adicionar'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
