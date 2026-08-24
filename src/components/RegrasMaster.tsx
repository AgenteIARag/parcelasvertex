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
  Chip,
  Tabs,
  Tab,
  Tooltip,
  FormHelperText
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import AddIcon from '@mui/icons-material/Add';
import SaveIcon from '@mui/icons-material/Save';
import CloseIcon from '@mui/icons-material/Close';
import HomeIcon from '@mui/icons-material/Home';
import DirectionsCarIcon from '@mui/icons-material/DirectionsCar';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import ViewListIcon from '@mui/icons-material/ViewList';
import BusinessIcon from '@mui/icons-material/Business';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import SearchIcon from '@mui/icons-material/Search';
import ClearIcon from '@mui/icons-material/Clear';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import { type RegraMaster, type SegmentoType, type UserPermissions, type Empresa, type TipoTabela, type Administradora } from '../types';

interface RegrasMasterProps {
  regras: RegraMaster[];
  onAdicionarRegra: (regra: Omit<RegraMaster, 'id'>) => void;
  onEditarRegra: (regra: RegraMaster) => void;
  onExcluirRegra: (id: string) => void;
  permissoes: UserPermissions;
  empresas?: Empresa[];          // Lista de empresas disponíveis
  empresaAtualId?: string;       // Empresa do usuário logado
  isSuperMaster?: boolean;       // Super master pode editar regras de qualquer empresa
  administradoras?: Administradora[]; // Lista de administradoras de consórcio
}

