import React, { useMemo, useState } from 'react';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  Avatar,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  useTheme,
  Tooltip
} from '@mui/material';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import MonetizationOnIcon from '@mui/icons-material/MonetizationOn';
import PeopleIcon from '@mui/icons-material/People';
import HistoryIcon from '@mui/icons-material/History';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import CancelIcon from '@mui/icons-material/Cancel';
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as ChartTooltip,
  Legend
} from 'recharts';
import { type LancamentoVenda, type Vendedor } from '../types';
import { formatarMoeda, formatarMoedaEixo, formatarChaveMesExibicao, obterStatusEfetivo } from '../utils/formatters';

interface RelatorioRetencaoLTVProps {
  vendas: LancamentoVenda[];
  vendedores: Vendedor[];
  dataInicio: string; // formato YYYY-MM-DD
  dataFim: string; // formato YYYY-MM-DD
}

type CategoriaRetencao = 'Ativa em Dia' | 'Em Atraso' | 'Cancelada';

interface DadosClienteLTV {
  vendaId: string;
  cliente: string;
  pac?: string;
  vendedorNome: string;
  dataVenda: string;
  statusCliente: string;
  categoriaRetencao: CategoriaRetencao;
  valorCota: number;
  ltvRealizado: number;
  valorVendaCancelada: number;
  parcelasPagasNomes: string[];
  parcelasVencidasNomes: string[];
  totalParcelasContrato: number;
  mesCancelamento: string | null;
}

