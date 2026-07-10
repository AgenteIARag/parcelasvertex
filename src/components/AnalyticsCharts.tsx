import React from 'react';
import { Box, Grid, Paper, Typography, useTheme } from '@mui/material';
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as ChartTooltip,
  Legend,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { type LancamentoVenda } from '../types';
import { formatarMoeda, formatarMoedaEixo, formatarChaveMesExibicao } from '../utils/formatters';

interface AnalyticsChartsProps {
  vendas: LancamentoVenda[];
}

export const AnalyticsCharts: React.FC<AnalyticsChartsProps> = ({ vendas }) => {
  const theme = useTheme();



  // Gera dinamicamente a lista de chaves "YYYY-MM" de Janeiro/2026 até o faturamento ativo mais distante
  const obterMesesEvolucao = (): string[] => {
    let dataMax = '2026-12-15';
    vendas.forEach((venda) => {
      Object.values(venda.projecaoMensal).forEach((mesObj) => {
        if (mesObj.valorVenda > 0 && mesObj.status !== 'Cancelada' && mesObj.dataVencimento > dataMax) {
          dataMax = mesObj.dataVencimento;
        }
      });
    });

    const [anoMaxStr, mesMaxStr] = dataMax.split('-');
    const anoMax = Number(anoMaxStr);
    const mesMax = Number(mesMaxStr);

    const meses: string[] = [];
    let anoAtual = 2026;
    let mesAtual = 1;

    while (anoAtual < anoMax || (anoAtual === anoMax && mesAtual <= mesMax)) {
      const mesStr = String(mesAtual).padStart(2, '0');
      meses.push(`${anoAtual}-${mesStr}`);
      mesAtual++;
      if (mesAtual > 12) {
        mesAtual = 1;
        anoAtual++;
      }
    }
    return meses;
  };

  const chavesMesesGrafico = obterMesesEvolucao();

  // 1. Preparar dados para o gráfico de evolução mensal
  const dadosMensais = chavesMesesGrafico.map((mesChave) => {
    let totalVendaMes = 0;
    let totalComissaoMes = 0;

    vendas.forEach((v) => {
      const celula = v.projecaoMensal[mesChave];
      if (celula && celula.status !== 'Cancelada') {
        totalVendaMes += celula.valorVenda || 0;
        totalComissaoMes += celula.comissaoGerada || 0;
      }
    });

    return {
      name: formatarChaveMesExibicao(mesChave),
      Vendas: totalVendaMes,
      Comissões: totalComissaoMes
    };
  });

  // 2. Preparar dados para o gráfico de distribuição por segmento
  const segmentosMap: Record<string, number> = {
    'Imóveis': 0,
    'Autos Leves': 0,
    'Pesados': 0
  };

  vendas.forEach((v) => {
    segmentosMap[v.segmento] += v.totalVendas;
  });

  const dadosSegmento = Object.keys(segmentosMap).map((key) => ({
    name: key,
    value: segmentosMap[key]
  })).filter(d => d.value > 0);

  // Paleta de cores para os segmentos
  const CORES_SEGMENTOS = [
    theme.palette.primary.main,    // Imóveis - Azul/Indigo
    theme.palette.success.main,    // Autos Leves - Verde
    theme.palette.warning.main     // Pesados - Âmbar
  ];



  return (
    <Grid container spacing={4}>
      {/* Gráfico 1: Evolução de Vendas e Comissões */}
      <Grid size={{ xs: 12, lg: 8 }}>
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
            Evolução Mensal: Vendas vs. Comissões
          </Typography>
          <Box sx={{ width: '100%', height: 350 }}>
            {vendas.length === 0 ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                <Typography sx={{ color: '#64748b' }}>Sem dados suficientes para gerar gráficos</Typography>
              </Box>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={dadosMensais} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={theme.palette.mode === 'dark' ? '#334155' : '#e2e8f0'} />
                  <XAxis
                    dataKey="name"
                    stroke={theme.palette.mode === 'dark' ? '#94a3b8' : '#64748b'}
                    fontSize={12}
                    tickLine={false}
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
                    formatter={(value: any, name: any) => [formatarMoeda(value), name]}
                    contentStyle={{
                      backgroundColor: theme.palette.mode === 'dark' ? '#0f172a' : '#ffffff',
                      borderColor: theme.palette.mode === 'dark' ? '#334155' : '#e2e8f0',
                      borderRadius: 8,
                      color: theme.palette.mode === 'dark' ? '#f1f5f9' : '#0f172a'
                    }}
                  />
                  <Legend verticalAlign="top" height={36} iconType="circle" />
                  <Bar
                    yAxisId="left"
                    dataKey="Vendas"
                    name="Volume de Vendas"
                    fill={theme.palette.primary.main}
                    radius={[4, 4, 0, 0]}
                    maxBarSize={45}
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="Comissões"
                    name="Receita de Comissões"
                    stroke={theme.palette.success.main}
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

      {/* Gráfico 2: Distribuição de Vendas por Segmento */}
      <Grid size={{ xs: 12, lg: 4 }}>
        <Paper
          elevation={0}
          sx={{
            p: 3,
            borderRadius: 4,
            border: `1px solid ${theme.palette.mode === 'dark' ? '#334155' : '#e2e8f0'}`,
            background: theme.palette.mode === 'dark' ? '#1e293b' : '#ffffff',
            display: 'flex',
            flexDirection: 'column',
            height: '100%'
          }}
        >
          <Typography
            variant="h6"
            sx={{
              fontWeight: 700,
              fontFamily: 'Outfit, sans-serif',
              mb: 1,
              color: theme.palette.mode === 'dark' ? '#f8fafc' : '#0f172a'
            }}
          >
            Vendas por Segmento
          </Typography>
          <Typography variant="caption" sx={{ color: '#94a3b8', mb: 3 }}>
            Proporção do volume total simulado
          </Typography>
          
          <Box sx={{ width: '100%', height: 260, position: 'relative', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            {dadosSegmento.length === 0 ? (
              <Typography sx={{ color: '#64748b' }}>Sem dados cadastrados</Typography>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={dadosSegmento}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={85}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {dadosSegmento.map((_entry, index) => (
                      <Cell key={`cell-${index}`} fill={CORES_SEGMENTOS[index % CORES_SEGMENTOS.length]} />
                    ))}
                  </Pie>
                  <ChartTooltip
                    formatter={(value: any) => formatarMoeda(value)}
                    contentStyle={{
                      backgroundColor: theme.palette.mode === 'dark' ? '#0f172a' : '#ffffff',
                      borderColor: theme.palette.mode === 'dark' ? '#334155' : '#e2e8f0',
                      borderRadius: 8
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </Box>

          {/* Legenda Customizada com Valores */}
          <Box sx={{ mt: 'auto', pt: 2 }}>
            {dadosSegmento.map((item, index) => {
              const totalVendasGlobal = dadosSegmento.reduce((acc, d) => acc + d.value, 0);
              const pct = totalVendasGlobal > 0 ? (item.value / totalVendasGlobal) * 100 : 0;
              return (
                <Box
                  key={item.name}
                  sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    py: 0.8,
                    borderBottom: index < dadosSegmento.length - 1 ? '1px dashed rgba(255,255,255,0.05)' : 'none'
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    <Box
                      sx={{
                        width: 12,
                        height: 12,
                        borderRadius: '50%',
                        bgcolor: CORES_SEGMENTOS[index % CORES_SEGMENTOS.length]
                      }}
                    />
                    <Typography variant="body2" sx={{ fontWeight: 550, color: theme.palette.mode === 'dark' ? '#cbd5e1' : '#475569' }}>
                      {item.name}
                    </Typography>
                  </Box>
                  <Box sx={{ textAlign: 'right' }}>
                    <Typography variant="body2" sx={{ fontWeight: 600, color: theme.palette.mode === 'dark' ? '#f1f5f9' : '#1e293b' }}>
                      {formatarMoeda(item.value)}
                    </Typography>
                    <Typography variant="caption" sx={{ color: '#64748b', display: 'block' }}>
                      {pct.toFixed(1)}% do total
                    </Typography>
                  </Box>
                </Box>
              );
            })}
          </Box>
        </Paper>
      </Grid>
    </Grid>
  );
};
