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
  InputAdornment,
  Grid,
  useTheme,
  Alert
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import CloseIcon from '@mui/icons-material/Close';
import BlockIcon from '@mui/icons-material/Block';
import PercentIcon from '@mui/icons-material/Percent';
import {
  type LancamentoVenda,
  type RegraMaster,
  type SegmentoType,
  type StatusParcela,
  type Vendedor,
  type ProjecaoMensalType,
  type UserPermissions
} from '../types';
import { gerarProjecaoVazia, calcularTotaisLinha, getStatusInicial } from '../data/initialData';
import { formatarMoeda, formatarChaveMesExibicao } from '../utils/formatters';

interface SimuladorVendasProps {
  vendas: LancamentoVenda[];
  regras: RegraMaster[];
  vendedores: Vendedor[];
  onAdicionarVenda: (venda: LancamentoVenda) => void;
  onAtualizarVenda: (venda: LancamentoVenda) => void;
  onExcluirVenda: (id: string) => void;
  permissoes: UserPermissions;
}

export const SimuladorVendas: React.FC<SimuladorVendasProps> = ({
  vendas,
  regras,
  vendedores,
  onAdicionarVenda,
  onAtualizarVenda,
  onExcluirVenda,
  permissoes
}) => {
  const theme = useTheme();

  // Estados para inclusão de nova venda
  const [openDialog, setOpenDialog] = useState(false);
  const [cliente, setCliente] = useState('');
  const [vendedorId, setVendedorId] = useState('');
  const [segmento, setSegmento] = useState<SegmentoType | ''>('');
  const [tabela, setTabela] = useState('');
  const [qtdParcelas, setQtdParcelas] = useState<number | ''>('');
  const [percentualComissao, setPercentualComissao] = useState<number>(0);
  const [valorVendaInput, setValorVendaInput] = useState<number | ''>('');
  const [valorParcelaInput, setValorParcelaInput] = useState<number | ''>('');
  const [dataVendaInput, setDataVendaInput] = useState<string>('');
  const [dataSegundaParcelaInput, setDataSegundaParcelaInput] = useState<string>('');

  // Estado para controle de edição inline das células de venda
  const [editingCell, setEditingCell] = useState<{ vendaId: string; mes: string } | null>(null);

  // Estados para filtro de data geral (padrão cobre todo o ano de 2026)
  const [dataInicio, setDataInicio] = useState<string>('2026-01-01');
  const [dataFim, setDataFim] = useState<string>('2026-12-31');

  // Validação
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Listas filtradas para os dropdowns dependentes
  const [tabelasDisponiveis, setTabelasDisponiveis] = useState<string[]>([]);
  const [parcelasDisponiveis, setParcelasDisponiveis] = useState<number[]>([]);

  // Monitora alterações nos dropdowns dependentes
  useEffect(() => {
    if (segmento) {
      const tabs = regras
        .filter((r) => r.segmento === segmento)
        .map((r) => r.tabela);
      setTabelasDisponiveis(Array.from(new Set(tabs)));
      setTabela('');
      setQtdParcelas('');
      setPercentualComissao(0);
    } else {
      setTabelasDisponiveis([]);
      setTabela('');
      setQtdParcelas('');
      setPercentualComissao(0);
    }
  }, [segmento, regras]);

  useEffect(() => {
    if (segmento && tabela) {
      const parsFiltrado = regras
        .filter((r) => r.segmento === segmento && r.tabela === tabela)
        .map((r) => r.qtdParcelas);
      setParcelasDisponiveis(Array.from(new Set(parsFiltrado)));
      setQtdParcelas('');
      setPercentualComissao(0);
    } else {
      setParcelasDisponiveis([]);
      setQtdParcelas('');
      setPercentualComissao(0);
    }
  }, [tabela, segmento, regras]);

  useEffect(() => {
    if (segmento && tabela && qtdParcelas !== '') {
      const regra = regras.find(
        (r) =>
          r.segmento === segmento &&
          r.tabela === tabela &&
          r.qtdParcelas === Number(qtdParcelas)
      );
      if (regra) {
        setPercentualComissao(regra.percentualComissao);
      } else {
        setPercentualComissao(0);
      }
    } else {
      setPercentualComissao(0);
    }
  }, [qtdParcelas, tabela, segmento, regras]);

  // Expande automaticamente a dataFim do filtro geral quando alguma parcela ativa ultrapassar o ano de 2026
  useEffect(() => {
    let dataMax = '2026-12-31';
    vendas.forEach((venda) => {
      Object.values(venda.projecaoMensal).forEach((mesObj) => {
        if (mesObj.valorVenda > 0 && mesObj.status !== 'Cancelada' && mesObj.dataVencimento > dataMax) {
          dataMax = mesObj.dataVencimento;
        }
      });
    });

    const [ano] = dataMax.split('-');
    const novaDataFim = `${ano}-12-31`;
    if (novaDataFim > dataFim) {
      setDataFim(novaDataFim);
    }
  }, [vendas, dataFim]);

  const handleOpenDialog = () => {
    setCliente('');
    setVendedorId('');
    setSegmento('');
    setTabela('');
    setQtdParcelas('');
    setPercentualComissao(0);
    setValorVendaInput('');
    setValorParcelaInput('');
    setDataVendaInput('');
    setDataSegundaParcelaInput('');
    setErrors({});
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
  };

  const handleSalvarVenda = () => {
    const tempErrors: Record<string, string> = {};
    if (!cliente.trim()) tempErrors.cliente = 'Nome do cliente é obrigatório.';
    if (!vendedorId) tempErrors.vendedorId = 'Selecione o vendedor.';
    if (!segmento) tempErrors.segmento = 'Selecione o segmento.';
    if (!tabela) tempErrors.tabela = 'Selecione a tabela.';
    if (qtdParcelas === '') tempErrors.qtdParcelas = 'Selecione a quantidade de parcelas.';
    if (valorVendaInput === '' || Number(valorVendaInput) <= 0) {
      tempErrors.valorVendaInput = 'O valor do crédito é obrigatório e deve ser maior que zero.';
    }
    if (valorParcelaInput === '' || Number(valorParcelaInput) <= 0) {
      tempErrors.valorParcelaInput = 'O valor da parcela é obrigatório e deve ser maior que zero.';
    }
    if (!dataVendaInput) {
      tempErrors.dataVendaInput = 'A data da venda é obrigatória.';
    }
    if (!dataSegundaParcelaInput) {
      tempErrors.dataSegundaParcelaInput = 'Data da 2ª parcela é obrigatória.';
    }

    setErrors(tempErrors);

    if (Object.keys(tempErrors).length > 0) return;

    const proj: ProjecaoMensalType = {};
    const parcelas = Number(qtdParcelas);
    const valorVendaV = Number(valorVendaInput);
    const valorParcelaV = Number(valorParcelaInput);
    const percentualMensal = percentualComissao / parcelas;
    const vendedorSelecionado = vendedores.find((v) => v.id === vendedorId);

    // Inicializa a projeção de base de 2026 com valores zerados
    const projVaziaBase = gerarProjecaoVazia();
    Object.assign(proj, projVaziaBase);

    // Extrai o ano e o mês de início da data da venda
    const [anoStr, mesStr] = dataVendaInput.split('-');
    let ano = Number(anoStr);
    let mesNum = Number(mesStr);
    const mesInicioChave = `${ano}-${String(mesNum).padStart(2, '0')}`;

    for (let i = 0; i < parcelas; i++) {
      const mesChave = `${ano}-${String(mesNum).padStart(2, '0')}`;
      const dataVenc = `${mesChave}-15`;
      const status = getStatusInicial(dataVenc);

      proj[mesChave] = {
        valorVenda: valorVendaV, // O valor do crédito se repete nas colunas
        valorParcela: valorParcelaV, // O valor da parcela mensal
        comissaoGerada: Number((valorVendaV * (percentualMensal / 100)).toFixed(2)),
        status,
        dataVencimento: dataVenc
      };

      // Avança para o próximo mês de vencimento da parcela
      mesNum++;
      if (mesNum > 12) {
        mesNum = 1;
        ano++;
      }
    }

    const { totalVendas, totalComissoes, projecaoAtualizada } = calcularTotaisLinha(
      proj,
      percentualComissao,
      parcelas
    );

    const dataSegundaParcela = dataSegundaParcelaInput;

    const novaVenda: LancamentoVenda = {
      id: `v_${Date.now()}`,
      cliente: cliente.trim(),
      vendedorId,
      vendedorNome: vendedorSelecionado?.nome || '',
      dataVenda: dataVendaInput,
      dataSegundaParcela,
      mesInicio: mesInicioChave,
      segmento: segmento as SegmentoType,
      tabela,
      qtdParcelas: parcelas,
      percentualComissao,
      valorVenda: valorVendaV,
      valorParcela: valorParcelaV,
      projecaoMensal: projecaoAtualizada,
      totalVendas,
      totalComissoes,
      statusCliente: 'Ativo'
    };

    onAdicionarVenda(novaVenda);
    handleCloseDialog();
  };

  // Edição inline de valores mensais na timeline
  const handleAlterarValorMensal = (
    vendaId: string,
    mes: string,
    novoValor: number
  ) => {
    const venda = vendas.find((v) => v.id === vendaId);
    if (!venda) return;

    const projecaoAtualizada = {
      ...venda.projecaoMensal,
      [mes]: {
        ...(venda.projecaoMensal[mes] || {
          valorVenda: 0,
          comissaoGerada: 0,
          status: 'A vencer' as StatusParcela,
          dataVencimento: `${mes}-15`
        }),
        valorVenda: novoValor
      }
    };

    const { totalVendas, totalComissoes, projecaoAtualizada: projFina } = calcularTotaisLinha(
      projecaoAtualizada,
      venda.percentualComissao,
      venda.qtdParcelas
    );

    const temParcelasAtivas = Object.values(projFina).some(p => p.status !== 'Cancelada' && p.valorVenda > 0);
    const novoStatusCliente = temParcelasAtivas ? 'Ativo' : 'Cancelado';

    onAtualizarVenda({
      ...venda,
      projecaoMensal: projFina,
      totalVendas,
      totalComissoes,
      statusCliente: novoStatusCliente
    });
  };

  const handleAlterarStatusParcela = (
    vendaId: string,
    mes: string,
    novoStatus: StatusParcela
  ) => {
    const venda = vendas.find((v) => v.id === vendaId);
    if (!venda) return;

    const projecaoAtualizada = {
      ...venda.projecaoMensal,
      [mes]: {
        ...(venda.projecaoMensal[mes] || {
          valorVenda: 0,
          comissaoGerada: 0,
          status: 'A vencer' as StatusParcela,
          dataVencimento: `${mes}-15`
        }),
        status: novoStatus
      }
    };

    const { totalVendas, totalComissoes, projecaoAtualizada: projFina } = calcularTotaisLinha(
      projecaoAtualizada,
      venda.percentualComissao,
      venda.qtdParcelas
    );

    const temParcelasAtivas = Object.values(projFina).some(p => p.status !== 'Cancelada' && p.valorVenda > 0);
    const novoStatusCliente = temParcelasAtivas ? 'Ativo' : 'Cancelado';

    onAtualizarVenda({
      ...venda,
      projecaoMensal: projFina,
      totalVendas,
      totalComissoes,
      statusCliente: novoStatusCliente
    });
  };

  const handleCancelarAPartirDoMes = (vendaId: string, mesLimite: string) => {
    const venda = vendas.find((v) => v.id === vendaId);
    if (!venda) return;

    const projecaoAtualizada = { ...venda.projecaoMensal };
    let iniciouCancelamento = false;

    // Ordena as chaves cronologicamente para garantir o cancelamento sequencial em múltiplos anos
    const chavesOrdenadas = Object.keys(projecaoAtualizada).sort();

    chavesOrdenadas.forEach((mes) => {
      if (mes === mesLimite) {
        iniciouCancelamento = true;
      }
      if (iniciouCancelamento) {
        projecaoAtualizada[mes] = {
          ...projecaoAtualizada[mes],
          status: 'Cancelada'
        };
      }
    });

    const { totalVendas, totalComissoes, projecaoAtualizada: projFina } = calcularTotaisLinha(
      projecaoAtualizada,
      venda.percentualComissao,
      venda.qtdParcelas
    );

    onAtualizarVenda({
      ...venda,
      statusCliente: 'Cancelado',
      projecaoMensal: projFina,
      totalVendas,
      totalComissoes
    });
  };



  // Obtém o rótulo do número da parcela (ex: "1/36")
  const obterNumeroParcela = (venda: LancamentoVenda, mesChave: string): string => {
    if (!venda.mesInicio) return '';
    const [anoI, mesI] = venda.mesInicio.split('-').map(Number);
    const [anoC, mesC] = mesChave.split('-').map(Number);
    const diferencaMeses = (anoC - anoI) * 12 + (mesC - mesI);
    if (diferencaMeses >= 0 && diferencaMeses < venda.qtdParcelas) {
      return `${diferencaMeses + 1}/${venda.qtdParcelas}`;
    }
    return '';
  };

  // Gera dinamicamente a lista de chaves "YYYY-MM" no intervalo do filtro geral "De" e "Até"
  const obterMesesNoIntervalo = (inicio: string, fim: string): string[] => {
    const meses: string[] = [];
    const dataI = new Date(inicio + 'T00:00:00');
    const dataF = new Date(fim + 'T00:00:00');

    let dataAtual = new Date(dataI.getFullYear(), dataI.getMonth(), 15);
    const dataLimite = new Date(dataF.getFullYear(), dataF.getMonth(), 15);

    while (dataAtual <= dataLimite) {
      const ano = dataAtual.getFullYear();
      const mes = String(dataAtual.getMonth() + 1).padStart(2, '0');
      meses.push(`${ano}-${mes}`);
      
      dataAtual.setMonth(dataAtual.getMonth() + 1);
    }
    return meses;
  };

  // Filtro de meses (limita colunas geradas aos meses setados pelo filtro De/Até)
  const mesesFiltrados = useMemo(() => obterMesesNoIntervalo(dataInicio, dataFim), [dataInicio, dataFim]);

  // Totais de vendas e comissões acumulados no período filtrado para cada linha
  const obterTotaisFiltrados = (venda: LancamentoVenda) => {
    let totalComissoesPeriodo = 0;
    let parcelasAtivasPeriodo = 0;

    mesesFiltrados.forEach((mes) => {
      const dadosMes = venda.projecaoMensal[mes];
      if (dadosMes && dadosMes.status !== 'Cancelada' && dadosMes.valorVenda > 0) {
        totalComissoesPeriodo += dadosMes.comissaoGerada || 0;
        parcelasAtivasPeriodo += 1;
      }
    });

    // O faturamento nominal do contrato é proporcional ao número de parcelas faturadas no período filtrado
    const totalVendasPeriodo = parcelasAtivasPeriodo > 0 
      ? (venda.valorVenda / venda.qtdParcelas) * parcelasAtivasPeriodo 
      : 0;

    return { totalVendasPeriodo, totalComissoesPeriodo };
  };

  // Cálculo dos totais de rodapé para a timeline filtrados
  const calcularTotaisMensais = () => {
    const totais: Record<string, { vendas: number; comissoes: number }> = {};
    mesesFiltrados.forEach((mes) => {
      totais[mes] = { vendas: 0, comissoes: 0 };
    });

    let totalGeralVendas = 0;
    let totalGeralComissoes = 0;

    vendas.forEach((v) => {
      // Soma o faturamento nominal proporcional da linha no período filtrado
      const { totalVendasPeriodo } = obterTotaisFiltrados(v);
      totalGeralVendas += totalVendasPeriodo;

      mesesFiltrados.forEach((mes) => {
        const celula = v.projecaoMensal[mes];
        if (celula && celula.status !== 'Cancelada') {
          totais[mes].vendas += celula.valorVenda || 0;
          totais[mes].comissoes += celula.comissaoGerada || 0;
          totalGeralComissoes += celula.comissaoGerada || 0;
        }
      });
    });

    return {
      mensais: totais,
      totalGeralVendas,
      totalGeralComissoes
    };
  };

  const totaisGerais = useMemo(() => calcularTotaisMensais(), [vendas, mesesFiltrados]);

  return (
    <Box>
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: { xs: 'stretch', md: 'center' },
          flexDirection: { xs: 'column', md: 'row' },
          gap: 2,
          mb: 3
        }}
      >
        <Box>
          <Typography
            variant="h5"
            sx={{ fontWeight: 700, fontFamily: 'Outfit, sans-serif', color: theme.palette.mode === 'dark' ? '#f8fafc' : '#0f172a' }}
          >
            Painel e Timeline de Vendas
          </Typography>
          <Typography variant="body2" sx={{ color: theme.palette.mode === 'dark' ? '#94a3b8' : '#64748b' }}>
            Lance vendas e acompanhe a projeção mensal de faturamento. Os cálculos de comissões e totais são em tempo real.
          </Typography>
        </Box>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 2,
            background: theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.02)' : 'rgba(0,0,0,0.01)',
            p: 1,
            borderRadius: 2,
            border: `1px solid ${theme.palette.mode === 'dark' ? '#334155' : '#e2e8f0'}`
          }}
        >
          <TextField
            label="De"
            type="date"
            size="small"
            value={dataInicio}
            onChange={(e) => setDataInicio(e.target.value)}
            slotProps={{ inputLabel: { shrink: true } }}
            sx={{ width: 140 }}
          />
          <TextField
            label="Até"
            type="date"
            size="small"
            value={dataFim}
            onChange={(e) => setDataFim(e.target.value)}
            slotProps={{ inputLabel: { shrink: true } }}
            sx={{ width: 140 }}
          />
          {permissoes.editarVendas && (
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
              Nova Venda
            </Button>
          )}
        </Box>
      </Box>

      {/* Tabela Timeline Horizontal */}
      <TableContainer
        component={Paper}
        elevation={0}
        sx={{
          borderRadius: 4,
          border: `1px solid ${theme.palette.mode === 'dark' ? '#334155' : '#e2e8f0'}`,
          background: theme.palette.mode === 'dark' ? '#1e293b' : '#ffffff',
          overflowX: 'auto',
          maxWidth: '100%'
        }}
      >
        <Table size="small" sx={{ minWidth: 1800, borderCollapse: 'collapse' }}>
          <TableHead sx={{ background: theme.palette.mode === 'dark' ? '#0f172a' : '#f8fafc' }}>
            <TableRow>
              <TableCell
                rowSpan={2}
                sx={{
                  fontWeight: 700,
                  color: theme.palette.mode === 'dark' ? '#cbd5e1' : '#475569',
                  borderBottom: `2px solid ${theme.palette.mode === 'dark' ? '#334155' : '#cbd5e1'}`,
                  minWidth: 220,
                  position: 'sticky',
                  left: 0,
                  background: theme.palette.mode === 'dark' ? '#0f172a' : '#f8fafc',
                  zIndex: 4
                }}
              >
                Cliente / Projeto
              </TableCell>
              <TableCell
                rowSpan={2}
                sx={{
                  fontWeight: 700,
                  color: theme.palette.mode === 'dark' ? '#cbd5e1' : '#475569',
                  borderBottom: `2px solid ${theme.palette.mode === 'dark' ? '#334155' : '#cbd5e1'}`,
                  minWidth: 130,
                  position: 'sticky',
                  left: 220,
                  background: theme.palette.mode === 'dark' ? '#0f172a' : '#f8fafc',
                  zIndex: 4
                }}
              >
                Regra Aplicada
              </TableCell>
              <TableCell
                rowSpan={2}
                align="center"
                sx={{
                  fontWeight: 700,
                  color: theme.palette.mode === 'dark' ? '#cbd5e1' : '#475569',
                  borderBottom: `2px solid ${theme.palette.mode === 'dark' ? '#334155' : '#cbd5e1'}`,
                  minWidth: 70,
                  position: 'sticky',
                  left: 350,
                  background: theme.palette.mode === 'dark' ? '#0f172a' : '#f8fafc',
                  zIndex: 4
                }}
              >
                % Comis.
              </TableCell>

              {/* Meses Filtrados */}
              {mesesFiltrados.map((mes) => (
                <TableCell
                  key={mes}
                  colSpan={2}
                  align="center"
                  sx={{
                    fontWeight: 700,
                    textTransform: 'capitalize',
                    borderBottom: `1px solid ${theme.palette.mode === 'dark' ? '#334155' : '#e2e8f0'}`,
                    borderLeft: `1px solid ${theme.palette.mode === 'dark' ? '#334155' : '#e2e8f0'}`,
                    color: theme.palette.mode === 'dark' ? '#e2e8f0' : '#334155',
                    bgcolor: theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.01)' : 'rgba(0, 0, 0, 0.005)'
                  }}
                >
                  {formatarChaveMesExibicao(mes)}
                </TableCell>
              ))}

              <TableCell
                rowSpan={2}
                align="right"
                sx={{
                  fontWeight: 700,
                  color: theme.palette.mode === 'dark' ? '#cbd5e1' : '#475569',
                  borderBottom: `2px solid ${theme.palette.mode === 'dark' ? '#334155' : '#cbd5e1'}`,
                  borderLeft: `2px solid ${theme.palette.mode === 'dark' ? '#475569' : '#cbd5e1'}`,
                  minWidth: 140,
                  bgcolor: theme.palette.mode === 'dark' ? 'rgba(99, 102, 241, 0.05)' : 'rgba(99, 102, 241, 0.02)'
                }}
              >
                Total Vendas
              </TableCell>
              <TableCell
                rowSpan={2}
                align="right"
                sx={{
                  fontWeight: 700,
                  color: theme.palette.mode === 'dark' ? '#cbd5e1' : '#475569',
                  borderBottom: `2px solid ${theme.palette.mode === 'dark' ? '#334155' : '#cbd5e1'}`,
                  minWidth: 140,
                  bgcolor: theme.palette.mode === 'dark' ? 'rgba(16, 185, 129, 0.05)' : 'rgba(16, 185, 129, 0.02)'
                }}
              >
                Total Comissões
              </TableCell>
              {permissoes.editarVendas && (
                <TableCell
                  rowSpan={2}
                  align="center"
                  sx={{
                    fontWeight: 700,
                    color: theme.palette.mode === 'dark' ? '#cbd5e1' : '#475569',
                    borderBottom: `2px solid ${theme.palette.mode === 'dark' ? '#334155' : '#cbd5e1'}`,
                    minWidth: 80
                  }}
                >
                  Ações
                </TableCell>
              )}
            </TableRow>

            {/* Segunda linha do cabeçalho */}
            <TableRow>
              {mesesFiltrados.map((mes) => (
                <React.Fragment key={`sub-${mes}`}>
                  <TableCell
                    align="right"
                    sx={{
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      color: theme.palette.mode === 'dark' ? '#94a3b8' : '#64748b',
                      borderBottom: `2px solid ${theme.palette.mode === 'dark' ? '#334155' : '#cbd5e1'}`,
                      borderLeft: `1px solid ${theme.palette.mode === 'dark' ? '#334155' : '#e2e8f0'}`,
                      minWidth: 85
                    }}
                  >
                    Venda
                  </TableCell>
                  <TableCell
                    align="right"
                    sx={{
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      color: theme.palette.success.main,
                      borderBottom: `2px solid ${theme.palette.mode === 'dark' ? '#334155' : '#cbd5e1'}`,
                      minWidth: 110
                    }}
                  >
                    Comissão
                  </TableCell>
                </React.Fragment>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {vendas.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6 + mesesFiltrados.length * 2} align="center" sx={{ py: 6 }}>
                  <Typography variant="body1" sx={{ color: theme.palette.mode === 'dark' ? '#64748b' : '#94a3b8' }}>
                    Nenhuma venda lançada. Clique em "Nova Venda" para cadastrar seu primeiro cliente.
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              vendas.map((venda) => (
                <TableRow
                  key={venda.id}
                  sx={{
                    '&:hover': {
                      background: theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.02)' : 'rgba(0, 0, 0, 0.01)'
                    },
                    opacity: venda.statusCliente === 'Cancelado' ? 0.65 : 1,
                    transition: 'background 0.2s, opacity 0.2s',
                    borderBottom: `1px solid ${theme.palette.mode === 'dark' ? '#334155' : '#e2e8f0'}`
                  }}
                >
                  {/* Nome do Cliente e Vendedor com Sticky */}
                  <TableCell
                    sx={{
                      fontWeight: 600,
                      color: theme.palette.mode === 'dark' ? '#f1f5f9' : '#1e293b',
                      position: 'sticky',
                      left: 0,
                      background: theme.palette.mode === 'dark' ? '#1e293b' : '#ffffff',
                      zIndex: 1,
                      borderRight: `1px solid ${theme.palette.mode === 'dark' ? '#334155' : '#e2e8f0'}`
                    }}
                  >
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <span style={{ textDecoration: venda.statusCliente === 'Cancelado' ? 'line-through' : 'none' }}>
                          {venda.cliente}
                        </span>
                        <Box
                          component="span"
                          sx={{
                            fontSize: '0.6rem',
                            fontWeight: 700,
                            px: 0.6,
                            py: 0.2,
                            borderRadius: 0.5,
                            backgroundColor: venda.statusCliente === 'Cancelado' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                            color: venda.statusCliente === 'Cancelado' ? '#ef4444' : '#10b981',
                            textTransform: 'uppercase'
                          }}
                        >
                          {venda.statusCliente}
                        </Box>
                      </Box>
                      {venda.vendedorNome && (
                        <Typography
                          variant="caption"
                          sx={{
                            color: theme.palette.primary.main,
                            fontWeight: 600,
                            fontSize: '0.72rem',
                            display: 'block'
                          }}
                        >
                          Vend: {venda.vendedorNome}
                        </Typography>
                      )}
                      {venda.dataSegundaParcela && (
                        <Typography
                          variant="caption"
                          sx={{
                            color: theme.palette.mode === 'dark' ? '#94a3b8' : '#64748b',
                            fontSize: '0.68rem',
                            fontWeight: 500,
                            display: 'block',
                            mt: 0.1
                          }}
                        >
                          2ª Parc: {venda.dataSegundaParcela.split('-').reverse().join('/')}
                        </Typography>
                      )}
                      <Typography variant="caption" sx={{ color: '#94a3b8', fontWeight: 400, display: 'block', mt: 0.1 }}>
                        {venda.segmento}
                      </Typography>
                    </Box>
                  </TableCell>

                  {/* Tabela e Parcelas - Congelada */}
                  <TableCell
                    sx={{
                      color: theme.palette.mode === 'dark' ? '#cbd5e1' : '#475569',
                      fontSize: '0.8rem',
                      position: 'sticky',
                      left: 220,
                      background: theme.palette.mode === 'dark' ? '#1e293b' : '#ffffff',
                      zIndex: 2,
                      borderRight: `1px solid ${theme.palette.mode === 'dark' ? '#334155' : '#e2e8f0'}`
                    }}
                  >
                    {venda.tabela}
                    <Typography variant="caption" sx={{ display: 'block', color: '#64748b' }}>
                      {venda.qtdParcelas} parcelas
                    </Typography>
                  </TableCell>

                  {/* Percentual comissão - Congelada */}
                  <TableCell
                    align="center"
                    sx={{
                      fontWeight: 600,
                      color: theme.palette.primary.main,
                      position: 'sticky',
                      left: 350,
                      background: theme.palette.mode === 'dark' ? '#1e293b' : '#ffffff',
                      zIndex: 2,
                      borderRight: `2px solid ${theme.palette.mode === 'dark' ? '#475569' : '#cbd5e1'}`
                    }}
                  >
                    {venda.percentualComissao.toFixed(1).replace('.', ',')}%
                  </TableCell>

                  {/* Colunas mensais (Venda editável e Comissão calculada) */}
                  {mesesFiltrados.map((mes) => {
                    const dadosMes = venda.projecaoMensal[mes] || {
                      valorVenda: 0,
                      comissaoGerada: 0,
                      status: 'A vencer' as StatusParcela,
                      dataVencimento: `${mes}-15`
                    };
                    const pctMensal = (venda.percentualComissao / venda.qtdParcelas).toFixed(2).replace('.', ',');
                    return (
                      <React.Fragment key={`${venda.id}-${mes}`}>
                        {/* Venda - Campo Editável Click-to-Edit */}
                        <TableCell
                          align="right"
                          sx={{
                            borderLeft: `1px solid ${theme.palette.mode === 'dark' ? '#334155' : '#e2e8f0'}`,
                            p: 0.5,
                            bgcolor: dadosMes.status === 'Cancelada' 
                              ? 'rgba(239, 68, 68, 0.02)' 
                              : (dadosMes.valorVenda === 0 
                                ? (theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.015)' : 'rgba(0, 0, 0, 0.01)')
                                : 'inherit'),
                            opacity: dadosMes.valorVenda === 0 ? 0.35 : 1
                          }}
                        >
                          {editingCell?.vendaId === venda.id && editingCell?.mes === mes ? (
                            <TextField
                              variant="standard"
                              type="number"
                              autoFocus
                              value={dadosMes.valorVenda === 0 ? '' : dadosMes.valorVenda}
                              onChange={(e) => {
                                const val = e.target.value === '' ? 0 : parseFloat(e.target.value);
                                handleAlterarValorMensal(venda.id, mes, val);
                              }}
                              onBlur={() => setEditingCell(null)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  setEditingCell(null);
                                }
                              }}
                              placeholder="0"
                              slotProps={{
                                input: {
                                  disableUnderline: true,
                                  style: {
                                    textAlign: 'right',
                                    fontSize: '0.85rem',
                                    fontWeight: 500,
                                    fontFamily: 'Outfit, sans-serif'
                                  }
                                },
                                htmlInput: {
                                  style: {
                                    textAlign: 'right',
                                    paddingRight: '4px'
                                  }
                                }
                              }}
                              sx={{
                                width: '100%',
                                '& .MuiInputBase-input': {
                                  py: 0.5,
                                  px: 0.5,
                                  borderRadius: 1,
                                  transition: 'background 0.2s',
                                  background: theme.palette.mode === 'dark' ? '#0f172a' : '#f1f5f9',
                                  outline: `1px solid ${theme.palette.primary.main}`
                                }
                              }}
                            />
                          ) : (
                            <Box
                              onClick={() => permissoes.editarVendas && setEditingCell({ vendaId: venda.id, mes })}
                              sx={{
                                cursor: permissoes.editarVendas ? 'pointer' : 'default',
                                fontSize: '0.85rem',
                                fontWeight: 500,
                                fontFamily: 'Outfit, sans-serif',
                                textAlign: 'right',
                                py: 0.5,
                                px: 1,
                                borderRadius: 1,
                                minHeight: '38px',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'flex-end',
                                justifyContent: 'center',
                                transition: 'background 0.2s',
                                textDecoration: dadosMes.status === 'Cancelada' ? 'line-through' : 'none',
                                color: dadosMes.status === 'Cancelada' ? '#ef4444' : (dadosMes.valorVenda > 0 ? (theme.palette.mode === 'dark' ? '#f1f5f9' : '#1e293b') : '#94a3b8'),
                                '&:hover': permissoes.editarVendas ? {
                                  background: theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)'
                                } : {}
                              }}
                            >
                              {dadosMes.valorVenda > 0 ? (
                                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                                  <span style={{ fontWeight: 650 }}>{formatarMoeda(dadosMes.valorVenda)}</span>
                                  <Typography
                                    variant="caption"
                                    sx={{
                                      fontSize: '0.68rem',
                                      color: theme.palette.mode === 'dark' ? '#94a3b8' : '#64748b',
                                      fontWeight: 500,
                                      mt: 0.1
                                    }}
                                  >
                                    Parc: {formatarMoeda(dadosMes.valorParcela || (venda.valorParcela || 0))}
                                  </Typography>
                                </Box>
                              ) : ''}
                              {dadosMes.valorVenda > 0 && dadosMes.status !== 'Cancelada' && (
                                <Box
                                  component="span"
                                  sx={{
                                    fontSize: '0.58rem',
                                    fontWeight: 700,
                                    px: 0.5,
                                    py: 0.1,
                                    borderRadius: 0.4,
                                    backgroundColor: mes === venda.mesInicio 
                                      ? 'rgba(99, 102, 241, 0.15)' 
                                      : (theme.palette.mode === 'dark' ? 'rgba(234, 179, 8, 0.18)' : 'rgba(234, 179, 8, 0.12)'),
                                    color: mes === venda.mesInicio 
                                      ? '#818cf8' 
                                      : (theme.palette.mode === 'dark' ? '#facc15' : '#b45309'),
                                    textTransform: 'uppercase',
                                    mt: 0.2,
                                    display: 'inline-block',
                                    lineHeight: 1
                                  }}
                                >
                                  {mes === venda.mesInicio 
                                    ? `Venda (${obterNumeroParcela(venda, mes)})` 
                                    : `Recor. (${obterNumeroParcela(venda, mes)})`}
                                </Box>
                              )}
                            </Box>
                          )}
                        </TableCell>

                        {/* Comissão Gerada - Apresenta o Valor, % do Mês, Seletor de Status e Botão de Cancelar */}
                        <TableCell
                          align="right"
                          sx={{
                            fontSize: '0.8rem',
                            fontWeight: 600,
                            borderRight: `1px solid ${theme.palette.mode === 'dark' ? '#334155' : '#e2e8f0'}`,
                            color: dadosMes.status === 'Cancelada' ? '#ef4444' : (dadosMes.comissaoGerada > 0 ? theme.palette.success.main : theme.palette.mode === 'dark' ? '#475569' : '#cbd5e1'),
                            bgcolor: dadosMes.status === 'Cancelada' 
                              ? 'rgba(239, 68, 68, 0.02)' 
                              : (dadosMes.valorVenda === 0 
                                ? (theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.015)' : 'rgba(0, 0, 0, 0.01)')
                                : 'inherit'),
                            opacity: dadosMes.valorVenda === 0 ? 0.35 : 1,
                            p: 0.5
                          }}
                        >
                          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 0.5 }}>
                            {dadosMes.comissaoGerada > 0 ? (
                              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', whiteSpace: 'nowrap' }}>
                                <span style={{ textDecoration: dadosMes.status === 'Cancelada' ? 'line-through' : 'none' }}>
                                  {formatarMoeda(dadosMes.comissaoGerada)}
                                </span>
                                <Typography
                                  component="span"
                                  sx={{
                                    fontSize: '0.65rem',
                                    color: dadosMes.status === 'Cancelada' ? '#ef4444' : (theme.palette.mode === 'dark' ? '#64748b' : '#94a3b8'),
                                    ml: 0.5,
                                    fontWeight: 500
                                  }}
                                >
                                  ({pctMensal}%)
                                </Typography>
                              </Box>
                            ) : ''}
                            
                            {/* Controle de Status da Parcela e Ação de Cancelar - Apenas exibidos se houver parcela ativa faturada no mês */}
                            {dadosMes.valorVenda > 0 && (
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                  {permissoes.editarVendas ? (
                                    <Select
                                      value={dadosMes.status}
                                      onChange={(e) => handleAlterarStatusParcela(venda.id, mes, e.target.value as StatusParcela)}
                                      variant="standard"
                                      disableUnderline
                                      sx={{
                                        fontSize: '0.62rem',
                                        fontWeight: 700,
                                        color: dadosMes.status === 'Cancelada' ? '#ef4444' :
                                               dadosMes.status === 'Recebida' ? '#818cf8' :
                                               dadosMes.status === 'Paga' ? '#34d399' :
                                               dadosMes.status === 'Vendida' ? '#38bdf8' : '#94a3b8',
                                        '& .MuiSelect-select': {
                                          py: 0.1,
                                          px: 0.5,
                                          borderRadius: 0.5,
                                          background: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)'
                                        }
                                      }}
                                    >
                                      <MenuItem value="A vencer" sx={{ fontSize: '0.7rem' }}>A vencer</MenuItem>
                                      <MenuItem value="Vendida" sx={{ fontSize: '0.7rem' }}>Vendida</MenuItem>
                                      <MenuItem value="Paga" sx={{ fontSize: '0.7rem' }}>Paga</MenuItem>
                                      <MenuItem value="Recebida" sx={{ fontSize: '0.7rem' }}>Recebida</MenuItem>
                                      <MenuItem value="Cancelada" sx={{ fontSize: '0.7rem' }}>Cancelada</MenuItem>
                                    </Select>
                                  ) : (
                                    <Box
                                      sx={{
                                        fontSize: '0.62rem',
                                        fontWeight: 700,
                                        py: 0.1,
                                        px: 0.5,
                                        borderRadius: 0.5,
                                        color: dadosMes.status === 'Cancelada' ? '#ef4444' :
                                               dadosMes.status === 'Recebida' ? '#818cf8' :
                                               dadosMes.status === 'Paga' ? '#34d399' :
                                               dadosMes.status === 'Vendida' ? '#38bdf8' : '#94a3b8',
                                        background: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
                                        display: 'inline-block'
                                      }}
                                    >
                                      {dadosMes.status}
                                    </Box>
                                  )}

                                  {permissoes.editarVendas && dadosMes.status !== 'Cancelada' && (
                                    <IconButton
                                      size="small"
                                      onClick={() => handleCancelarAPartirDoMes(venda.id, mes)}
                                      sx={{
                                        p: 0.1,
                                        color: theme.palette.error.main,
                                        '&:hover': {
                                          background: 'rgba(239, 68, 68, 0.15)'
                                        }
                                      }}
                                      title="Cancelar esta e as demais parcelas"
                                    >
                                      <BlockIcon sx={{ fontSize: 10 }} />
                                    </IconButton>
                                  )}
                              </Box>
                            )}
                          </Box>
                        </TableCell>
                      </React.Fragment>
                    );
                  })}

                  {/* Totais Consolidados por Linha Filtrados */}
                  {(() => {
                    const { totalVendasPeriodo, totalComissoesPeriodo } = obterTotaisFiltrados(venda);
                    return (
                      <React.Fragment>
                        <TableCell
                          align="right"
                          sx={{
                            fontWeight: 700,
                            color: theme.palette.mode === 'dark' ? '#f8fafc' : '#0f172a',
                            borderLeft: `2px solid ${theme.palette.mode === 'dark' ? '#334155' : '#cbd5e1'}`,
                            bgcolor: theme.palette.mode === 'dark' ? 'rgba(99, 102, 241, 0.05)' : 'rgba(99, 102, 241, 0.02)'
                          }}
                        >
                          {formatarMoeda(totalVendasPeriodo)}
                        </TableCell>
                        <TableCell
                          align="right"
                          sx={{
                            fontWeight: 700,
                            color: theme.palette.success.main,
                            bgcolor: theme.palette.mode === 'dark' ? 'rgba(16, 185, 129, 0.05)' : 'rgba(16, 185, 129, 0.02)'
                          }}
                        >
                          {formatarMoeda(totalComissoesPeriodo)}
                        </TableCell>
                      </React.Fragment>
                    );
                  })()}

                  {/* Ação de Excluir */}
                  {permissoes.editarVendas && (
                    <TableCell align="center">
                      <IconButton
                        color="error"
                        onClick={() => onExcluirVenda(venda.id)}
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

            {/* Linha de Totais Consolidados do Rodapé */}
            {vendas.length > 0 && (
              <TableRow sx={{ bgcolor: theme.palette.mode === 'dark' ? '#0f172a' : '#f8fafc', fontWeight: 'bold' }}>
                <TableCell
                  sx={{
                    fontWeight: 750,
                    color: theme.palette.mode === 'dark' ? '#f8fafc' : '#0f172a',
                    position: 'sticky',
                    left: 0,
                    background: theme.palette.mode === 'dark' ? '#0f172a' : '#f8fafc',
                    zIndex: 2,
                    borderRight: `1px solid ${theme.palette.mode === 'dark' ? '#334155' : '#e2e8f0'}`,
                    borderTop: `2px solid ${theme.palette.mode === 'dark' ? '#475569' : '#cbd5e1'}`
                  }}
                >
                  TOTAL CONSOLIDADO
                </TableCell>
                <TableCell
                  sx={{
                    borderTop: `2px solid ${theme.palette.mode === 'dark' ? '#475569' : '#cbd5e1'}`,
                    position: 'sticky',
                    left: 220,
                    background: theme.palette.mode === 'dark' ? '#0f172a' : '#f8fafc',
                    zIndex: 2,
                    borderRight: `1px solid ${theme.palette.mode === 'dark' ? '#334155' : '#e2e8f0'}`
                  }}
                />
                <TableCell
                  sx={{
                    borderTop: `2px solid ${theme.palette.mode === 'dark' ? '#475569' : '#cbd5e1'}`,
                    position: 'sticky',
                    left: 350,
                    background: theme.palette.mode === 'dark' ? '#0f172a' : '#f8fafc',
                    zIndex: 2,
                    borderRight: `2px solid ${theme.palette.mode === 'dark' ? '#475569' : '#cbd5e1'}`
                  }}
                />

                {mesesFiltrados.map((mes) => {
                  const mVal = totaisGerais.mensais[mes];
                  return (
                    <React.Fragment key={`total-${mes}`}>
                      {/* Vendas do Mês */}
                      <TableCell
                        align="right"
                        sx={{
                          fontWeight: 700,
                          color: theme.palette.mode === 'dark' ? '#f8fafc' : '#0f172a',
                          borderTop: `2px solid ${theme.palette.mode === 'dark' ? '#475569' : '#cbd5e1'}`,
                          borderLeft: `1px solid ${theme.palette.mode === 'dark' ? '#334155' : '#e2e8f0'}`,
                          fontSize: '0.8rem'
                        }}
                      >
                        {formatarMoeda(mVal.vendas)}
                      </TableCell>
                      {/* Comissões do Mês */}
                      <TableCell
                        align="right"
                        sx={{
                          fontWeight: 700,
                          color: theme.palette.success.main,
                          borderTop: `2px solid ${theme.palette.mode === 'dark' ? '#475569' : '#cbd5e1'}`,
                          fontSize: '0.8rem'
                        }}
                      >
                        {formatarMoeda(mVal.comissoes)}
                      </TableCell>
                    </React.Fragment>
                  );
                })}

                {/* Totais Gerais Globais */}
                <TableCell
                  align="right"
                  sx={{
                    fontWeight: 800,
                    color: theme.palette.mode === 'dark' ? '#f8fafc' : '#0f172a',
                    borderTop: `2px solid ${theme.palette.mode === 'dark' ? '#475569' : '#cbd5e1'}`,
                    borderLeft: `2px solid ${theme.palette.mode === 'dark' ? '#475569' : '#cbd5e1'}`,
                    bgcolor: theme.palette.mode === 'dark' ? 'rgba(99, 102, 241, 0.15)' : 'rgba(99, 102, 241, 0.05)',
                    fontSize: '0.85rem'
                  }}
                >
                  {formatarMoeda(totaisGerais.totalGeralVendas)}
                </TableCell>
                <TableCell
                  align="right"
                  sx={{
                    fontWeight: 800,
                    color: theme.palette.success.main,
                    borderTop: `2px solid ${theme.palette.mode === 'dark' ? '#475569' : '#cbd5e1'}`,
                    bgcolor: theme.palette.mode === 'dark' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(16, 185, 129, 0.05)',
                    fontSize: '0.85rem'
                  }}
                >
                  {formatarMoeda(totaisGerais.totalGeralComissoes)}
                </TableCell>
                {permissoes.editarVendas && (
                  <TableCell sx={{ borderTop: `2px solid ${theme.palette.mode === 'dark' ? '#475569' : '#cbd5e1'}` }} />
                )}
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Dialog para Nova Venda */}
      <Dialog
        open={openDialog}
        onClose={handleCloseDialog}
        maxWidth="md"
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
          Nova Venda
          <IconButton onClick={handleCloseDialog} size="small">
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={3} sx={{ mt: 0.5 }}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                label="Cliente / Projeto"
                placeholder="Ex: Condomínio Jardim Real"
                value={cliente}
                onChange={(e) => setCliente(e.target.value)}
                error={!!errors.cliente}
                helperText={errors.cliente}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <FormControl fullWidth error={!!errors.vendedorId}>
                <InputLabel id="vend-venda-label">Vendedor Responsável</InputLabel>
                <Select
                  labelId="vend-venda-label"
                  value={vendedorId}
                  label="Vendedor Responsável"
                  onChange={(e) => setVendedorId(e.target.value)}
                >
                  {vendedores.map((v) => (
                    <MenuItem key={v.id} value={v.id}>
                      {v.nome}
                    </MenuItem>
                  ))}
                </Select>
                {errors.vendedorId && (
                  <Typography variant="caption" color="error" sx={{ mt: 0.5 }}>
                    {errors.vendedorId}
                  </Typography>
                )}
              </FormControl>
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                label="Valor do Crédito"
                type="number"
                placeholder="Ex: 1200000"
                value={valorVendaInput}
                onChange={(e) => {
                  const val = e.target.value === '' ? '' : Math.max(0, parseFloat(e.target.value));
                  setValorVendaInput(val);
                }}
                error={!!errors.valorVendaInput}
                helperText={errors.valorVendaInput}
                slotProps={{
                  input: {
                    startAdornment: <InputAdornment position="start">R$</InputAdornment>
                  }
                }}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                label="Valor da Parcela"
                type="number"
                placeholder="Ex: 10000"
                value={valorParcelaInput}
                onChange={(e) => {
                  const val = e.target.value === '' ? '' : Math.max(0, parseFloat(e.target.value));
                  setValorParcelaInput(val);
                }}
                error={!!errors.valorParcelaInput}
                helperText={errors.valorParcelaInput}
                slotProps={{
                  input: {
                    startAdornment: <InputAdornment position="start">R$</InputAdornment>
                  }
                }}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                label="Data da Venda"
                type="date"
                value={dataVendaInput}
                onChange={(e) => setDataVendaInput(e.target.value)}
                slotProps={{ inputLabel: { shrink: true } }}
                error={!!errors.dataVendaInput}
                helperText={errors.dataVendaInput}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                label="Vencimento da 2ª Parcela"
                type="date"
                value={dataSegundaParcelaInput}
                onChange={(e) => setDataSegundaParcelaInput(e.target.value)}
                slotProps={{ inputLabel: { shrink: true } }}
                error={!!errors.dataSegundaParcelaInput}
                helperText={errors.dataSegundaParcelaInput}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <FormControl fullWidth error={!!errors.segmento}>
                <InputLabel id="seg-venda-label">Segmento</InputLabel>
                <Select
                  labelId="seg-venda-label"
                  value={segmento}
                  label="Segmento"
                  onChange={(e) => setSegmento(e.target.value as SegmentoType)}
                >
                  <MenuItem value="Imóveis">Imóveis</MenuItem>
                  <MenuItem value="Autos Leves">Autos Leves</MenuItem>
                  <MenuItem value="Pesados">Pesados</MenuItem>
                </Select>
                {errors.segmento && (
                  <Typography variant="caption" color="error" sx={{ mt: 0.5 }}>
                    {errors.segmento}
                  </Typography>
                )}
              </FormControl>
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <FormControl fullWidth error={!!errors.tabela} disabled={!segmento}>
                <InputLabel id="tab-venda-label">Tabela</InputLabel>
                <Select
                  labelId="tab-venda-label"
                  value={tabela}
                  label="Tabela"
                  onChange={(e) => setTabela(e.target.value)}
                >
                  {tabelasDisponiveis.map((tab) => (
                    <MenuItem key={tab} value={tab}>
                      {tab}
                    </MenuItem>
                  ))}
                </Select>
                {errors.tabela && (
                  <Typography variant="caption" color="error" sx={{ mt: 0.5 }}>
                    {errors.tabela}
                  </Typography>
                )}
              </FormControl>
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <FormControl fullWidth error={!!errors.qtdParcelas} disabled={!tabela}>
                <InputLabel id="parc-venda-label">Prazo (Parcelas)</InputLabel>
                <Select
                  labelId="parc-venda-label"
                  value={qtdParcelas}
                  label="Prazo (Parcelas)"
                  onChange={(e) => setQtdParcelas(Number(e.target.value))}
                >
                  {parcelasDisponiveis.map((parc) => (
                    <MenuItem key={parc} value={parc}>
                      {parc}x
                    </MenuItem>
                  ))}
                </Select>
                {errors.qtdParcelas && (
                  <Typography variant="caption" color="error" sx={{ mt: 0.5 }}>
                    {errors.qtdParcelas}
                  </Typography>
                )}
              </FormControl>
            </Grid>

            {/* Informações da comissão buscada */}
            {segmento && tabela && qtdParcelas !== '' && (
              <Grid size={{ xs: 12 }}>
                <Alert
                  severity={percentualComissao > 0 ? 'success' : 'warning'}
                  icon={<PercentIcon />}
                  sx={{ borderRadius: 3 }}
                >
                  {percentualComissao > 0 ? (
                    <span>
                      Regra localizada! Comissão automática de <strong>{percentualComissao.toFixed(2).replace('.', ',')}%</strong> definida para esta venda.
                    </span>
                  ) : (
                    <span>Não foi localizada nenhuma comissão para essa combinação no BD Master.</span>
                  )}
                </Alert>
              </Grid>
            )}
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
            onClick={handleSalvarVenda}
            disabled={!cliente || !vendedorId || !segmento || !tabela || qtdParcelas === '' || valorVendaInput === '' || valorParcelaInput === '' || !dataVendaInput || !dataSegundaParcelaInput}
            sx={{
              borderRadius: 2,
              textTransform: 'none',
              fontWeight: 600,
              boxShadow: '0 4px 10px rgba(99, 102, 241, 0.2)'
            }}
          >
            Lançar Venda
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