export const RelatorioRetencaoLTV: React.FC<RelatorioRetencaoLTVProps> = ({
  vendas,
  vendedores,
  dataInicio,
  dataFim
}) => {
  const theme = useTheme();
  const [filtroTabela, setFiltroTabela] = useState<'Todas' | CategoriaRetencao>('Todas');

  // Processamento e cálculo de LTV / Retenção por Quantidade e por Valor de Cota (VGV)
  const { kpis, listaClientes } = useMemo(() => {
    let totalClientes = 0;
    let cotasAtivasEmDia = 0;
    let cotasEmAtraso = 0;
    let clientesCancelados = 0;

    let valorTotalCotas = 0;
    let valorCotasAtivasEmDia = 0;
    let valorCotasEmAtraso = 0;
    let valorCotasCanceladas = 0;

    let somaLtvRealizadoGeral = 0;

    const lista: DadosClienteLTV[] = [];

    vendas.forEach(v => {
      const dataDaVenda = v.dataVenda || (v.mesInicio ? `${v.mesInicio}-01` : '');
      if (dataDaVenda && dataDaVenda >= dataInicio && dataDaVenda <= dataFim) {
        totalClientes++;
        const valorCota = Number(v.valorVenda) || 0;
        valorTotalCotas += valorCota;
        
        let ltvDesteCliente = 0;
        const parcelasPagas: string[] = [];
        const parcelasVencidas: string[] = [];
        let mesCancelamentoEncontrado: string | null = null;
        
        // Filtra apenas os meses com parcela real da venda (valorVenda > 0) para numerar e checar vencimento corretamente
        const todosMeses = Object.keys(v.projecaoMensal || {}).sort();
        const mesesVigentes = todosMeses.filter(
          m => /^\d{4}-\d{2}$/.test(m) && (v.projecaoMensal[m]?.valorVenda || 0) > 0
        );

        // Verifica cancelamento em qualquer célula da projeção
        todosMeses.forEach((mesChave) => {
          const celula = v.projecaoMensal[mesChave];
          if (celula && ['Cancelada', 'Estornada'].includes(celula.status) && !mesCancelamentoEncontrado) {
            mesCancelamentoEncontrado = mesChave;
          }
        });

        mesesVigentes.forEach((mesChave, index) => {
          const celula = v.projecaoMensal[mesChave];
          const dtVenc = celula.dataVencimento || `${mesChave}-15`;
          const statusEfetivo = obterStatusEfetivo(celula.status, dtVenc);
          
          if (statusEfetivo === 'Paga') {
            ltvDesteCliente += (celula.comissaoGerada || 0);
            parcelasPagas.push(`${index + 1}ª`);
          } else if (statusEfetivo === 'Vencida') {
            parcelasVencidas.push(`${index + 1}ª (${formatarChaveMesExibicao(mesChave)})`);
          }
        });

        const cancelou = v.statusCliente?.toLowerCase() === 'cancelado' || mesCancelamentoEncontrado !== null;
        const emAtraso = !cancelou && parcelasVencidas.length > 0;

        let categoriaRetencao: CategoriaRetencao = 'Ativa em Dia';
        if (cancelou) {
          categoriaRetencao = 'Cancelada';
          clientesCancelados++;
          valorCotasCanceladas += valorCota;
        } else if (emAtraso) {
          categoriaRetencao = 'Em Atraso';
          cotasEmAtraso++;
          valorCotasEmAtraso += valorCota;
        } else {
          categoriaRetencao = 'Ativa em Dia';
          cotasAtivasEmDia++;
          valorCotasAtivasEmDia += valorCota;
        }

        somaLtvRealizadoGeral += ltvDesteCliente;

        const vendedorNome = v.vendedorNome || vendedores.find(vend => vend.id === v.vendedorId)?.nome || 'Sem Vendedor';

        lista.push({
          vendaId: v.id,
          cliente: v.cliente,
          pac: v.pac,
          vendedorNome,
          dataVenda: dataDaVenda,
          statusCliente: cancelou ? 'Cancelado' : 'Ativo',
          categoriaRetencao,
          valorCota,
          ltvRealizado: ltvDesteCliente,
          valorVendaCancelada: cancelou ? valorCota : 0,
          parcelasPagasNomes: parcelasPagas,
          parcelasVencidasNomes: parcelasVencidas,
          totalParcelasContrato: mesesVigentes.length || v.qtdParcelas || 0,
          mesCancelamento: mesCancelamentoEncontrado || (cancelou ? 'Indefinido' : null)
        });
      }
    });

    // % de Retenção (Apenas Cotas Ativas em Dia / Total de Cotas)
    const taxaRetencaoValor = valorTotalCotas > 0 ? (valorCotasAtivasEmDia / valorTotalCotas) * 100 : 0;
    const taxaRetencaoQtd = totalClientes > 0 ? (cotasAtivasEmDia / totalClientes) * 100 : 0;

    // % Em Atraso
    const taxaAtrasoValor = valorTotalCotas > 0 ? (valorCotasEmAtraso / valorTotalCotas) * 100 : 0;
    const taxaAtrasoQtd = totalClientes > 0 ? (cotasEmAtraso / totalClientes) * 100 : 0;

    // % Canceladas (Churn puro)
    const taxaCancelamento = totalClientes > 0 ? (clientesCancelados / totalClientes) * 100 : 0;
    const taxaCancelamentoValor = valorTotalCotas > 0 ? (valorCotasCanceladas / valorTotalCotas) * 100 : 0;

    // % Cancelamento + Atraso (Churn Total considerando cotas com parcelas em atraso)
    const cotasCanceladasOuAtraso = clientesCancelados + cotasEmAtraso;
    const valorCanceladasOuAtraso = valorCotasCanceladas + valorCotasEmAtraso;
    const taxaPerdaTotalQtd = totalClientes > 0 ? (cotasCanceladasOuAtraso / totalClientes) * 100 : 0;
    const taxaPerdaTotalValor = valorTotalCotas > 0 ? (valorCanceladasOuAtraso / valorTotalCotas) * 100 : 0;

    const ltvMedio = totalClientes > 0 ? somaLtvRealizadoGeral / totalClientes : 0;

    // Ordenar a lista: Em Atraso -> Ativa em Dia -> Cancelada (ou por valor de cota decrescente dentro da categoria)
    const ordemCategoria: Record<CategoriaRetencao, number> = {
      'Ativa em Dia': 1,
      'Em Atraso': 2,
      'Cancelada': 3
    };
    lista.sort((a, b) => {
      if (ordemCategoria[a.categoriaRetencao] !== ordemCategoria[b.categoriaRetencao]) {
        return ordemCategoria[a.categoriaRetencao] - ordemCategoria[b.categoriaRetencao];
      }
      return b.valorCota - a.valorCota;
    });

    return {
      kpis: {
        totalClientes,
        cotasAtivasEmDia,
        cotasEmAtraso,
        clientesCancelados,
        valorTotalCotas,
        valorCotasAtivasEmDia,
        valorCotasEmAtraso,
        valorCotasCanceladas,
        taxaRetencaoValor,
        taxaRetencaoQtd,
        taxaAtrasoValor,
        taxaAtrasoQtd,
        taxaCancelamento,
        taxaCancelamentoValor,
        cotasCanceladasOuAtraso,
        valorCanceladasOuAtraso,
        taxaPerdaTotalQtd,
        taxaPerdaTotalValor,
        ltvMedio,
        somaLtvRealizadoGeral
      },
      listaClientes: lista
    };
  }, [vendas, vendedores, dataInicio, dataFim]);

  const listaCancelados = useMemo(
    () => listaClientes.filter(c => c.categoriaRetencao === 'Cancelada'),
    [listaClientes]
  );

  const listaExibidaTabela = useMemo(() => {
    if (filtroTabela === 'Todas') return listaClientes;
    return listaClientes.filter(c => c.categoriaRetencao === filtroTabela);
  }, [listaClientes, filtroTabela]);

  // Cálculo para o gráfico de cancelamentos por mês
  const dadosCancelamentoMes = useMemo(() => {
    // Pegar o intervalo de meses baseado em dataInicio e dataFim
    const dInicioValid = (dataInicio && dataInicio.length >= 10 && !dataInicio.includes('d')) ? dataInicio : '2026-01-01';
    const dFimValid = (dataFim && dataFim.length >= 10 && !dataFim.includes('d')) ? dataFim : '2026-12-31';

    const dataI = new Date(dInicioValid + 'T00:00:00');
    const dataF = new Date(dFimValid + 'T00:00:00');

    let meses: string[] = [];
    if (!isNaN(dataI.getTime()) && !isNaN(dataF.getTime()) && dataI <= dataF) {
      let dataAtual = new Date(dataI.getFullYear(), dataI.getMonth(), 15);
      const dataLimite = new Date(dataF.getFullYear(), dataF.getMonth(), 15);

      while (dataAtual <= dataLimite) {
        const ano = dataAtual.getFullYear();
        const mes = String(dataAtual.getMonth() + 1).padStart(2, '0');
        meses.push(`${ano}-${mes}`);
        dataAtual.setMonth(dataAtual.getMonth() + 1);
      }
    }
    
    if (meses.length === 0) meses = ['2026-01'];

    return meses.map(mesChave => {
      const canceladosNoMes = listaCancelados.filter(c => 
        // Se cancelou em um mês específico, contabiliza nesse mês
        // Se está "Indefinido", contabiliza no mês da venda para não perder o dado
        (c.mesCancelamento !== 'Indefinido' && c.mesCancelamento === mesChave) ||
        (c.mesCancelamento === 'Indefinido' && c.dataVenda.substring(0, 7) === mesChave)
      );

      const quantidadeCancelada = canceladosNoMes.length;
      const valorCancelado = canceladosNoMes.reduce((acc, curr) => acc + curr.valorVendaCancelada, 0);

      return {
        mes: mesChave,
        nomeMes: formatarChaveMesExibicao(mesChave),
        quantidadeCancelada,
        valorCancelado
      };
    });
  }, [listaCancelados, dataInicio, dataFim]);

  const isDark = theme.palette.mode === 'dark';

  return (
    <Box sx={{ p: 1 }}>
      {/* Título */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" sx={{ fontFamily: 'Outfit, sans-serif', fontWeight: 700 }}>
          Retenção e LTV (Life Time Value)
        </Typography>
        <Typography variant="caption" sx={{ color: '#94a3b8' }}>
          Análise de retenção por valor de cota (VGV) e quantidade, inadimplência, cancelamentos e valor vitalício gerado.
        </Typography>
      </Box>

      {/* ── Bloco 1: Análise de Retenção por Valor de Cota (VGV) e Quantidade ── */}
      <Grid container spacing={2.5} sx={{ mb: 3 }}>
        {/* 1. Total de Cotas */}
        <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
          <Card
            elevation={0}
            onClick={() => setFiltroTabela('Todas')}
            sx={{
              height: '100%',
              cursor: 'pointer',
              borderRadius: 3.5,
              border: `1px solid ${filtroTabela === 'Todas' ? '#6366f1' : isDark ? '#1f2937' : '#e5e7eb'}`,
              background: isDark ? '#111827' : '#ffffff',
              transition: 'all 0.2s',
              '&:hover': { transform: 'translateY(-2px)' }
            }}
          >
            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.2 }}>
                <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700, textTransform: 'uppercase', fontSize: '0.68rem' }}>
                  Total de Cotas
                </Typography>
                <Avatar sx={{ bgcolor: 'rgba(99, 102, 241, 0.15)', color: 'primary.main', width: 34, height: 34 }}>
                  <AccountBalanceWalletIcon sx={{ fontSize: 19 }} />
                </Avatar>
              </Box>
              <Typography variant="h6" sx={{ fontWeight: 800, color: 'text.primary', fontFamily: 'Outfit, sans-serif' }}>
                {formatarMoeda(kpis.valorTotalCotas)}
              </Typography>
              <Typography variant="caption" sx={{ color: '#94a3b8', display: 'block', mt: 0.5, fontWeight: 600 }}>
                {kpis.totalClientes} cotas no período (100%)
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        {/* 2. Valor de Cotas Ativas (Parcelas pagas e a Vencer) */}
        <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
          <Card
            elevation={0}
            onClick={() => setFiltroTabela('Ativa em Dia')}
            sx={{
              height: '100%',
              cursor: 'pointer',
              borderRadius: 3.5,
              border: `1px solid ${filtroTabela === 'Ativa em Dia' ? '#10b981' : isDark ? '#1f2937' : '#e5e7eb'}`,
              background: isDark ? '#111827' : '#ffffff',
              transition: 'all 0.2s',
              '&:hover': { transform: 'translateY(-2px)' }
            }}
          >
            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.2 }}>
                <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700, textTransform: 'uppercase', fontSize: '0.68rem' }}>
                  Cotas Ativas (Pagas / A Vencer)
                </Typography>
                <Avatar sx={{ bgcolor: 'rgba(16, 185, 129, 0.15)', color: 'success.main', width: 34, height: 34 }}>
                  <CheckCircleIcon sx={{ fontSize: 19 }} />
                </Avatar>
              </Box>
              <Typography variant="h6" sx={{ fontWeight: 800, color: 'success.main', fontFamily: 'Outfit, sans-serif' }}>
                {formatarMoeda(kpis.valorCotasAtivasEmDia)}
              </Typography>
              <Typography variant="caption" sx={{ color: '#94a3b8', display: 'block', mt: 0.5 }}>
                <Box component="span" sx={{ color: 'success.main', fontWeight: 700 }}>{kpis.cotasAtivasEmDia} cotas</Box>
                {' • '}
                {kpis.taxaRetencaoValor.toFixed(2)}% do VGV
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        {/* 3. Valor de Cotas Em Atraso */}
        <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
          <Card
            elevation={0}
            onClick={() => setFiltroTabela('Em Atraso')}
            sx={{
              height: '100%',
              cursor: 'pointer',
              borderRadius: 3.5,
              border: `1px solid ${filtroTabela === 'Em Atraso' ? '#f59e0b' : isDark ? '#1f2937' : '#e5e7eb'}`,
              background: isDark ? '#111827' : '#ffffff',
              transition: 'all 0.2s',
              '&:hover': { transform: 'translateY(-2px)' }
            }}
          >
            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.2 }}>
                <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700, textTransform: 'uppercase', fontSize: '0.68rem' }}>
                  Valor de Cotas Em Atraso
                </Typography>
                <Avatar sx={{ bgcolor: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b', width: 34, height: 34 }}>
                  <WarningAmberIcon sx={{ fontSize: 19 }} />
                </Avatar>
              </Box>
              <Typography variant="h6" sx={{ fontWeight: 800, color: '#f59e0b', fontFamily: 'Outfit, sans-serif' }}>
                {formatarMoeda(kpis.valorCotasEmAtraso)}
              </Typography>
              <Typography variant="caption" sx={{ color: '#94a3b8', display: 'block', mt: 0.5 }}>
                <Box component="span" sx={{ color: '#f59e0b', fontWeight: 700 }}>{kpis.cotasEmAtraso} cotas</Box>
                {' • '}
                {kpis.taxaAtrasoValor.toFixed(2)}% VGV ({kpis.taxaAtrasoQtd.toFixed(2)}% qtd)
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        {/* 4. Valor de Cotas Canceladas */}
        <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
          <Card
            elevation={0}
            onClick={() => setFiltroTabela('Cancelada')}
            sx={{
              height: '100%',
              cursor: 'pointer',
              borderRadius: 3.5,
              border: `1px solid ${filtroTabela === 'Cancelada' ? '#ef4444' : isDark ? '#1f2937' : '#e5e7eb'}`,
              background: isDark ? '#111827' : '#ffffff',
              transition: 'all 0.2s',
              '&:hover': { transform: 'translateY(-2px)' }
            }}
          >
            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.2 }}>
                <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700, textTransform: 'uppercase', fontSize: '0.68rem' }}>
                  Valor de Cotas Canceladas
                </Typography>
                <Avatar sx={{ bgcolor: 'rgba(239, 68, 68, 0.15)', color: 'error.main', width: 34, height: 34 }}>
                  <CancelIcon sx={{ fontSize: 19 }} />
                </Avatar>
              </Box>
              <Typography variant="h6" sx={{ fontWeight: 800, color: 'error.main', fontFamily: 'Outfit, sans-serif' }}>
                {formatarMoeda(kpis.valorCotasCanceladas)}
              </Typography>
              <Typography variant="caption" sx={{ color: '#94a3b8', display: 'block', mt: 0.5 }}>
                <Box component="span" sx={{ color: 'error.main', fontWeight: 700 }}>{kpis.clientesCancelados} cotas</Box>
                {' • '}
                {kpis.taxaCancelamentoValor.toFixed(2)}% VGV ({kpis.taxaCancelamento.toFixed(2)}% qtd)
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        {/* 5. % de Retenção (VGV e Quantidade) */}
        <Grid size={{ xs: 12, sm: 12, md: 2.4 }}>
          <Card
            elevation={0}
            sx={{
              height: '100%',
              borderRadius: 3.5,
              border: `1.5px solid rgba(16, 185, 129, 0.45)`,
              background: isDark
                ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.12) 0%, #111827 100%)'
                : 'linear-gradient(135deg, #ecfdf5 0%, #ffffff 100%)',
            }}
          >
            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                <Typography variant="caption" sx={{ color: 'success.main', fontWeight: 800, textTransform: 'uppercase', fontSize: '0.68rem' }}>
                  % de Retenção (Em Dia)
                </Typography>
                <Avatar sx={{ bgcolor: 'rgba(16, 185, 129, 0.2)', color: 'success.main', width: 34, height: 34 }}>
                  <TrendingUpIcon sx={{ fontSize: 19 }} />
                </Avatar>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1 }}>
                <Typography variant="h6" sx={{ fontWeight: 900, color: 'success.main', fontFamily: 'Outfit, sans-serif' }}>
                  {kpis.taxaRetencaoValor.toFixed(2)}%
                </Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700 }}>
                  por Valor (VGV)
                </Typography>
              </Box>
              <Typography variant="caption" sx={{ color: 'text.primary', display: 'block', mt: 0.4, fontWeight: 700 }}>
                {kpis.taxaRetencaoQtd.toFixed(2)}% por Qtd. ({kpis.cotasAtivasEmDia}/{kpis.totalClientes} cotas)
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* ── Barra Visual de Composição da Carteira (Ativas em Dia vs Em Atraso vs Canceladas) ── */}
      {kpis.valorTotalCotas > 0 && (
        <Paper
          elevation={0}
          sx={{
            p: 2,
            mb: 3,
            borderRadius: 3.5,
            border: `1px solid ${isDark ? '#1f2937' : '#e5e7eb'}`,
            background: isDark ? '#111827' : '#ffffff',
          }}
        >
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1, flexWrap: 'wrap', gap: 1 }}>
            <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Distribuição do Valor Total de Cotas ({formatarMoeda(kpis.valorTotalCotas)})
            </Typography>
            <Box sx={{ display: 'flex', gap: 2.5, flexWrap: 'wrap' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.7 }}>
                <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: '#10b981' }} />
                <Typography variant="caption" sx={{ fontWeight: 700 }}>
                  Retidas em Dia: {kpis.taxaRetencaoValor.toFixed(2)}% ({formatarMoeda(kpis.valorCotasAtivasEmDia)})
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.7 }}>
                <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: '#f59e0b' }} />
                <Typography variant="caption" sx={{ fontWeight: 700 }}>
                  Em Atraso: {kpis.taxaAtrasoValor.toFixed(2)}% ({formatarMoeda(kpis.valorCotasEmAtraso)})
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.7 }}>
                <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: '#ef4444' }} />
                <Typography variant="caption" sx={{ fontWeight: 700 }}>
                  Canceladas: {kpis.taxaCancelamentoValor.toFixed(2)}% ({formatarMoeda(kpis.valorCotasCanceladas)})
                </Typography>
              </Box>
            </Box>
          </Box>
          <Box sx={{ display: 'flex', width: '100%', height: 12, borderRadius: 99, overflow: 'hidden', bgcolor: isDark ? '#1f2937' : '#e5e7eb' }}>
            <Tooltip title={`Ativas (Pagas e a Vencer): ${formatarMoeda(kpis.valorCotasAtivasEmDia)} (${kpis.taxaRetencaoValor.toFixed(2)}%)`}>
              <Box sx={{ width: `${kpis.taxaRetencaoValor}%`, bgcolor: '#10b981', transition: 'width 0.3s' }} />
            </Tooltip>
            <Tooltip title={`Em Atraso: ${formatarMoeda(kpis.valorCotasEmAtraso)} (${kpis.taxaAtrasoValor.toFixed(2)}%)`}>
              <Box sx={{ width: `${kpis.taxaAtrasoValor}%`, bgcolor: '#f59e0b', transition: 'width 0.3s' }} />
            </Tooltip>
            <Tooltip title={`Canceladas: ${formatarMoeda(kpis.valorCotasCanceladas)} (${kpis.taxaCancelamentoValor.toFixed(2)}%)`}>
              <Box sx={{ width: `${kpis.taxaCancelamentoValor}%`, bgcolor: '#ef4444', transition: 'width 0.3s' }} />
            </Tooltip>
          </Box>
        </Paper>
      )}

      {/* ── Bloco 2: Cards de LTV e Taxa de Cancelamento (Churn) ── */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card
            elevation={0}
            sx={{
              borderRadius: 3.5,
              border: `1px solid ${isDark ? '#1f2937' : '#e5e7eb'}`,
              background: isDark ? '#111827' : '#ffffff',
            }}
          >
            <CardContent sx={{ p: 2.25, '&:last-child': { pb: 2.25 } }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
                <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700, textTransform: 'uppercase' }}>
                  LTV Médio (Receita)
                </Typography>
                <Avatar sx={{ bgcolor: 'rgba(16, 185, 129, 0.15)', color: 'success.main', width: 36, height: 36 }}>
                  <MonetizationOnIcon sx={{ fontSize: 20 }} />
                </Avatar>
              </Box>
              <Typography variant="h6" sx={{ fontWeight: 800, color: 'success.main' }}>
                {formatarMoeda(kpis.ltvMedio)}
              </Typography>
              <Typography variant="caption" sx={{ color: '#94a3b8', display: 'block', mt: 0.5 }}>
                Média de comissão recebida por cota cadastrada
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card
            elevation={0}
            sx={{
              height: '100%',
              borderRadius: 3.5,
              border: `1px solid ${isDark ? '#1f2937' : '#e5e7eb'}`,
              background: isDark ? '#111827' : '#ffffff',
            }}
          >
            <CardContent sx={{ p: 2.25, '&:last-child': { pb: 2.25 } }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700, textTransform: 'uppercase' }}>
                  Taxa de Cancelamento + Atraso (Cotas)
                </Typography>
                <Avatar sx={{ bgcolor: 'rgba(239, 68, 68, 0.15)', color: 'error.main', width: 36, height: 36 }}>
                  <TrendingDownIcon sx={{ fontSize: 20 }} />
                </Avatar>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, flexWrap: 'wrap' }}>
                <Typography variant="h6" sx={{ fontWeight: 900, color: 'error.main', fontFamily: 'Outfit, sans-serif' }}>
                  {kpis.taxaPerdaTotalQtd.toFixed(2)}%
                </Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700 }}>
                  das cotas ({kpis.taxaPerdaTotalValor.toFixed(2)}% VGV)
                </Typography>
              </Box>
              <Typography variant="caption" sx={{ color: '#94a3b8', display: 'block', mt: 0.3, mb: 1 }}>
                {kpis.cotasCanceladasOuAtraso} de {kpis.totalClientes} cotas ({formatarMoeda(kpis.valorCanceladasOuAtraso)})
              </Typography>
              <Box
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 0.4,
                  p: 1,
                  borderRadius: 2,
                  bgcolor: isDark ? 'rgba(255,255,255,0.03)' : '#f8fafc',
                  border: `1px solid ${isDark ? '#1f2937' : '#e2e8f0'}`
                }}
              >
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6 }}>
                    <Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: '#ef4444' }} />
                    <Typography variant="caption" sx={{ fontWeight: 700, color: '#ef4444', fontSize: '0.7rem' }}>
                      Canceladas ({kpis.clientesCancelados}):
                    </Typography>
                  </Box>
                  <Typography variant="caption" sx={{ fontWeight: 800, color: '#ef4444', fontSize: '0.7rem' }}>
                    {kpis.taxaCancelamento.toFixed(2)}% Qtd • {kpis.taxaCancelamentoValor.toFixed(2)}% VGV
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6 }}>
                    <Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: '#f59e0b' }} />
                    <Typography variant="caption" sx={{ fontWeight: 700, color: '#f59e0b', fontSize: '0.7rem' }}>
                      Em Atraso ({kpis.cotasEmAtraso}):
                    </Typography>
                  </Box>
                  <Typography variant="caption" sx={{ fontWeight: 800, color: '#f59e0b', fontSize: '0.7rem' }}>
                    {kpis.taxaAtrasoQtd.toFixed(2)}% Qtd • {kpis.taxaAtrasoValor.toFixed(2)}% VGV
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card
            elevation={0}
            sx={{
              borderRadius: 3.5,
              border: `1px solid ${isDark ? '#1f2937' : '#e5e7eb'}`,
              background: isDark ? '#111827' : '#ffffff',
            }}
          >
            <CardContent sx={{ p: 2.25, '&:last-child': { pb: 2.25 } }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
                <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700, textTransform: 'uppercase' }}>
                  Total de Cotas no Período
                </Typography>
                <Avatar sx={{ bgcolor: 'rgba(59, 130, 246, 0.15)', color: 'info.main', width: 36, height: 36 }}>
                  <PeopleIcon sx={{ fontSize: 20 }} />
                </Avatar>
              </Box>
              <Typography variant="h6" sx={{ fontWeight: 800, color: 'text.primary' }}>
                {kpis.totalClientes}
              </Typography>
              <Typography variant="caption" sx={{ color: '#94a3b8', display: 'block', mt: 0.5 }}>
                {kpis.cotasAtivasEmDia} em dia • {kpis.cotasEmAtraso} em atraso • {kpis.clientesCancelados} canc.
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card
            elevation={0}
            sx={{
              borderRadius: 3.5,
              border: `1px solid ${isDark ? '#1f2937' : '#e5e7eb'}`,
              background: isDark ? '#111827' : '#ffffff',
            }}
          >
            <CardContent sx={{ p: 2.25, '&:last-child': { pb: 2.25 } }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
                <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700, textTransform: 'uppercase' }}>
                  LTV Total Acumulado
                </Typography>
                <Avatar sx={{ bgcolor: 'rgba(99, 102, 241, 0.15)', color: 'primary.main', width: 36, height: 36 }}>
                  <HistoryIcon sx={{ fontSize: 20 }} />
                </Avatar>
              </Box>
              <Typography variant="h6" sx={{ fontWeight: 800, color: 'text.primary' }}>
                {formatarMoeda(kpis.somaLtvRealizadoGeral)}
              </Typography>
              <Typography variant="caption" sx={{ color: '#94a3b8', display: 'block', mt: 0.5 }}>
                Toda a comissão recebida destas cotas
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Gráfico Mensal de Cancelamentos */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid size={{ xs: 12 }}>
          <Paper
            elevation={0}
            sx={{
              p: 3,
              borderRadius: 4,
              border: `1px solid ${isDark ? '#1f2937' : '#e5e7eb'}`,
              background: isDark ? '#111827' : '#ffffff'
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
              <TrendingDownIcon sx={{ color: 'error.main', mr: 1.5 }} />
              <Typography variant="h6" sx={{ fontFamily: 'Outfit, sans-serif', fontWeight: 700 }}>
                Evolução Mensal de Cancelamentos (Quantidade e Valor)
              </Typography>
            </Box>
            
            <Box sx={{ width: '100%', height: 350 }}>
              {dadosCancelamentoMes.length === 0 ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                  <Typography sx={{ color: '#64748b' }}>Sem dados no período</Typography>
                </Box>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={dadosCancelamentoMes} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#334155' : '#e2e8f0'} vertical={false} />
                    <XAxis
                      dataKey="nomeMes"
                      stroke={isDark ? '#94a3b8' : '#64748b'}
                      fontSize={11}
                      tickLine={false}
                    />
                    <YAxis
                      yAxisId="left"
                      stroke={isDark ? '#94a3b8' : '#64748b'}
                      fontSize={11}
                      tickFormatter={formatarMoedaEixo}
                      tickLine={false}
                    />
                    <YAxis
                      yAxisId="right"
                      orientation="right"
                      stroke={theme.palette.error.main}
                      fontSize={11}
                      tickFormatter={(val) => `${val}`}
                      tickLine={false}
                    />
                    <ChartTooltip
                      formatter={(value: any, name: any) => {
                        if (name === 'valorCancelado') return [formatarMoeda(value), 'Valor Cancelado (VGV)'];
                        if (name === 'quantidadeCancelada') return [`${value} cotas`, 'Qtd. Cancelada'];
                        return [value, name];
                      }}
                      contentStyle={{
                        backgroundColor: isDark ? '#0f172a' : '#ffffff',
                        borderColor: isDark ? '#334155' : '#e2e8f0',
                        borderRadius: 8,
                        color: isDark ? '#f1f5f9' : '#0f172a'
                      }}
                    />
                    <Legend 
                      verticalAlign="top" 
                      height={36} 
                      iconType="circle" 
                      formatter={(value) => {
                        if (value === 'valorCancelado') return 'Valor Cancelado (R$)';
                        if (value === 'quantidadeCancelada') return 'Quantidade de Cotas';
                        return value;
                      }} 
                    />
                    <Bar
                      yAxisId="left"
                      dataKey="valorCancelado"
                      name="valorCancelado"
                      fill={theme.palette.error.main}
                      radius={[4, 4, 0, 0]}
                      maxBarSize={50}
                    />
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="quantidadeCancelada"
                      name="quantidadeCancelada"
                      stroke="#f59e0b"
                      strokeWidth={3}
                      dot={{ r: 4, strokeWidth: 1, fill: '#f59e0b' }}
                      activeDot={{ r: 6 }}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              )}
            </Box>
          </Paper>
        </Grid>
      </Grid>

      {/* Tabela Detalhada de Cotas (Filtra por Todas, Ativas em Dia, Em Atraso ou Canceladas) */}
      <Grid container spacing={3}>
        <Grid size={{ xs: 12 }}>
          <TableContainer
            component={Paper}
            sx={{
              borderRadius: 4,
              border: `1px solid ${isDark ? '#1f2937' : '#e5e7eb'}`,
              background: isDark ? '#111827' : '#ffffff',
              overflow: 'hidden'
            }}
          >
            <Box
              sx={{
                p: 2.5,
                borderBottom: `1px solid ${isDark ? '#1f2937' : '#e5e7eb'}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: 1.5
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <AccountBalanceWalletIcon sx={{ color: 'primary.main' }} />
                <Typography variant="h6" sx={{ fontFamily: 'Outfit, sans-serif', fontWeight: 700, fontSize: '1.1rem' }}>
                  Detalhamento de Cotas, Retenção e LTV Efetivado
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                <Chip
                  label={`Todas (${kpis.totalClientes})`}
                  onClick={() => setFiltroTabela('Todas')}
                  color={filtroTabela === 'Todas' ? 'primary' : 'default'}
                  variant={filtroTabela === 'Todas' ? 'filled' : 'outlined'}
                  size="small"
                  sx={{ fontWeight: 700, cursor: 'pointer' }}
                />
                <Chip
                  label={`Ativas em Dia (${kpis.cotasAtivasEmDia})`}
                  onClick={() => setFiltroTabela('Ativa em Dia')}
                  color={filtroTabela === 'Ativa em Dia' ? 'success' : 'default'}
                  variant={filtroTabela === 'Ativa em Dia' ? 'filled' : 'outlined'}
                  size="small"
                  sx={{ fontWeight: 700, cursor: 'pointer' }}
                />
                <Chip
                  label={`Em Atraso (${kpis.cotasEmAtraso})`}
                  onClick={() => setFiltroTabela('Em Atraso')}
                  color={filtroTabela === 'Em Atraso' ? 'warning' : 'default'}
                  variant={filtroTabela === 'Em Atraso' ? 'filled' : 'outlined'}
                  size="small"
                  sx={{ fontWeight: 700, cursor: 'pointer' }}
                />
                <Chip
                  label={`Canceladas (${kpis.clientesCancelados})`}
                  onClick={() => setFiltroTabela('Cancelada')}
                  color={filtroTabela === 'Cancelada' ? 'error' : 'default'}
                  variant={filtroTabela === 'Cancelada' ? 'filled' : 'outlined'}
                  size="small"
                  sx={{ fontWeight: 700, cursor: 'pointer' }}
                />
              </Box>
            </Box>
            <Table size="small">
              <TableHead sx={{ bgcolor: isDark ? '#1f2937' : '#f9fafb' }}>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700, py: 1.5 }}>Cliente / PAC</TableCell>
                  <TableCell sx={{ fontWeight: 700, py: 1.5 }}>Vendedor / Corretor</TableCell>
                  <TableCell sx={{ fontWeight: 700, py: 1.5 }} align="center">Data da Venda</TableCell>
                  <TableCell sx={{ fontWeight: 700, py: 1.5 }} align="right">Valor da Cota (R$)</TableCell>
                  <TableCell sx={{ fontWeight: 700, py: 1.5 }} align="center">Situação da Cota</TableCell>
                  <TableCell sx={{ fontWeight: 700, py: 1.5 }}>Parcelas Pagas / Em Atraso</TableCell>
                  <TableCell sx={{ fontWeight: 700, py: 1.5 }} align="right">LTV Realizado (R$)</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {listaExibidaTabela.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} align="center" sx={{ py: 6, color: '#64748b' }}>
                      Nenhuma cota encontrada para o filtro selecionado neste período.
                    </TableCell>
                  </TableRow>
                ) : (
                  listaExibidaTabela.map((linha) => {
                    return (
                      <TableRow
                        key={linha.vendaId}
                        sx={{
                          '&:hover': {
                            bgcolor: isDark ? 'rgba(255,255,255,0.01)' : 'rgba(0,0,0,0.01)'
                          }
                        }}
                      >
                        <TableCell sx={{ fontWeight: 650 }}>
                          <Box>
                            <Typography variant="body2" sx={{ fontWeight: 650 }}>{linha.cliente}</Typography>
                            {linha.pac && (
                              <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.7rem' }}>
                                PAC: {linha.pac}
                              </Typography>
                            )}
                          </Box>
                        </TableCell>
                        <TableCell sx={{ color: 'text.secondary' }}>{linha.vendedorNome}</TableCell>
                        <TableCell align="center" sx={{ color: 'text.secondary' }}>
                          {linha.dataVenda ? new Date(linha.dataVenda + 'T00:00:00').toLocaleDateString('pt-BR') : '-'}
                        </TableCell>
                        <TableCell align="right" sx={{ fontWeight: 700 }}>
                          {formatarMoeda(linha.valorCota)}
                        </TableCell>
                        <TableCell align="center">
                          {linha.categoriaRetencao === 'Cancelada' ? (
                            <Chip
                              label={`Cancelada (${linha.mesCancelamento && linha.mesCancelamento !== 'Indefinido' ? formatarChaveMesExibicao(linha.mesCancelamento) : 'Indefinido'})`}
                              size="small"
                              color="error"
                              variant="outlined"
                              sx={{ fontWeight: 700, fontSize: '0.68rem' }}
                            />
                          ) : linha.categoriaRetencao === 'Em Atraso' ? (
                            <Tooltip title={`Parcelas vencidas: ${linha.parcelasVencidasNomes.join(', ')}`} arrow>
                              <Chip
                                label={`Em Atraso (${linha.parcelasVencidasNomes.length} venc.)`}
                                size="small"
                                sx={{
                                  fontWeight: 700,
                                  fontSize: '0.68rem',
                                  color: '#f59e0b',
                                  bgcolor: 'rgba(245, 158, 11, 0.12)',
                                  border: '1px solid rgba(245, 158, 11, 0.35)'
                                }}
                              />
                            </Tooltip>
                          ) : (
                            <Chip
                              label="Ativa (Pagas / A Vencer)"
                              size="small"
                              color="success"
                              variant="outlined"
                              sx={{ fontWeight: 700, fontSize: '0.68rem' }}
                            />
                          )}
                        </TableCell>
                        <TableCell>
                          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.2 }}>
                            {linha.parcelasPagasNomes.length > 0 ? (
                              <Tooltip title={`Pagas: ${linha.parcelasPagasNomes.join(', ')}`}>
                                <Typography variant="body2" sx={{ fontWeight: 600, color: 'success.main', fontSize: '0.8rem' }}>
                                  {linha.parcelasPagasNomes.length}/{linha.totalParcelasContrato} paga(s)
                                  <Typography component="span" variant="caption" sx={{ ml: 0.8, color: 'text.disabled' }}>
                                    ({linha.parcelasPagasNomes.length <= 3 ? linha.parcelasPagasNomes.join(', ') : linha.parcelasPagasNomes.slice(0, 3).join(', ') + '...'})
                                  </Typography>
                                </Typography>
                              </Tooltip>
                            ) : (
                              <Typography variant="body2" sx={{ color: 'text.disabled', fontStyle: 'italic', fontSize: '0.8rem' }}>
                                Nenhuma parcela paga
                              </Typography>
                            )}
                            {linha.parcelasVencidasNomes.length > 0 && (
                              <Typography variant="caption" sx={{ color: '#f59e0b', fontWeight: 600, fontSize: '0.7rem' }}>
                                Em atraso: {linha.parcelasVencidasNomes.join(', ')}
                              </Typography>
                            )}
                          </Box>
                        </TableCell>
                        <TableCell align="right" sx={{ fontWeight: 700, color: 'text.primary' }}>
                          {formatarMoeda(linha.ltvRealizado)}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Grid>
      </Grid>
    </Box>
  );
};
