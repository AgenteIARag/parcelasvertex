import React, { useMemo } from 'react';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  Avatar,
  LinearProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  useTheme
} from '@mui/material';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import PaymentsIcon from '@mui/icons-material/Payments';
import GroupIcon from '@mui/icons-material/Group';
import LeaderboardIcon from '@mui/icons-material/Leaderboard';
import {
  ResponsiveContainer,
  BarChart,
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
import { formatarMoeda, formatarMoedaEixo, formatarChaveMesExibicao } from '../utils/formatters';

interface DashboardVendedoresProps {
  vendas: LancamentoVenda[];
  vendedores: Vendedor[];
  dataInicio: string;
  dataFim: string;
}

export const DashboardVendedores: React.FC<DashboardVendedoresProps> = ({
  vendas,
  vendedores,
  dataInicio,
  dataFim
}) => {
  const theme = useTheme();
  
  const [vendedorSelecionadoId, setVendedorSelecionadoId] = React.useState<string>('todos');

  const dadosVendedores = useMemo(() => {
    const mesInicioChave = dataInicio.substring(0, 7);
    const mesFimChave = dataFim.substring(0, 7);

    return vendedores.map((vendedor) => {
      let faturamentoTotal = 0;
      let comissaoTotalEmpresa = 0;
      let comissaoTotalVendedor = 0;
      const vendasSet = new Set<string>();

      // Filtra as vendas vinculadas a este vendedor
      const vendasDoVend = vendas.filter(v => v.vendedorId === vendedor.id);

      vendasDoVend.forEach((venda) => {
        const pctVendedor = Number(vendedor.percentualComissao || 0);
        const proporcao = venda.percentualComissao > 0 ? pctVendedor / venda.percentualComissao : 0;
        
        // 1. Calcula a Comissão fluindo no período (Fluxo de Caixa / Parcelas ativas)
        Object.keys(venda.projecaoMensal).forEach((mesChave) => {
          const celula = venda.projecaoMensal[mesChave];
          if (celula && celula.valorVenda > 0 && celula.status !== 'Cancelada') {
            if (mesChave >= mesInicioChave && mesChave <= mesFimChave) {
              const comissaoEmpresa = (celula.comissaoGerada || 0);
              const comissaoVendedor = comissaoEmpresa * proporcao;
              comissaoTotalEmpresa += comissaoEmpresa;
              comissaoTotalVendedor += comissaoVendedor;
            }
          }
        });

        // 2. Calcula o Volume Geral de Vendas (Faturamento e Qtd) baseado no momento em que a venda ocorreu
        const dataDaVenda = venda.dataVenda || (venda.mesInicio ? `${venda.mesInicio}-01` : '');
        if (dataDaVenda && dataDaVenda >= dataInicio && dataDaVenda <= dataFim) {
          if (venda.statusCliente !== 'Cancelado') {
            faturamentoTotal += venda.valorVenda; // Soma o Crédito Total vendido!
            vendasSet.add(venda.id); // Contabiliza a Venda para o Ticket Médio
          }
        }
      });

      return {
        vendedorId: vendedor.id,
        vendedorNome: vendedor.nome,
        ativo: vendedor.ativo,
        faturamento: faturamentoTotal,
        comissaoEmpresa: Number(comissaoTotalEmpresa.toFixed(2)),
        comissaoVendedor: Number(comissaoTotalVendedor.toFixed(2)),
        comissao: Number(comissaoTotalVendedor.toFixed(2)), // legacy fallback
        qtdVendas: vendasSet.size
      };
    });
  }, [vendedores, vendas, dataInicio, dataFim]);

  // Derivação das métricas globais para os cards de KPI
  const kpis = useMemo(() => {
    const faturamentoGlobal = dadosVendedores.reduce((acc, d) => acc + d.faturamento, 0);
    const comissaoGlobal = dadosVendedores.reduce((acc, d) => acc + d.comissao, 0);
    const totalVendas = dadosVendedores.reduce((acc, d) => acc + d.qtdVendas, 0);
    
    // Vendedor líder (maior faturamento no período)
    const sorted = [...dadosVendedores].sort((a, b) => b.faturamento - a.faturamento);
    const lider = sorted.length > 0 && sorted[0].faturamento > 0 ? sorted[0] : null;

    const ticketMedio = totalVendas > 0 ? faturamentoGlobal / totalVendas : 0;

    return {
      faturamentoGlobal,
      comissaoGlobal,
      totalVendas,
      lider,
      ticketMedio
    };
  }, [dadosVendedores]);

  // Ranking ordenado
  const ranking = useMemo(() => {
    return [...dadosVendedores]
      .filter(d => d.faturamento > 0 || d.qtdVendas > 0)
      .sort((a, b) => b.faturamento - a.faturamento);
  }, [dadosVendedores]);

  // Maior faturamento do ranking (para base percentual da barra de progresso)
  const maxFaturamento = useMemo(() => {
    return ranking.length > 0 ? ranking[0].faturamento : 1;
  }, [ranking]);

  // Gera dinamicamente a lista de chaves "YYYY-MM" no intervalo de data selecionado
  const obterMesesEvolucao = (): string[] => {
    const dInicioValid = (dataInicio && dataInicio.length >= 10 && !dataInicio.includes('d')) ? dataInicio : '2026-01-01';
    const dFimValid = (dataFim && dataFim.length >= 10 && !dataFim.includes('d')) ? dataFim : '2026-12-31';

    const dataI = new Date(dInicioValid + 'T00:00:00');
    const dataF = new Date(dFimValid + 'T00:00:00');

    if (isNaN(dataI.getTime()) || isNaN(dataF.getTime()) || dataI > dataF) {
      return ['2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09', '2026-10', '2026-11', '2026-12'];
    }

    const meses: string[] = [];
    let dataAtual = new Date(dataI.getFullYear(), dataI.getMonth(), 15);
    const dataLimite = new Date(dataF.getFullYear(), dataF.getMonth(), 15);

    while (dataAtual <= dataLimite) {
      const ano = dataAtual.getFullYear();
      const mes = String(dataAtual.getMonth() + 1).padStart(2, '0');
      meses.push(`${ano}-${mes}`);
      dataAtual.setMonth(dataAtual.getMonth() + 1);
    }
    return meses.length > 0 ? meses : ['2026-01'];
  };

  const dadosDesempenhoVendedor = useMemo(() => {
    const meses = obterMesesEvolucao();
    
    const vendasFiltradas = vendedorSelecionadoId === 'todos' 
      ? vendas 
      : vendas.filter(v => v.vendedorId === vendedorSelecionadoId);

    return meses.map(mesChave => {
      let volumeVendidoAtivo = 0;
      let volumeCancelado = 0;
      let qtdVendidoAtivo = 0;
      let qtdCancelado = 0;

      vendasFiltradas.forEach(v => {
        const mesVenda = v.dataVenda ? v.dataVenda.substring(0, 7) : (v.mesInicio || '');
        if (mesVenda === mesChave) {
          const cotaCancelada =
            v.statusCliente?.toLowerCase() === 'cancelado' ||
            (v.projecaoMensal &&
              Object.values(v.projecaoMensal).length > 0 &&
              !Object.values(v.projecaoMensal).some((p) => p.status?.toLowerCase() !== 'cancelada' && (p.valorVenda || 0) > 0));

          if (cotaCancelada) {
            volumeCancelado += Number(v.valorVenda || 0);
            qtdCancelado += 1;
          } else {
            volumeVendidoAtivo += Number(v.valorVenda || 0);
            qtdVendidoAtivo += 1;
          }
        }
      });

      const totalMensal = volumeVendidoAtivo + volumeCancelado;
      const taxaCancelamento = totalMensal > 0 ? (volumeCancelado / totalMensal) * 100 : 0;

      return {
        mes: mesChave,
        nomeMes: formatarChaveMesExibicao(mesChave),
        volumeVendidoAtivo,
        volumeCancelado,
        qtdVendidoAtivo,
        qtdCancelado,
        taxaCancelamento: Number(taxaCancelamento.toFixed(2))
      };
    });
  }, [vendas, vendedorSelecionadoId, dataInicio, dataFim]);

  return (
    <Box sx={{ p: 1 }}>
      {/* Título */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" sx={{ fontFamily: 'Outfit, sans-serif', fontWeight: 700 }}>
          Dashboard de Desempenho dos Vendedores
        </Typography>
        <Typography variant="caption" sx={{ color: '#94a3b8' }}>
          Visão analítica de faturamento, rankings de corretores e controle de comissões por período
        </Typography>
      </Box>

      {/* Cards de KPIs */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card
            elevation={0}
            sx={{
              borderRadius: 3.5,
              border: `1px solid ${theme.palette.mode === 'dark' ? '#1f2937' : '#e5e7eb'}`,
              background: theme.palette.mode === 'dark' ? '#111827' : '#ffffff',
              transition: 'transform 0.2s',
              '&:hover': { transform: 'translateY(-2px)' }
            }}
          >
            <CardContent sx={{ p: 2.25, '&:last-child': { pb: 2.25 } }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
                <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700, textTransform: 'uppercase' }}>
                  Faturamento de Corretores
                </Typography>
                <Avatar sx={{ bgcolor: 'rgba(99, 102, 241, 0.15)', color: 'primary.main', width: 36, height: 36 }}>
                  <TrendingUpIcon sx={{ fontSize: 20 }} />
                </Avatar>
              </Box>
              <Typography variant="h6" sx={{ fontWeight: 800, color: 'text.primary' }}>
                {formatarMoeda(kpis.faturamentoGlobal)}
              </Typography>
              <Typography variant="caption" sx={{ color: '#94a3b8', display: 'block', mt: 0.5 }}>
                Soma de parcelas ativas no período
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card
            elevation={0}
            sx={{
              borderRadius: 3.5,
              border: `1px solid ${theme.palette.mode === 'dark' ? '#1f2937' : '#e5e7eb'}`,
              background: theme.palette.mode === 'dark' ? '#111827' : '#ffffff',
              transition: 'transform 0.2s',
              '&:hover': { transform: 'translateY(-2px)' }
            }}
          >
            <CardContent sx={{ p: 2.25, '&:last-child': { pb: 2.25 } }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
                <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700, textTransform: 'uppercase' }}>
                  Comissões a Pagar
                </Typography>
                <Avatar sx={{ bgcolor: 'rgba(16, 185, 129, 0.15)', color: 'success.main', width: 36, height: 36 }}>
                  <PaymentsIcon sx={{ fontSize: 20 }} />
                </Avatar>
              </Box>
              <Typography variant="h6" sx={{ fontWeight: 800, color: 'success.main' }}>
                {formatarMoeda(kpis.comissaoGlobal)}
              </Typography>
              <Typography variant="caption" sx={{ color: '#94a3b8', display: 'block', mt: 0.5 }}>
                Comissão gerada no período filtrado
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card
            elevation={0}
            sx={{
              borderRadius: 3.5,
              border: `1px solid ${theme.palette.mode === 'dark' ? '#1f2937' : '#e5e7eb'}`,
              background: theme.palette.mode === 'dark' ? '#111827' : '#ffffff',
              transition: 'transform 0.2s',
              '&:hover': { transform: 'translateY(-2px)' }
            }}
          >
            <CardContent sx={{ p: 2.25, '&:last-child': { pb: 2.25 } }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
                <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700, textTransform: 'uppercase' }}>
                  Ticket Médio
                </Typography>
                <Avatar sx={{ bgcolor: 'rgba(245, 158, 11, 0.15)', color: 'secondary.main', width: 36, height: 36 }}>
                  <LeaderboardIcon sx={{ fontSize: 20 }} />
                </Avatar>
              </Box>
              <Typography variant="h6" sx={{ fontWeight: 800, color: 'text.primary' }}>
                {formatarMoeda(kpis.ticketMedio)}
              </Typography>
              <Typography variant="caption" sx={{ color: '#94a3b8', display: 'block', mt: 0.5 }}>
                Média por venda no período
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card
            elevation={0}
            sx={{
              borderRadius: 3.5,
              border: `1px solid ${theme.palette.mode === 'dark' ? '#1f2937' : '#e5e7eb'}`,
              background: theme.palette.mode === 'dark' ? '#111827' : '#ffffff',
              transition: 'transform 0.2s',
              '&:hover': { transform: 'translateY(-2px)' }
            }}
          >
            <CardContent sx={{ p: 2.25, '&:last-child': { pb: 2.25 } }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
                <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700, textTransform: 'uppercase' }}>
                  Vendedor Líder
                </Typography>
                <Avatar sx={{ bgcolor: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', width: 36, height: 36 }}>
                  <EmojiEventsIcon sx={{ fontSize: 20 }} />
                </Avatar>
              </Box>
              <Typography variant="h6" sx={{ fontWeight: 800, color: 'text.primary', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {kpis.lider ? kpis.lider.vendedorNome : '-'}
              </Typography>
              <Typography variant="caption" sx={{ color: '#94a3b8', display: 'block', mt: 0.5 }}>
                {kpis.lider ? `${formatarMoeda(kpis.lider.faturamento)} faturados` : 'Nenhum resultado'}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Gráfico Comparativo de Vendedores */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid size={{ xs: 12 }}>
          <Paper
            elevation={0}
            sx={{
              p: 3,
              borderRadius: 4,
              border: `1px solid ${theme.palette.mode === 'dark' ? '#334155' : '#e2e8f0'}`,
              background: theme.palette.mode === 'dark' ? '#1e293b' : '#ffffff'
            }}
          >
            <Typography
              variant="h6"
              sx={{
                fontWeight: 700,
                fontFamily: 'Outfit, sans-serif',
                mb: 3,
                color: theme.palette.mode === 'dark' ? '#f8fafc' : '#0f172a'
              }}
            >
              Faturamento vs Comissão (Top 10 Vendedores)
            </Typography>
            <Box sx={{ width: '100%', height: 350 }}>
              {ranking.length === 0 ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                  <Typography sx={{ color: '#64748b' }}>Sem dados suficientes para gerar gráficos</Typography>
                </Box>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={ranking.slice(0, 10)} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={theme.palette.mode === 'dark' ? '#334155' : '#e2e8f0'} vertical={false} />
                    <XAxis
                      dataKey="vendedorNome"
                      stroke={theme.palette.mode === 'dark' ? '#94a3b8' : '#64748b'}
                      fontSize={11}
                      tickLine={false}
                      tick={{ fill: theme.palette.mode === 'dark' ? '#cbd5e1' : '#475569' }}
                    />
                    <YAxis
                      yAxisId="left"
                      stroke={theme.palette.mode === 'dark' ? '#94a3b8' : '#64748b'}
                      fontSize={11}
                      tickFormatter={formatarMoedaEixo}
                      tickLine={false}
                    />
                    <YAxis
                      yAxisId="right"
                      orientation="right"
                      stroke={theme.palette.success.main}
                      fontSize={11}
                      tickFormatter={formatarMoedaEixo}
                      tickLine={false}
                    />
                    <ChartTooltip
                      formatter={(value: any, name: any, props: any) => {
                        const qtd = props.payload.qtdVendas;
                        if (name === 'faturamento') return [`${formatarMoeda(value)} (${qtd} cotas)`, 'Total Faturado'];
                        if (name === 'comissaoEmpresa') return [formatarMoeda(value), 'Comissão da Empresa (Gera)'];
                        if (name === 'comissaoVendedor') return [formatarMoeda(value), 'Comissão do Vendedor (Paga)'];
                        return [formatarMoeda(value), name];
                      }}
                      contentStyle={{
                        backgroundColor: theme.palette.mode === 'dark' ? '#0f172a' : '#ffffff',
                        borderColor: theme.palette.mode === 'dark' ? '#334155' : '#e2e8f0',
                        borderRadius: 8,
                        color: theme.palette.mode === 'dark' ? '#f1f5f9' : '#0f172a'
                      }}
                    />
                    <Legend 
                      verticalAlign="top" 
                      height={36} 
                      iconType="circle" 
                      formatter={(value) => {
                        if (value === 'faturamento') return 'Total Faturado (VGV)';
                        if (value === 'comissaoEmpresa') return 'Receita (Comissão da Empresa)';
                        if (value === 'comissaoVendedor') return 'Despesa (Comissão Paga ao Vendedor)';
                        return value;
                      }} 
                    />
                    <Bar
                      yAxisId="left"
                      dataKey="faturamento"
                      name="faturamento"
                      fill={theme.palette.primary.main}
                      radius={[4, 4, 0, 0]}
                      maxBarSize={40}
                    />
                    <Bar
                      yAxisId="right"
                      dataKey="comissaoEmpresa"
                      name="comissaoEmpresa"
                      fill={theme.palette.info.main}
                      radius={[4, 4, 0, 0]}
                      maxBarSize={40}
                    />
                    <Bar
                      yAxisId="right"
                      dataKey="comissaoVendedor"
                      name="comissaoVendedor"
                      fill={theme.palette.success.main}
                      radius={[4, 4, 0, 0]}
                      maxBarSize={40}
                    />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </Box>
          </Paper>
        </Grid>
      </Grid>

      {/* Gráfico de Desempenho e Cancelamentos por Vendedor */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid size={{ xs: 12 }}>
          <Paper
            elevation={0}
            sx={{
              p: 3,
              borderRadius: 4,
              border: `1px solid ${theme.palette.mode === 'dark' ? '#334155' : '#e2e8f0'}`,
              background: theme.palette.mode === 'dark' ? '#1e293b' : '#ffffff'
            }}
          >
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
              <Typography
                variant="h6"
                sx={{
                  fontWeight: 700,
                  fontFamily: 'Outfit, sans-serif',
                  color: theme.palette.mode === 'dark' ? '#f8fafc' : '#0f172a'
                }}
              >
                Evolução Mensal & Taxa de Cancelamento
              </Typography>
              <FormControl size="small" sx={{ minWidth: 220 }}>
                <InputLabel id="select-vendedor-label">Vendedor / Corretor</InputLabel>
                <Select
                  labelId="select-vendedor-label"
                  value={vendedorSelecionadoId}
                  label="Vendedor / Corretor"
                  onChange={(e) => setVendedorSelecionadoId(e.target.value)}
                  sx={{ borderRadius: 2 }}
                >
                  <MenuItem value="todos">Todos os Vendedores</MenuItem>
                  {vendedores.map(v => (
                    <MenuItem key={v.id} value={v.id}>{v.nome}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>
            
            <Box sx={{ width: '100%', height: 350 }}>
              {dadosDesempenhoVendedor.length === 0 ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                  <Typography sx={{ color: '#64748b' }}>Sem dados suficientes para gerar gráficos</Typography>
                </Box>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={dadosDesempenhoVendedor} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={theme.palette.mode === 'dark' ? '#334155' : '#e2e8f0'} vertical={false} />
                    <XAxis
                      dataKey="nomeMes"
                      stroke={theme.palette.mode === 'dark' ? '#94a3b8' : '#64748b'}
                      fontSize={11}
                      tickLine={false}
                      tick={{ fill: theme.palette.mode === 'dark' ? '#cbd5e1' : '#475569' }}
                    />
                    <YAxis
                      yAxisId="left"
                      stroke={theme.palette.mode === 'dark' ? '#94a3b8' : '#64748b'}
                      fontSize={11}
                      tickFormatter={formatarMoedaEixo}
                      tickLine={false}
                    />
                    <YAxis
                      yAxisId="right"
                      orientation="right"
                      stroke={theme.palette.error.main}
                      fontSize={11}
                      tickFormatter={(val) => `${val}%`}
                      tickLine={false}
                    />
                    <ChartTooltip
                      formatter={(value: any, name: any, props: any) => {
                        if (name === 'volumeVendidoAtivo') return [`${formatarMoeda(value)} (${props.payload.qtdVendidoAtivo} cotas)`, 'Volume Vendido (Ativo)'];
                        if (name === 'volumeCancelado') return [`${formatarMoeda(value)} (${props.payload.qtdCancelado} cotas)`, 'Volume Cancelado'];
                        if (name === 'taxaCancelamento') return [`${value}%`, 'Taxa de Cancelamento'];
                        return [value, name];
                      }}
                      contentStyle={{
                        backgroundColor: theme.palette.mode === 'dark' ? '#0f172a' : '#ffffff',
                        borderColor: theme.palette.mode === 'dark' ? '#334155' : '#e2e8f0',
                        borderRadius: 8,
                        color: theme.palette.mode === 'dark' ? '#f1f5f9' : '#0f172a'
                      }}
                    />
                    <Legend 
                      verticalAlign="top" 
                      height={36} 
                      iconType="circle" 
                      formatter={(value) => {
                        if (value === 'volumeVendidoAtivo') return 'Vendas Ativas (VGV)';
                        if (value === 'volumeCancelado') return 'Vendas Canceladas (VGV)';
                        if (value === 'taxaCancelamento') return 'Taxa de Cancelamentos (%)';
                        return value;
                      }} 
                    />
                    <Bar
                      yAxisId="left"
                      dataKey="volumeVendidoAtivo"
                      name="volumeVendidoAtivo"
                      stackId="a"
                      fill={theme.palette.primary.main}
                      radius={[0, 0, 0, 0]}
                      maxBarSize={40}
                    />
                    <Bar
                      yAxisId="left"
                      dataKey="volumeCancelado"
                      name="volumeCancelado"
                      stackId="a"
                      fill={theme.palette.error.main}
                      radius={[4, 4, 0, 0]}
                      maxBarSize={40}
                    />
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="taxaCancelamento"
                      name="taxaCancelamento"
                      stroke={theme.palette.error.main}
                      strokeWidth={3}
                      dot={{ r: 4, strokeWidth: 1 }}
                      activeDot={{ r: 6 }}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              )}
            </Box>
          </Paper>
        </Grid>
      </Grid>

      {/* Tabela do Ranking e Comparativo */}
      <Grid container spacing={3}>
        <Grid size={{ xs: 12 }}>
          <TableContainer
            component={Paper}
            sx={{
              borderRadius: 4,
              border: `1px solid ${theme.palette.mode === 'dark' ? '#1f2937' : '#e5e7eb'}`,
              background: theme.palette.mode === 'dark' ? '#111827' : '#ffffff',
              overflow: 'hidden'
            }}
          >
            <Box sx={{ p: 2.5, borderBottom: `1px solid ${theme.palette.mode === 'dark' ? '#1f2937' : '#e5e7eb'}`, display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <GroupIcon sx={{ color: 'primary.main' }} />
              <Typography variant="h6" sx={{ fontFamily: 'Outfit, sans-serif', fontWeight: 700, fontSize: '1.1rem' }}>
                Ranking e Desempenho Detalhado
              </Typography>
            </Box>
            <Table size="small">
              <TableHead sx={{ bgcolor: theme.palette.mode === 'dark' ? '#1f2937' : '#f9fafb' }}>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700, py: 1.5, width: 80 }} align="center">Posição</TableCell>
                  <TableCell sx={{ fontWeight: 700, py: 1.5 }}>Vendedor / Corretor</TableCell>
                  <TableCell sx={{ fontWeight: 700, py: 1.5, width: 140 }} align="center">Status</TableCell>
                  <TableCell sx={{ fontWeight: 700, py: 1.5 }} align="right">Qtd Vendas</TableCell>
                  <TableCell sx={{ fontWeight: 700, py: 1.5 }} align="right">Faturado (VGV)</TableCell>
                  <TableCell sx={{ fontWeight: 700, py: 1.5 }} align="right">Comissão (Empresa)</TableCell>
                  <TableCell sx={{ fontWeight: 700, py: 1.5 }} align="right">Comissão (Vendedor)</TableCell>
                  <TableCell sx={{ fontWeight: 700, py: 1.5, width: 250 }}>Performance Relativa</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {ranking.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} align="center" sx={{ py: 6, color: '#64748b' }}>
                      Nenhuma venda ativa registrada no período para cálculo de ranking.
                    </TableCell>
                  </TableRow>
                ) : (
                  ranking.map((linha, index) => {
                    const pctPerformance = Math.round((linha.faturamento / maxFaturamento) * 100);
                    const isTop3 = index < 3;
                    
                    return (
                      <TableRow
                        key={linha.vendedorId}
                        sx={{
                          '&:hover': {
                            bgcolor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.01)' : 'rgba(0,0,0,0.01)'
                          }
                        }}
                      >
                        <TableCell align="center">
                          <Chip
                            label={`${index + 1}º`}
                            size="small"
                            color={index === 0 ? 'secondary' : index === 1 ? 'primary' : index === 2 ? 'default' : 'default'}
                            variant={isTop3 ? 'filled' : 'outlined'}
                            sx={{
                              fontWeight: 800,
                              borderRadius: 1.5,
                              fontSize: '0.75rem',
                              minWidth: 42,
                              bgcolor: index === 0 ? '#f59e0b' : index === 1 ? '#6366f1' : index === 2 ? '#94a3b8' : 'transparent',
                              color: isTop3 ? '#ffffff' : 'text.secondary'
                            }}
                          />
                        </TableCell>
                        <TableCell sx={{ fontWeight: 650 }}>{linha.vendedorNome}</TableCell>
                        <TableCell align="center">
                          <Chip
                            label={linha.ativo ? 'ATIVO' : 'INATIVO'}
                            size="small"
                            variant="outlined"
                            color={linha.ativo ? 'success' : 'default'}
                            sx={{ fontWeight: 700, fontSize: '0.62rem', height: 18 }}
                          />
                        </TableCell>
                        <TableCell align="right" sx={{ fontWeight: 600 }}>{linha.qtdVendas}</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 700, color: 'text.primary' }}>
                          {formatarMoeda(linha.faturamento)}
                        </TableCell>
                        <TableCell align="right" sx={{ fontWeight: 700, color: 'info.main' }}>
                          {formatarMoeda(linha.comissaoEmpresa)}
                        </TableCell>
                        <TableCell align="right" sx={{ fontWeight: 700, color: 'success.main' }}>
                          {formatarMoeda(linha.comissaoVendedor)}
                        </TableCell>
                        <TableCell>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                            <Box sx={{ width: '100%', mr: 1 }}>
                              <LinearProgress
                                variant="determinate"
                                value={pctPerformance}
                                color={index === 0 ? 'secondary' : 'primary'}
                                sx={{
                                  height: 8,
                                  borderRadius: 4,
                                  bgcolor: theme.palette.mode === 'dark' ? '#1f2937' : '#e5e7eb',
                                  '& .MuiLinearProgress-bar': { borderRadius: 4 }
                                }}
                              />
                            </Box>
                            <Typography variant="caption" sx={{ fontWeight: 700, minWidth: 32, color: 'text.secondary' }}>
                              {pctPerformance}%
                            </Typography>
                          </Box>
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
