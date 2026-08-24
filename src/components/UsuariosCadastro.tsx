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
import EditIcon from '@mui/icons-material/Edit';
import CloseIcon from '@mui/icons-material/Close';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import {
  Switch,
  InputAdornment
} from '@mui/material';
import { type Usuario, type UserRole, type UserPermissions, type Empresa, type Vendedor } from '../types';
import { obterUsuariosSupabase, salvarUsuarioSupabase, excluirUsuarioSupabase, obterEmpresasSupabase, salvarVendedorSupabase } from '../utils/supabase';

interface UsuariosCadastroProps {
  usuarioLogado?: Usuario | null;
  vendedores?: Vendedor[];
  onSalvarVendedor?: (vendedor: Vendedor) => void;
}

export const UsuariosCadastro: React.FC<UsuariosCadastroProps> = ({ usuarioLogado, vendedores = [], onSalvarVendedor }) => {
  const theme = useTheme();
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [openDialog, setOpenDialog] = useState(false);
  const [loading, setLoading] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  
  // Estados do formulário
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [role, setRole] = useState<UserRole>('visualizador');
  const [permissoes, setPermissoes] = useState<UserPermissions>({
    visualizar: true,
    editarVendas: false,
    cadastrarVendedores: false,
    cadastrarRegras: false,
    visualizarDashboardVendedores: false,
    editarParcelas: false
  });
  
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [dbError, setDbError] = useState<string | null>(null);
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [empresaId, setEmpresaId] = useState<string>('');
  const [vendedorIdForm, setVendedorIdForm] = useState<string>('');
  const [cadastrarVendedor, setCadastrarVendedor] = useState<boolean>(true);
  const [percentualComissao, setPercentualComissao] = useState<number | ''>('');

  const isSuperMaster = usuarioLogado?.role === 'super_master' || usuarioLogado?.email.toLowerCase() === 'master@apex.com';

  const usuariosExibidos = useMemo(() => {
    if (isSuperMaster) return usuarios;
    const empId = usuarioLogado?.empresaId || 'emp_vertex';
    return usuarios.filter(u => (u.empresaId || 'emp_vertex') === empId);
  }, [usuarios, isSuperMaster, usuarioLogado]);

  // Carrega os usuários na inicialização
  const carregarUsuarios = async () => {
    setLoading(true);
    setDbError(null);
    try {
      const [data, emps] = await Promise.all([obterUsuariosSupabase(), obterEmpresasSupabase()]);
      setUsuarios(data);
      setEmpresas(emps);
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

  const handleOpenDialog = (user?: Usuario) => {
    if (user) {
      setEditId(user.id);
      setNome(user.nome);
      setEmail(user.email);
      setSenha(''); // Mantém em branco a menos que queira redefinir a senha
      setRole(user.role);
      setEmpresaId(user.empresaId || '');
      setVendedorIdForm(user.vendedorId || '');
      const vend = vendedores.find(v => (user.vendedorId && v.id === user.vendedorId) || v.email.toLowerCase() === user.email.toLowerCase());
      setCadastrarVendedor(!!vend || user.role === 'vendedor' || user.role === 'editor');
      setPercentualComissao(vend?.percentualComissao ?? '');
      setPermissoes(user.permissoes || {
        visualizar: true,
        editarVendas: false,
        cadastrarVendedores: false,
        cadastrarRegras: false,
        visualizarDashboardVendedores: false
      });
    } else {
      setEditId(null);
      setNome('');
      setEmail('');
      setSenha('');
      setRole('visualizador');
      setEmpresaId(isSuperMaster ? '' : (usuarioLogado?.empresaId || 'emp_vertex'));
      setVendedorIdForm('');
      setCadastrarVendedor(true);
      setPercentualComissao('');
      setPermissoes({
        visualizar: true,
        editarVendas: false,
        cadastrarVendedores: false,
        cadastrarRegras: false,
        receberParcelas: false,
        visualizarDashboardVendedores: false,
        editarParcelas: false
      });
    }
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
        cadastrarRegras: true,
        receberParcelas: true,
        visualizarDashboardVendedores: true,
        editarParcelas: true
      });
    } else if (selectedRole === 'editor') {
      setPermissoes({
        visualizar: true,
        editarVendas: true,
        cadastrarVendedores: true,
        cadastrarRegras: false,
        receberParcelas: false,
        visualizarDashboardVendedores: true,
        editarParcelas: true
      });
    } else if (selectedRole === 'financeiro') {
      setPermissoes({
        visualizar: true,
        editarVendas: false,
        cadastrarVendedores: false,
        cadastrarRegras: false,
        receberParcelas: true,
        visualizarDashboardVendedores: false,
        editarParcelas: false
      });
    } else if (selectedRole === 'vendedor') {
      setPermissoes({
        visualizar: true,
        editarVendas: false,
        cadastrarVendedores: false,
        cadastrarRegras: false,
        receberParcelas: false,
        visualizarDashboardVendedores: false,
        editarParcelas: false
      });
      // Vínculo com vendedor é obrigatório para este perfil
      setCadastrarVendedor(true);
    } else {
      setPermissoes({
        visualizar: true,
        editarVendas: false,
        cadastrarVendedores: false,
        cadastrarRegras: false,
        receberParcelas: false,
        visualizarDashboardVendedores: false,
        editarParcelas: false
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
    
    // Se for inserção ou se preencheu senha na edição, valida comprimento
    if (!editId) {
      if (!senha.trim() || senha.length < 6) {
        tempErrors.senha = 'Senha com no mínimo 6 caracteres é obrigatória.';
      }
    } else {
      if (senha.trim() !== '' && senha.length < 6) {
        tempErrors.senha = 'A nova senha deve ter no mínimo 6 caracteres.';
      }
    }

    // Perfil Vendedor obrigatoriamente deve ter vínculo com um vendedor
    if (role === 'vendedor' && !cadastrarVendedor) {
      tempErrors.vendedor = 'O perfil Vendedor deve estar habilitado como vendedor da consultoria.';
    }

    setErrors(tempErrors);
    if (Object.keys(tempErrors).length > 0) return;

    // Se for edição e a senha estiver em branco, mantém a senha atual do objeto carregado
    const senhaFinal = senha.trim() || (editId ? usuarios.find(u => u.id === editId)?.senha || '' : '');
    const empresaIdFinal = isSuperMaster ? (empresaId || undefined) : (usuarioLogado?.empresaId || 'emp_vertex');

    let vendedorIdFinal = vendedorIdForm;

    if (cadastrarVendedor || role === 'vendedor') {
      const vendExistente = vendedores.find(v => (vendedorIdForm && v.id === vendedorIdForm) || v.email.toLowerCase() === email.trim().toLowerCase());
      const vendId = vendExistente?.id || `vend_${Date.now()}`;
      vendedorIdFinal = vendId;

      const vendedorSalvar: Vendedor = {
        id: vendId,
        nome: nome.trim(),
        email: email.trim().toLowerCase(),
        ativo: true,
        percentualComissao: percentualComissao === '' ? 0 : Number(percentualComissao),
        empresaId: empresaIdFinal
      };

      try {
        await salvarVendedorSupabase(vendedorSalvar);
        if (onSalvarVendedor) {
          onSalvarVendedor(vendedorSalvar);
        }
      } catch (e) {
        console.warn('Aviso ao salvar vendedor unificado:', e);
      }
    }

    const usuarioSalvar: Usuario = {
      id: editId || `u_${Date.now()}`,
      nome: nome.trim(),
      email: email.trim().toLowerCase(),
      senha: senhaFinal,
      role,
      permissoes,
      empresaId: empresaIdFinal,
      vendedorId: (cadastrarVendedor || role === 'vendedor') ? vendedorIdFinal : undefined
    };

    setLoading(true);
    try {
      await salvarUsuarioSupabase(usuarioSalvar);
      await carregarUsuarios();
      setOpenDialog(false);
    } catch (err) {
      console.error('Erro ao salvar usuário:', err);
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

  const usuariosAgrupados = useMemo(() => {
    return usuariosExibidos.reduce((acc, user) => {
      const empNome = empresas.find(e => e.id === user.empresaId)?.nome || (user.empresaId ? user.empresaId : 'Global');
      const roleName = user.role === 'super_master' ? 'Super Master' :
                       user.role === 'master' ? 'Master' :
                       user.role === 'editor' ? 'ADM' :
                       user.role === 'financeiro' ? 'Financeiro' :
                       user.role === 'vendedor' ? 'Vendedor' : 'Visualizador';
                       
      if (!acc[empNome]) acc[empNome] = {};
      if (!acc[empNome][roleName]) acc[empNome][roleName] = [];
      acc[empNome][roleName].push(user);
      return acc;
    }, {} as Record<string, Record<string, typeof usuariosExibidos[0][]>>);
  }, [usuariosExibidos, empresas]);

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
          onClick={() => handleOpenDialog()}
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
              <TableCell sx={{ fontWeight: 700, color: theme.palette.mode === 'dark' ? '#cbd5e1' : '#475569', py: 1.5 }}>
                Nome Completo
              </TableCell>
              <TableCell sx={{ fontWeight: 700, color: theme.palette.mode === 'dark' ? '#cbd5e1' : '#475569', py: 1.5 }}>
                E-mail
              </TableCell>
              <TableCell sx={{ fontWeight: 700, color: theme.palette.mode === 'dark' ? '#cbd5e1' : '#475569', py: 1.5 }}>
                Empresa
              </TableCell>
              <TableCell sx={{ fontWeight: 700, color: theme.palette.mode === 'dark' ? '#cbd5e1' : '#475569', py: 1.5 }}>
                Perfil / Função
              </TableCell>
              <TableCell align="right" sx={{ fontWeight: 700, color: theme.palette.mode === 'dark' ? '#cbd5e1' : '#475569', py: 1.5 }}>
                Comissão Vendedor (%)
              </TableCell>
              <TableCell align="center" sx={{ fontWeight: 700, color: theme.palette.mode === 'dark' ? '#cbd5e1' : '#475569', py: 1.5, width: 120 }}>
                Ações
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {usuariosExibidos.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} align="center" sx={{ py: 6, color: '#64748b' }}>
                  Nenhum usuário cadastrado.
                </TableCell>
              </TableRow>
            ) : (
              Object.keys(usuariosAgrupados).sort().map(empresa => (
                <React.Fragment key={empresa}>
                  <TableRow sx={{ bgcolor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)' }}>
                    <TableCell colSpan={6} sx={{ fontWeight: 700, py: 1.5, fontSize: '0.95rem' }}>
                      🏢 {empresa}
                    </TableCell>
                  </TableRow>
                  {Object.keys(usuariosAgrupados[empresa]).sort().map(role => (
                    <React.Fragment key={`${empresa}-${role}`}>
                      <TableRow sx={{ bgcolor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)' }}>
                        <TableCell colSpan={6} sx={{ fontWeight: 600, py: 1, pl: 4, color: 'text.secondary', fontSize: '0.85rem' }}>
                          🏷️ Perfil: {role}
                        </TableCell>
                      </TableRow>
                      {usuariosAgrupados[empresa][role].sort((a,b) => a.nome.localeCompare(b.nome)).map(user => {
                        const vend = vendedores.find(v => (user.vendedorId && v.id === user.vendedorId) || v.email.toLowerCase() === user.email.toLowerCase());
                        return (
                          <TableRow key={user.id} sx={{ '&:hover': { bgcolor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)' } }}>
                            <TableCell sx={{ fontWeight: 600, pl: 6 }}>{user.nome}</TableCell>
                            <TableCell>{user.email}</TableCell>
                            <TableCell>
                              <Chip
                                label={empresa}
                                size="small"
                                variant="outlined"
                                sx={{ fontSize: '0.7rem', borderRadius: 1.5 }}
                              />
                            </TableCell>
                            <TableCell>
                              <Chip
                                label={role}
                                color={
                                  user.role === 'super_master' ? 'error' :
                                  user.role === 'master' ? 'primary' :
                                  user.role === 'editor' ? 'info' :
                                  user.role === 'vendedor' ? 'warning' :
                                  user.role === 'financeiro' ? 'success' : 'default'
                                }
                                size="small"
                                sx={{ fontWeight: 600, fontSize: '0.75rem' }}
                              />
                            </TableCell>
                            <TableCell align="right" sx={{ fontWeight: 650, color: theme.palette.success.main }}>
                              {vend ? `${Number(vend.percentualComissao || 0).toFixed(2).replace('.', ',')}%` : '-'}
                            </TableCell>
                            <TableCell align="center">
                              <IconButton
                                size="small"
                                color="primary"
                                onClick={() => handleOpenDialog(user)}
                                sx={{ mr: 1, '&:hover': { bgcolor: 'rgba(99, 102, 241, 0.15)' } }}
                              >
                                <EditIcon sx={{ fontSize: 18 }} />
                              </IconButton>
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
                        );
                      })}
                    </React.Fragment>
                  ))}
                </React.Fragment>
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
          {editId ? 'Editar Usuário / Acessos' : 'Adicionar Novo Usuário'}
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
                label={editId ? "Nova Senha (opcional)" : "Senha Inicial"}
                type="password"
                placeholder={editId ? "Deixe em branco para manter" : "Mínimo 6 caracteres"}
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                error={!!errors.senha}
                helperText={errors.senha}
              />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <FormControl fullWidth>
                <InputLabel id="empresa-select-label">Empresa</InputLabel>
                <Select
                  labelId="empresa-select-label"
                  value={empresaId}
                  label="Empresa"
                  disabled={!isSuperMaster}
                  onChange={(e) => setEmpresaId(e.target.value)}
                >
                  {isSuperMaster && <MenuItem value=""><em>Nenhuma (acesso global — somente Super Master)</em></MenuItem>}
                  {empresas.map(emp => (
                    <MenuItem key={emp.id} value={emp.id}>{emp.nome}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              {!isSuperMaster && (
                <Typography variant="caption" sx={{ color: 'text.secondary', mt: 0.5, display: 'block', pl: 1 }}>
                  🔒 Como Administrador Master da empresa, os usuários cadastrados por você ficarão vinculados à sua própria empresa.
                </Typography>
              )}
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
                  <MenuItem value="editor">ADM (Cadastrar, editar e cancelar vendas)</MenuItem>
                  <MenuItem value="financeiro">Financeiro (Apenas receber parcelas)</MenuItem>
                  <MenuItem value="vendedor">Vendedor (Acesso restrito às próprias vendas)</MenuItem>
                  <MenuItem value="master">Master (Controle administrativo completo)</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            {/* Card informativo para perfil Vendedor */}
            {role === 'vendedor' && (
              <Grid size={{ xs: 12 }}>
                <Box sx={{
                  p: 1.5,
                  borderRadius: 2,
                  bgcolor: 'rgba(245, 158, 11, 0.08)',
                  border: '1px solid rgba(245, 158, 11, 0.25)',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 1
                }}>
                  <Typography sx={{ fontSize: '1rem' }}>👤</Typography>
                  <Box>
                    <Typography variant="body2" sx={{ fontWeight: 700, color: '#f59e0b', mb: 0.3 }}>
                      Perfil Vendedor — Acesso Restrito
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'text.secondary', lineHeight: 1.5 }}>
                      Este usuário terá acesso <strong>apenas ao Painel de Vendas</strong>, visualizando somente as vendas atribuídas a ele. Não terá acesso a dashboards gerais, relatórios, comissões ou configurações.
                    </Typography>
                  </Box>
                </Box>
              </Grid>
            )}

            {role === 'vendedor' && vendedores.length > 0 && (
              <Grid size={{ xs: 12 }}>
                <FormControl fullWidth>
                  <InputLabel id="vendedor-select-label">Vincular a Vendedor Existente (opcional)</InputLabel>
                  <Select
                    labelId="vendedor-select-label"
                    value={vendedorIdForm}
                    label="Vincular a Vendedor Existente (opcional)"
                    onChange={(e) => setVendedorIdForm(e.target.value)}
                  >
                    <MenuItem value=""><em>Criar novo cadastro automático de Vendedor</em></MenuItem>
                    {vendedores.map(v => (
                      <MenuItem key={v.id} value={v.id}>{v.nome} ({v.email})</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
            )}

            <Grid size={{ xs: 12 }}>
              <FormControlLabel
                control={
                  <Switch
                    checked={cadastrarVendedor}
                    onChange={(e) => {
                      // Não permite desligar vínculo quando role === 'vendedor'
                      if (role === 'vendedor') return;
                      setCadastrarVendedor(e.target.checked);
                    }}
                    color="secondary"
                    disabled={role === 'vendedor'}
                  />
                }
                label={
                  role === 'vendedor'
                    ? 'Habilitar como Vendedor da consultoria (Obrigatório para este perfil)'
                    : 'Habilitar como Vendedor da consultoria (Cadastrar na lista de Vendedores e Comissões)'
                }
              />
              {errors.vendedor && (
                <Typography variant="caption" sx={{ color: 'error.main', display: 'block', pl: 1, mt: 0.5 }}>
                  {errors.vendedor}
                </Typography>
              )}
            </Grid>

            {cadastrarVendedor && (
              <Grid size={{ xs: 12 }}>
                <TextField
                  fullWidth
                  label="Comissão Padrão do Vendedor (%)"
                  type="number"
                  placeholder="Ex: 1.5"
                  value={percentualComissao}
                  onChange={(e) => {
                    const val = e.target.value === '' ? '' : Math.max(0, parseFloat(e.target.value));
                    setPercentualComissao(val);
                  }}
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
            )}
            
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
                      checked={!!permissoes.visualizarDashboardVendedores}
                      onChange={(e) => handleCheckboxChange('visualizarDashboardVendedores', e.target.checked)}
                      disabled={role === 'master'}
                    />
                  }
                  label="Permitir visualizar Dashboard de Vendedores e Rankings"
                />
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={permissoes.editarVendas}
                      onChange={(e) => handleCheckboxChange('editarVendas', e.target.checked)}
                      disabled={role === 'master'}
                    />
                  }
                  label="Permitir cadastrar, editar e excluir Vendas/Comissões"
                />
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={!!permissoes.receberParcelas}
                      onChange={(e) => handleCheckboxChange('receberParcelas', e.target.checked)}
                      disabled={role === 'master' || role === 'editor'}
                    />
                  }
                  label="Permitir apenas marcar parcelas como Recebida"
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
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={!!permissoes.editarParcelas}
                      onChange={(e) => handleCheckboxChange('editarParcelas', e.target.checked)}
                      disabled={role === 'master' || role === 'editor'}
                    />
                  }
                  label="Permitir editar parcelas individualmente (datas, valores, status)"
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
            {loading ? 'Salvando...' : (editId ? 'Salvar Alterações' : 'Adicionar')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