export const RegrasMaster: React.FC<RegrasMasterProps> = ({
  regras,
  onAdicionarRegra,
  onEditarRegra,
  onExcluirRegra,
  permissoes,
  empresas = [],
  empresaAtualId,
  isSuperMaster = false,
  administradoras = [],
}) => {
  const theme = useTheme();
  const empresaAtual = empresas.find(e => e.id === empresaAtualId);

  // Estado do filtro por segmento, por texto de busca e por administradora
  const [abaSegmento, setAbaSegmento] = useState<SegmentoType | 'Todos'>('Todos');
  const [buscaTexto, setBuscaTexto] = useState('');
  const [administradoraFiltro, setAdministradoraFiltro] = useState<string>('');

  // Estados do Dialog de formulário
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [segmento, setSegmento] = useState<SegmentoType>('Imóveis');
  const [tabela, setTabela] = useState('');
  const [qtdParcelas, setQtdParcelas] = useState<number | ''>('');
  const [tipoTabela, setTipoTabela] = useState<TipoTabela>('Linear');
  const [percentualComissao, setPercentualComissao] = useState<number | ''>('');
  const [percentualAdesao, setPercentualAdesao] = useState<number | ''>('');
  const [percentualMensal, setPercentualMensal] = useState<number | ''>('');
  const [percentuaisParcelas, setPercentuaisParcelas] = useState<number[]>([]);
  const [percentualComissaoContemplacao, setPercentualComissaoContemplacao] = useState<number | ''>('');
  const [empresaIdForm, setEmpresaIdForm] = useState<string>(empresaAtualId || '');
  const [administradoraIdForm, setAdministradoraIdForm] = useState<string>('');
  const [administradoraNomeForm, setAdministradoraNomeForm] = useState<string>('');

  // Helper para recalcular a grade padrão de parcelas
  const recalcularGradePadrao = (
    qtd: number,
    tipo: TipoTabela,
    pTotal: number,
    pAdesao: number,
    pMensal: number
  ): number[] => {
    if (!qtd || qtd <= 0) return [];
    if (tipo === 'Adesão') {
      const rest = Math.max(1, qtd - 1);
      const valorMensalParcela = Number((pMensal / rest).toFixed(3));
      const arr = [pAdesao];
      for (let i = 1; i < qtd; i++) {
        arr.push(valorMensalParcela);
      }
      return arr;
    } else {
      const valorLinear = Number((pTotal / qtd).toFixed(3));
      return Array(qtd).fill(valorLinear);
    }
  };

  // Filtro de empresa para o super_master
  const [empresaFiltro, setEmpresaFiltro] = useState<string>('');

  // Erros de validação
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleOpen = (regra?: RegraMaster) => {
    if (regra) {
      setEditId(regra.id);
      setSegmento(regra.segmento);
      setTabela(regra.tabela);
      const qtd = regra.qtdParcelas;
      setQtdParcelas(qtd);
      const tipo = regra.tipoTabela || 'Linear';
      setTipoTabela(tipo);
      setPercentualComissao(regra.percentualComissao);
      setPercentualAdesao(regra.percentualAdesao ?? '');
      setPercentualMensal(regra.percentualMensal ?? '');
      if (regra.percentuaisParcelas && regra.percentuaisParcelas.length > 0) {
        setPercentuaisParcelas(regra.percentuaisParcelas);
      } else {
        setPercentuaisParcelas(
          recalcularGradePadrao(
            qtd,
            tipo,
            regra.percentualComissao,
            regra.percentualAdesao || 0,
            regra.percentualMensal || 0
          )
        );
      }
      setPercentualComissaoContemplacao(regra.percentualComissaoContemplacao ?? '');
      setEmpresaIdForm(regra.empresaId || empresaAtualId || '');
      setAdministradoraIdForm(regra.administradoraId || '');
      setAdministradoraNomeForm(regra.administradoraNome || '');
    } else {
      setEditId(null);
      setSegmento(abaSegmento !== 'Todos' ? abaSegmento : 'Imóveis');
      setTabela('');
      setQtdParcelas('');
      setTipoTabela('Linear');
      setPercentualComissao('');
      setPercentualAdesao('');
      setPercentualMensal('');
      setPercentuaisParcelas([]);
      setPercentualComissaoContemplacao('');
      setEmpresaIdForm(empresaAtualId || '');
      setAdministradoraIdForm('');
      setAdministradoraNomeForm('');
    }
    setErrors({});
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
  };

  const handleAlterarParcelaIndividual = (index: number, valorStr: string) => {
    const num = valorStr === '' ? 0 : Math.max(0, parseFloat(valorStr));
    const novaGrade = [...percentuaisParcelas];
    novaGrade[index] = num;
    setPercentuaisParcelas(novaGrade);
    
    // Atualiza a soma total em tempo real
    const soma = Number(novaGrade.reduce((a, b) => a + (Number(b) || 0), 0).toFixed(2));
    setPercentualComissao(soma);
    if (tipoTabela === 'Adesão') {
      setPercentualAdesao(novaGrade[0] || 0);
      const somaMensal = Number(novaGrade.slice(1).reduce((a, b) => a + (Number(b) || 0), 0).toFixed(2));
      setPercentualMensal(somaMensal);
    }
  };

  const validarFormulario = () => {
    const tempErrors: Record<string, string> = {};
    if (!tabela.trim()) tempErrors.tabela = 'O nome da tabela é obrigatório.';
    if (!qtdParcelas || Number(qtdParcelas) <= 0) {
      tempErrors.qtdParcelas = 'Insira uma quantidade de parcelas válida (maior que 0).';
    }
    if (tipoTabela === 'Linear') {
      if (percentualComissao === '' || Number(percentualComissao) < 0 || Number(percentualComissao) > 100) {
        tempErrors.percentualComissao = 'Insira uma comissão válida entre 0% e 100%.';
      }
    } else {
      // Adesão
      if (percentualAdesao === '' || Number(percentualAdesao) < 0 || Number(percentualAdesao) > 100) {
        tempErrors.percentualAdesao = 'Insira o % de Adesão válido (0% a 100%).';
      }
      if (percentualMensal === '' || Number(percentualMensal) < 0 || Number(percentualMensal) > 100) {
        tempErrors.percentualMensal = 'Insira o % Mensal válido (0% a 100%).';
      }
    }
    setErrors(tempErrors);
    return Object.keys(tempErrors).length === 0;
  };

  const handleSalvar = () => {
    if (!validarFormulario()) return;

    const qtd = Number(qtdParcelas);
    const gradeFinal = percentuaisParcelas.length === qtd
      ? percentuaisParcelas
      : recalcularGradePadrao(
          qtd,
          tipoTabela,
          Number(percentualComissao || 0),
          Number(percentualAdesao || 0),
          Number(percentualMensal || 0)
        );

    const pComissaoFinal = gradeFinal.length > 0
      ? Number(gradeFinal.reduce((a, b) => a + Number(b), 0).toFixed(2))
      : (tipoTabela === 'Linear' ? Number(percentualComissao) : Number(percentualAdesao || 0) + Number(percentualMensal || 0));

    const admEncontrada = administradoras.find(a => a.id === administradoraIdForm);
    const admNomeFinal = admEncontrada?.nome || administradoraNomeForm || undefined;

    const dadosRegra: Omit<RegraMaster, 'id'> = {
      segmento,
      tabela: tabela.trim(),
      qtdParcelas: qtd,
      tipoTabela,
      percentualComissao: pComissaoFinal,
      percentuaisParcelas: gradeFinal,
      ...(tipoTabela === 'Adesão' && {
        percentualAdesao: Number(percentualAdesao),
        percentualMensal: Number(percentualMensal)
      }),
      empresaId: empresaIdForm || undefined,
      administradoraId: administradoraIdForm || undefined,
      administradoraNome: admNomeFinal,
      ...(percentualComissaoContemplacao !== '' && { percentualComissaoContemplacao: Number(percentualComissaoContemplacao) })
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

  // Filtra regras por empresa (super_master pode ver todas ou filtrar; outros veem apenas as suas)
  const regrasVisiveis = regras.filter(r => {
    if (isSuperMaster) {
      if (empresaFiltro) return r.empresaId === empresaFiltro;
      return true;
    }
    // Master de empresa: vê apenas regras da sua empresa, globais (sem empresa), ou da empresa mãe
    const empresaAtual = empresas.find(e => e.id === empresaAtualId);
    return !r.empresaId || r.empresaId === empresaAtualId || (empresaAtual && r.empresaId === empresaAtual.empresaMaeId);
  });

  // Contadores de regras por segmento para exibir nas abas
  const countTodos = regrasVisiveis.length;
  const countImoveis = regrasVisiveis.filter(r => r.segmento === 'Imóveis').length;
  const countAutos = regrasVisiveis.filter(r => r.segmento === 'Autos Leves').length;
  const countPesados = regrasVisiveis.filter(r => r.segmento === 'Pesados').length;

  const regrasFiltradas = regrasVisiveis.filter(r => {
    const atendeSegmento = abaSegmento === 'Todos' || r.segmento === abaSegmento;
    if (!atendeSegmento) return false;

    if (administradoraFiltro) {
      const matchAdm = r.administradoraId === administradoraFiltro || r.administradoraNome === administradoraFiltro;
      if (!matchAdm) return false;
    }

    if (!buscaTexto.trim()) return true;
    const termo = buscaTexto.toLowerCase().trim();
    const matchTabela = r.tabela.toLowerCase().includes(termo);
    const matchSegmento = r.segmento.toLowerCase().includes(termo);
    const matchParcelas = `${r.qtdParcelas}x`.includes(termo) || String(r.qtdParcelas).includes(termo);
    const matchTipo = (r.tipoTabela || 'Linear').toLowerCase().includes(termo);
    const matchComissao = String(r.percentualComissao).includes(termo);
    const matchAdmNome = (r.administradoraNome || '').toLowerCase().includes(termo);

    return matchTabela || matchSegmento || matchParcelas || matchTipo || matchComissao || matchAdmNome;
  });

  // Empresa mãe das empresas disponíveis (para o filtro do super_master)
  const empresasMae = empresas.filter(e => !e.empresaMaeId && e.ativo);

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography
            variant="h5"
            sx={{ fontWeight: 700, fontFamily: 'Outfit, sans-serif', color: theme.palette.mode === 'dark' ? '#f8fafc' : '#0f172a' }}
          >
            Banco de Dados de Regras (BD Master)
          </Typography>
          <Typography variant="body2" sx={{ color: theme.palette.mode === 'dark' ? '#94a3b8' : '#64748b' }}>
            Gerencie as tabelas de comissionamento por segmento, administradora e número de parcelas
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Filtro por Administradora */}
          {administradoras.length > 0 && (
            <FormControl size="small" sx={{ minWidth: 190 }}>
              <InputLabel>Administradora</InputLabel>
              <Select
                value={administradoraFiltro}
                label="Administradora"
                onChange={e => setAdministradoraFiltro(e.target.value)}
              >
                <MenuItem value=""><em>Todas as ADMs</em></MenuItem>
                {administradoras.map(a => (
                  <MenuItem key={a.id} value={a.id}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8 }}>
                      <AccountBalanceIcon sx={{ fontSize: 15, color: '#818cf8' }} />
                      {a.nome}
                    </Box>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}

          {/* Filtro de empresa para super_master */}
          {isSuperMaster && empresasMae.length > 0 && (
            <FormControl size="small" sx={{ minWidth: 180 }}>
              <InputLabel>Filtrar por Empresa</InputLabel>
              <Select
                value={empresaFiltro}
                label="Filtrar por Empresa"
                onChange={e => setEmpresaFiltro(e.target.value)}
              >
                <MenuItem value=""><em>Todas</em></MenuItem>
                {empresas.map(e => (
                  <MenuItem key={e.id} value={e.id}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <BusinessIcon sx={{ fontSize: 14 }} />
                      {e.nome}
                    </Box>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}
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
      </Box>

      {/* Barra de Filtros: Abas por Segmento + Campo de Busca */}
      <Box sx={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 2,
        borderBottom: 1,
        borderColor: theme.palette.mode === 'dark' ? '#334155' : '#e2e8f0',
        mb: 3,
        pb: { xs: 1.5, md: 0 }
      }}>
        <Tabs
          value={abaSegmento}
          onChange={(_, val) => setAbaSegmento(val)}
          textColor="primary"
          indicatorColor="primary"
          sx={{
            '& .MuiTab-root': {
              fontFamily: 'Outfit, sans-serif',
              fontWeight: 600,
              fontSize: '0.875rem',
              textTransform: 'none',
              minWidth: 110,
              pb: 1.5,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 1
            }
          }}
        >
          <Tab
            value="Todos"
            icon={<ViewListIcon sx={{ fontSize: 18 }} />}
            iconPosition="start"
            label={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <span>Todos</span>
                <Chip label={countTodos} size="small" sx={{ height: 18, fontSize: '0.7rem', fontWeight: 700 }} />
              </Box>
            }
          />
          <Tab
            value="Imóveis"
            icon={<HomeIcon sx={{ fontSize: 18 }} />}
            iconPosition="start"
            label={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <span>Imóveis</span>
                <Chip label={countImoveis} size="small" sx={{ height: 18, fontSize: '0.7rem', fontWeight: 700, bgcolor: 'rgba(99, 102, 241, 0.15)', color: '#818cf8' }} />
              </Box>
            }
          />
          <Tab
            value="Autos Leves"
            icon={<DirectionsCarIcon sx={{ fontSize: 18 }} />}
            iconPosition="start"
            label={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <span>Autos Leves</span>
                <Chip label={countAutos} size="small" sx={{ height: 18, fontSize: '0.7rem', fontWeight: 700, bgcolor: 'rgba(16, 185, 129, 0.15)', color: '#34d399' }} />
              </Box>
            }
          />
          <Tab
            value="Pesados"
            icon={<LocalShippingIcon sx={{ fontSize: 18 }} />}
            iconPosition="start"
            label={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <span>Pesados</span>
                <Chip label={countPesados} size="small" sx={{ height: 18, fontSize: '0.7rem', fontWeight: 700, bgcolor: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24' }} />
              </Box>
            }
          />
        </Tabs>

        {/* Campo de Busca Rápida */}
        <TextField
          size="small"
          placeholder="Buscar tabela, parcelas (ex: 120x)..."
          value={buscaTexto}
          onChange={e => setBuscaTexto(e.target.value)}
          sx={{
            minWidth: { xs: '100%', sm: 280 },
            mb: { xs: 1, md: 1 },
            '& .MuiOutlinedInput-root': {
              borderRadius: 2.5,
              bgcolor: theme.palette.mode === 'dark' ? 'rgba(30, 41, 59, 0.6)' : '#ffffff',
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
              <TableCell sx={{ fontWeight: 650, color: theme.palette.mode === 'dark' ? '#cbd5e1' : '#475569' }} align="center">Tipo</TableCell>
              <TableCell sx={{ fontWeight: 650, color: theme.palette.mode === 'dark' ? '#cbd5e1' : '#475569' }} align="right">Qtd. Parcelas</TableCell>
              <TableCell sx={{ fontWeight: 650, color: theme.palette.mode === 'dark' ? '#cbd5e1' : '#475569' }} align="right">Comissionamento</TableCell>
              <TableCell sx={{ fontWeight: 650, color: theme.palette.mode === 'dark' ? '#cbd5e1' : '#475569' }} align="right">% Contempl.</TableCell>
              {isSuperMaster && (
                <TableCell sx={{ fontWeight: 650, color: theme.palette.mode === 'dark' ? '#cbd5e1' : '#475569' }} align="center">Empresa</TableCell>
              )}
              {permissoes?.cadastrarRegras && (
                <TableCell sx={{ fontWeight: 650, color: theme.palette.mode === 'dark' ? '#cbd5e1' : '#475569' }} align="center">Ações</TableCell>
              )}
            </TableRow>
          </TableHead>
          <TableBody>
            {regrasFiltradas.length === 0 ? (
              <TableRow>
                <TableCell colSpan={(permissoes?.cadastrarRegras ? 1 : 0) + (isSuperMaster ? 1 : 0) + 6} align="center" sx={{ py: 6 }}>
                  <Typography variant="body1" sx={{ color: theme.palette.mode === 'dark' ? '#64748b' : '#94a3b8' }}>
                    {abaSegmento === 'Todos' 
                      ? 'Nenhuma regra cadastrada.' 
                      : `Nenhuma regra cadastrada para o segmento ${abaSegmento}.`}
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              regrasFiltradas.map((regra) => {
                const chipEstilo = getCorChip(regra.segmento);
                const isAdesao = regra.tipoTabela === 'Adesão';
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
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.4 }}>
                        <span>{regra.tabela}</span>
                        {(regra.administradoraNome || regra.administradoraId) && (
                          <Chip
                            icon={<AccountBalanceIcon sx={{ fontSize: 13 }} />}
                            label={regra.administradoraNome || administradoras.find(a => a.id === regra.administradoraId)?.nome || regra.administradoraId}
                            size="small"
                            sx={{
                              width: 'fit-content',
                              height: 20,
                              fontSize: '0.68rem',
                              fontWeight: 600,
                              bgcolor: 'rgba(99, 102, 241, 0.08)',
                              color: '#818cf8',
                              borderRadius: 1.2
                            }}
                          />
                        )}
                      </Box>
                    </TableCell>
                    <TableCell align="center">
                      <Chip
                        label={regra.tipoTabela || 'Linear'}
                        size="small"
                        sx={{
                          fontWeight: 700,
                          fontSize: '0.7rem',
                          borderRadius: 1.5,
                          bgcolor: isAdesao ? 'rgba(245,158,11,0.12)' : 'rgba(99,102,241,0.12)',
                          color: isAdesao ? '#f59e0b' : '#818cf8',
                        }}
                      />
                    </TableCell>
                    <TableCell align="right" sx={{ color: theme.palette.mode === 'dark' ? '#cbd5e1' : '#334155' }}>
                      {regra.qtdParcelas}x
                    </TableCell>
                    <TableCell align="right">
                      {isAdesao ? (
                        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 0.2 }}>
                          <Typography variant="caption" sx={{ fontWeight: 700, color: '#f59e0b' }}>
                            1ª Parcela (Adesão): {Number(regra.percentualAdesao || 0).toFixed(2).replace('.', ',')}%
                          </Typography>
                          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                            Mensal: {Number(regra.percentualMensal || 0).toFixed(2).replace('.', ',')}% (em {Math.max(1, regra.qtdParcelas - 1)}x)
                          </Typography>
                          <Typography variant="body2" sx={{ fontWeight: 700, color: theme.palette.success.main }}>
                            Total: {Number(regra.percentualComissao || 0).toFixed(2).replace('.', ',')}%
                          </Typography>
                          {regra.percentuaisParcelas && regra.percentuaisParcelas.length > 0 && (
                            <Tooltip title={regra.percentuaisParcelas.map((p, i) => `P${i + 1}: ${p}%`).join(' | ')}>
                              <Chip
                                label="Ver Grade"
                                size="small"
                                sx={{ height: 16, fontSize: '0.62rem', cursor: 'pointer', mt: 0.2 }}
                              />
                            </Tooltip>
                          )}
                        </Box>
                      ) : (
                        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 0.2 }}>
                          <Typography variant="body2" sx={{ fontWeight: 600, color: theme.palette.success.main }}>
                            {Number(regra.percentualComissao || 0).toFixed(2).replace('.', ',')}% Linear
                          </Typography>
                          {regra.percentuaisParcelas && regra.percentuaisParcelas.length > 0 && (
                            <Tooltip title={regra.percentuaisParcelas.map((p, i) => `P${i + 1}: ${p}%`).join(' | ')}>
                              <Chip
                                label="Grade Customizada"
                                size="small"
                                color="info"
                                sx={{ height: 16, fontSize: '0.62rem', cursor: 'pointer', mt: 0.2 }}
                              />
                            </Tooltip>
                          )}
                        </Box>
                      )}
                    </TableCell>
                    <TableCell
                      align="right"
                      sx={{
                        fontWeight: 600,
                        color: regra.percentualComissaoContemplacao ? '#f59e0b' : (theme.palette.mode === 'dark' ? '#475569' : '#cbd5e1')
                      }}
                    >
                      {regra.percentualComissaoContemplacao
                        ? `${Number(regra.percentualComissaoContemplacao).toFixed(2).replace('.', ',')}%`
                        : '—'}
                    </TableCell>
                    {/* Empresa (visível apenas para super_master) */}
                    {isSuperMaster && (
                      <TableCell align="center">
                        {regra.empresaId ? (
                          <Tooltip title={`ID: ${regra.empresaId}`}>
                            <Chip
                              icon={<BusinessIcon sx={{ fontSize: 13 }} />}
                              label={empresas.find(e => e.id === regra.empresaId)?.nome || regra.empresaId}
                              size="small"
                              sx={{ fontSize: '0.7rem', borderRadius: 1.5, fontWeight: 600 }}
                            />
                          </Tooltip>
                        ) : (
                          <Typography variant="caption" sx={{ color: 'text.disabled' }}>Global</Typography>
                        )}
                      </TableCell>
                    )}
                    {permissoes?.cadastrarRegras && (
                      <TableCell align="center">
                        {!(empresaAtual?.empresaMaeId && regra.empresaId === empresaAtual.empresaMaeId) && (
                          <>
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
                          </>
                        )}
                        {empresaAtual?.empresaMaeId && regra.empresaId === empresaAtual.empresaMaeId && (
                          <Tooltip title="Regra herdada da matriz. Edição não permitida aqui.">
                            <InfoOutlinedIcon sx={{ color: 'text.disabled', fontSize: 20 }} />
                          </Tooltip>
                        )}
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
        maxWidth="sm"
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
            {/* Empresa da Regra — visível apenas para super_master */}
            {isSuperMaster && empresas.length > 0 && (
              <Grid size={{ xs: 12 }}>
                <FormControl fullWidth>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8, mb: 0.5 }}>
                    <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary' }}>
                      Empresa Proprietária da Regra
                    </Typography>
                    <Tooltip
                      arrow
                      title={
                        <Box sx={{ p: 0.5 }}>
                          <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5 }}>
                            💡 Como funciona a Empresa Proprietária:
                          </Typography>
                          <Typography variant="caption" sx={{ display: 'block', mb: 0.5, lineHeight: 1.4 }}>
                            • <strong>Empresa Mãe (ex: Vetex Master):</strong> A regra pertence exclusivamente à matriz. As empresas filhas usarão essa tabela como base para cadastrar seus percentuais e repassar o diferencial de comissão das vendas.
                          </Typography>
                          <Typography variant="caption" sx={{ display: 'block', lineHeight: 1.4 }}>
                            • <strong>Global:</strong> Regra padrão do sistema, visível para todas as empresas sem vínculo exclusivo.
                          </Typography>
                        </Box>
                      }
                      slotProps={{
                        tooltip: {
                          sx: {
                            bgcolor: theme.palette.mode === 'dark' ? '#0f172a' : '#1e293b',
                            color: '#f8fafc',
                            p: 1.5,
                            borderRadius: 2,
                            boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
                            maxWidth: 320,
                            border: '1px solid rgba(255,255,255,0.1)'
                          }
                        }
                      }}
                    >
                      <IconButton size="small" sx={{ p: 0.2, color: 'primary.main' }}>
                        <InfoOutlinedIcon sx={{ fontSize: 16 }} />
                      </IconButton>
                    </Tooltip>
                  </Box>
                  <Select
                    value={empresaIdForm}
                    onChange={e => setEmpresaIdForm(e.target.value)}
                    displayEmpty
                    size="small"
                  >
                    <MenuItem value=""><em>Global (sem empresa específica)</em></MenuItem>
                    {empresas.filter(e => !e.empresaMaeId).map(e => (
                      <MenuItem key={e.id} value={e.id}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <BusinessIcon sx={{ fontSize: 14 }} />
                          {e.nome}
                        </Box>
                      </MenuItem>
                    ))}
                  </Select>
                  <FormHelperText sx={{ fontSize: '0.72rem' }}>
                    {empresaIdForm 
                      ? 'Regra vinculada à Empresa Mãe (base de repasse das filhas)' 
                      : 'Regra padrão compartilhada entre todas as empresas'}
                  </FormHelperText>
                </FormControl>
              </Grid>
            )}
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

            {/* Administradora do Consórcio */}
            <Grid size={{ xs: 12 }}>
              <FormControl fullWidth size="small">
                <InputLabel id="administradora-regra-label">Administradora do Consórcio</InputLabel>
                <Select
                  labelId="administradora-regra-label"
                  value={administradoraIdForm}
                  label="Administradora do Consórcio"
                  onChange={(e) => {
                    const id = e.target.value;
                    setAdministradoraIdForm(id);
                    const adm = administradoras.find(a => a.id === id);
                    setAdministradoraNomeForm(adm?.nome || '');
                  }}
                >
                  <MenuItem value=""><em>Nenhuma / Não especificada</em></MenuItem>
                  {administradoras.filter(a => a.ativo || a.id === administradoraIdForm).map(adm => (
                    <MenuItem key={adm.id} value={adm.id}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <AccountBalanceIcon sx={{ fontSize: 16, color: '#818cf8' }} />
                        {adm.nome}
                      </Box>
                    </MenuItem>
                  ))}
                </Select>
                <FormHelperText sx={{ fontSize: '0.72rem' }}>
                  Vincule a tabela à administradora parceira para filtros e relatórios unificados
                </FormHelperText>
              </FormControl>
            </Grid>

            <Grid size={{ xs: 12 }}>
              <TextField
                fullWidth
                label="Nome da Tabela *"
                placeholder="Ex: Tabela Platinum"
                value={tabela}
                onChange={(e) => setTabela(e.target.value)}
                error={!!errors.tabela}
                helperText={errors.tabela}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <FormControl fullWidth>
                <InputLabel id="tipo-tabela-label">Tipo de Tabela</InputLabel>
                <Select
                  labelId="tipo-tabela-label"
                  value={tipoTabela}
                  label="Tipo de Tabela"
                  onChange={(e) => {
                    const novoTipo = e.target.value as TipoTabela;
                    setTipoTabela(novoTipo);
                    if (qtdParcelas) {
                      setPercentuaisParcelas(
                        recalcularGradePadrao(
                          Number(qtdParcelas),
                          novoTipo,
                          Number(percentualComissao || 0),
                          Number(percentualAdesao || 0),
                          Number(percentualMensal || 0)
                        )
                      );
                    }
                  }}
                >
                  <MenuItem value="Linear">Linear (Igual em todas as parcelas)</MenuItem>
                  <MenuItem value="Adesão">Adesão (Entrada na 1ª + Mensal)</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                label="Qtd. Parcelas"
                type="number"
                placeholder="Ex: 12"
                value={qtdParcelas}
                onChange={(e) => {
                  const val = e.target.value === '' ? '' : Math.max(1, parseInt(e.target.value));
                  setQtdParcelas(val);
                  if (val && typeof val === 'number') {
                    setPercentuaisParcelas(
                      recalcularGradePadrao(
                        val,
                        tipoTabela,
                        Number(percentualComissao || 0),
                        Number(percentualAdesao || 0),
                        Number(percentualMensal || 0)
                      )
                    );
                  }
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

            {tipoTabela === 'Linear' ? (
              <Grid size={{ xs: 12 }}>
                <TextField
                  fullWidth
                  label="Comissão Total (%)"
                  type="number"
                  placeholder="Ex: 5.5"
                  value={percentualComissao}
                  onChange={(e) => {
                    const val = e.target.value === '' ? '' : Math.max(0, parseFloat(e.target.value));
                    setPercentualComissao(val);
                    if (qtdParcelas && typeof qtdParcelas === 'number' && val !== '') {
                      setPercentuaisParcelas(
                        recalcularGradePadrao(
                          qtdParcelas,
                          'Linear',
                          Number(val),
                          0,
                          0
                        )
                      );
                    }
                  }}
                  error={!!errors.percentualComissao}
                  helperText={errors.percentualComissao || "Distribuída entre as parcelas de comissão"}
                  slotProps={{
                    input: {
                      endAdornment: <InputAdornment position="end">%</InputAdornment>
                    },
                    htmlInput: {
                      step: '0.01',
                      min: '0',
                      max: '100'
                    }
                  }}
                />
              </Grid>
            ) : (
              <>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    fullWidth
                    label="% Adesão (1ª Parcela)"
                    type="number"
                    placeholder="Ex: 2.0"
                    value={percentualAdesao}
                    onChange={(e) => {
                      const val = e.target.value === '' ? '' : Math.max(0, parseFloat(e.target.value));
                      setPercentualAdesao(val);
                      if (qtdParcelas && typeof qtdParcelas === 'number') {
                        setPercentuaisParcelas(
                          recalcularGradePadrao(
                            qtdParcelas,
                            'Adesão',
                            0,
                            Number(val || 0),
                            Number(percentualMensal || 0)
                          )
                        );
                        setPercentualComissao(Number((Number(val || 0) + Number(percentualMensal || 0)).toFixed(2)));
                      }
                    }}
                    error={!!errors.percentualAdesao}
                    helperText={errors.percentualAdesao || "Pago na 1ª parcela"}
                    slotProps={{
                      input: {
                        endAdornment: <InputAdornment position="end">%</InputAdornment>
                      },
                      htmlInput: {
                        step: '0.01',
                        min: '0',
                        max: '100'
                      }
                    }}
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    fullWidth
                    label="% Mensal (Restantes)"
                    type="number"
                    placeholder="Ex: 3.0"
                    value={percentualMensal}
                    onChange={(e) => {
                      const val = e.target.value === '' ? '' : Math.max(0, parseFloat(e.target.value));
                      setPercentualMensal(val);
                      if (qtdParcelas && typeof qtdParcelas === 'number') {
                        setPercentuaisParcelas(
                          recalcularGradePadrao(
                            qtdParcelas,
                            'Adesão',
                            0,
                            Number(percentualAdesao || 0),
                            Number(val || 0)
                          )
                        );
                        setPercentualComissao(Number((Number(percentualAdesao || 0) + Number(val || 0)).toFixed(2)));
                      }
                    }}
                    error={!!errors.percentualMensal}
                    helperText={errors.percentualMensal || `Fracionado em ${Math.max(1, Number(qtdParcelas || 1) - 1)} parcelas`}
                    slotProps={{
                      input: {
                        endAdornment: <InputAdornment position="end">%</InputAdornment>
                      },
                      htmlInput: {
                        step: '0.01',
                        min: '0',
                        max: '100'
                      }
                    }}
                  />
                </Grid>
              </>
            )}

            {/* Seção da Grade de Parcelas Customizadas */}
            {qtdParcelas && Number(qtdParcelas) > 0 && (
              <Grid size={{ xs: 12 }}>
                <Box sx={{
                  p: 2,
                  borderRadius: 2.5,
                  border: `1px solid ${theme.palette.mode === 'dark' ? '#334155' : '#e2e8f0'}`,
                  bgcolor: theme.palette.mode === 'dark' ? 'rgba(15,23,42,0.6)' : '#f8fafc'
                }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5, flexWrap: 'wrap', gap: 1 }}>
                    <Box>
                      <Typography variant="subtitle2" sx={{ fontWeight: 700, fontFamily: 'Outfit, sans-serif' }}>
                        📊 Grade de Percentuais por Parcela ({qtdParcelas}x)
                      </Typography>
                      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                        Ajuste o percentual individual de cada parcela. O total é calculado automaticamente.
                      </Typography>
                    </Box>
                    <Chip
                      label={`Total: ${Number(percentualComissao || 0).toFixed(2).replace('.', ',')}%`}
                      color="primary"
                      size="small"
                      sx={{ fontWeight: 800, fontSize: '0.8rem' }}
                    />
                  </Box>

                  <Box sx={{
                    display: 'grid',
                    gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(3, 1fr)', md: 'repeat(4, 1fr)' },
                    gap: 1.5,
                    maxHeight: 220,
                    overflowY: 'auto',
                    p: 0.5
                  }}>
                    {Array.from({ length: Number(qtdParcelas) }).map((_, i) => {
                      const valParcela = percentuaisParcelas[i] !== undefined ? percentuaisParcelas[i] : '';
                      return (
                        <Box key={i} sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                          <TextField
                            size="small"
                            label={`Parcela ${i + 1}`}
                            type="number"
                            value={valParcela}
                            onChange={(e) => handleAlterarParcelaIndividual(i, e.target.value)}
                            slotProps={{
                              input: {
                                endAdornment: <InputAdornment position="end">%</InputAdornment>
                              },
                              htmlInput: {
                                step: '0.01',
                                min: '0',
                                max: '100'
                              }
                            }}
                          />
                        </Box>
                      );
                    })}
                  </Box>
                </Box>
              </Grid>
            )}

            <Grid size={{ xs: 12 }}>
              <TextField
                fullWidth
                label="% Comissão na Contemplação (opcional)"
                type="number"
                placeholder="Ex: 2.5"
                value={percentualComissaoContemplacao}
                onChange={(e) => {
                  const val = e.target.value === '' ? '' : Math.max(0, parseFloat(e.target.value));
                  setPercentualComissaoContemplacao(val);
                }}
                helperText="Percentual da comissão pago no mês da contemplação do cliente"
                slotProps={{
                  input: {
                    endAdornment: <InputAdornment position="end">%</InputAdornment>
                  },
                  htmlInput: {
                    step: '0.01',
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
