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
  useTheme
} from '@mui/material';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import PaymentsIcon from '@mui/icons-material/Payments';
import GroupIcon from '@mui/icons-material/Group';
import LeaderboardIcon from '@mui/icons-material/Leaderboard';
import { type LancamentoVenda, type Vendedor } from '../types';
import { formatarMoeda } from '../utils/formatters';

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

  // Consolidação de métricas por vendedor no período filtrado
  const dadosVendedores = useMemo(() => {
    const mesInicioChave = dataInicio.substring(0, 7);
    const mesFimChave = dataFim.substring(0, 7);

    return vendedores.map((vendedor) => {
      let faturamentoTotal = 0;
      let comissaoTotal = 0;
      const vendasSet = new Set<string>();

      // Filtra as vendas vinculadas a este vendedor
      const vendasDoVend = vendas.filter(v => v.vendedorId === vendedor.id);

      vendasDoVend.forEach((venda) => {
        const pctVendedor = Number(vendedor.percentualComissao || 0);
        const pctMensalVendedor = pctVendedor / venda.qtdParcelas;
        
        let temParcelaAtivaNoPeriodo = false;

        Object.keys(venda.projecaoMensal).forEach((mesChave) => {
          const celula = venda.projecaoMensal[mesChave];
          if (celula && celula.valorVenda > 0 && celula.status !== 'Cancelada') {
            // Verifica se está dentro do filtro de período
            if (mesChave >= mesInicioChave && mesChave <= mesFimChave) {
              faturamentoTotal += celula.valorParcela || (venda.valorVenda / venda.qtdParcelas); // Valor faturado no mês
              const comissaoParcela = (venda.valorVenda * (pctMensalVendedor / 100));
              comissaoTotal += comissaoParcela;
              temParcelaAtivaNoPeriodo = true;
            }
          }
        });

        if (temParcelaAtivaNoPeriodo) {
          vendasSet.add(venda.id);
        }
      });

      return {
        vendedorId: vendedor.id,
        vendedorNome: vendedor.nome,
        ativo: vendedor.ativo,
        faturamento: faturamentoTotal,
        comissao: Number(comissaoTotal.toFixed(2)),
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
                  <TableCell sx={{ fontWeight: 700, py: 1.5 }} align="right">Total Faturado</TableCell>
                  <TableCell sx={{ fontWeight: 700, py: 1.5 }} align="right">Comissão Gerada</TableCell>
                  <TableCell sx={{ fontWeight: 700, py: 1.5, width: 300 }}>Performance Relativa</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {ranking.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} align="center" sx={{ py: 6, color: '#64748b' }}>
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
                        <TableCell align="right" sx={{ fontWeight: 700, color: 'success.main' }}>
                          {formatarMoeda(linha.comissao)}
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
