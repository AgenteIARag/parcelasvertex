import React from 'react';
import { Grid, Paper, Box, Typography, useTheme, Chip } from '@mui/material';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import PeopleIcon from '@mui/icons-material/People';
import CancelIcon from '@mui/icons-material/Cancel';
import FlashOnIcon from '@mui/icons-material/FlashOn';
import AutorenewIcon from '@mui/icons-material/Autorenew';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import type { LancamentoVenda } from '../types';
import { formatarMoeda, formatarData } from '../utils/formatters';

interface KPISectionProps {
  vendas: LancamentoVenda[];
  dataInicio: string;
  dataFim: string;
}

export const KPISection: React.FC<KPISectionProps> = ({ vendas, dataInicio, dataFim }) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  // Chaves de início e fim no formato YYYY-MM
  const mesInicioChave = dataInicio.substring(0, 7);
  const mesFimChave = dataFim.substring(0, 7);

  // Cálculos estritamente baseados no período de data estipulado no filtro
  let volumeTotalVendas = 0;
  let volumeNovasVendas = 0;
  let receitaTotalComissoes = 0;
  let comissoesRecebidasNoPeriodo = 0;
  let qtdRecebidas = 0;
  let comissaoNovasVendas = 0;
  let qtdNovasVendas = 0;
  let comissaoRecorrencia = 0;
  let qtdRecorrencia = 0;
  let qtdAReceber = 0;
  const clientesAtivosSet = new Set<string>();
  const clientesCanceladosSet = new Set<string>();
  let valorTotalCancelado = 0;
  let qtdCancelados = 0;

  vendas.forEach((v) => {
    const dataDaVenda = v.dataVenda || (v.mesInicio ? `${v.mesInicio}-01` : '');
    const vendaNoPeriodo = dataDaVenda && dataDaVenda >= dataInicio && dataDaVenda <= dataFim;

    if (v.statusCliente === 'Cancelado') {
      if (vendaNoPeriodo) {
        clientesCanceladosSet.add(v.cliente);
        valorTotalCancelado += v.valorVenda;
        qtdCancelados += 1;
      }
      return;
    }

    if (vendaNoPeriodo) {
      volumeTotalVendas += v.valorVenda;
    }

    const todasParcelasVenda = Object.keys(v.projecaoMensal)
      .filter((m) => { const c = v.projecaoMensal[m]; return c && c.valorVenda > 0; })
      .sort();

    // Acumulador de Fluxo de Caixa para parcelas com vencimento dentro do período selecionado
    Object.keys(v.projecaoMensal).forEach((mes) => {
      if (mes >= mesInicioChave && mes <= mesFimChave) {
        const celula = v.projecaoMensal[mes];
        if (celula) {
          if (celula.status !== 'Cancelada' && celula.valorVenda > 0) {
            const comissao = celula.comissaoGerada || 0;
            receitaTotalComissoes += comissao;
            clientesAtivosSet.add(v.cliente);

            const parcelaIdx = todasParcelasVenda.indexOf(mes) + 1;
            if (parcelaIdx === 1) {
              comissaoNovasVendas += comissao;
              qtdNovasVendas += 1;
              volumeNovasVendas += celula.valorVenda || v.valorVenda;
            } else {
              comissaoRecorrencia += comissao;
              qtdRecorrencia += 1;
            }

            if (celula.recebida || (celula.status as string) === 'Recebida') {
              comissoesRecebidasNoPeriodo += comissao;
              qtdRecebidas += 1;
            } else {
              qtdAReceber += 1;
            }
          } else if (celula.status === 'Cancelada') {
            clientesCanceladosSet.add(v.cliente);
            valorTotalCancelado += celula.valorParcela || v.valorParcela || 0;
            qtdCancelados += 1;
          }
        }
      }
    });
  });

  const totalClientesAtivos = clientesAtivosSet.size;
  const comissaoPendente = Math.max(0, receitaTotalComissoes - comissoesRecebidasNoPeriodo);

  const kpis = [
    {
      title: 'Vendas do Mês (1ª Parc.)',
      value: formatarMoeda(comissaoNovasVendas),
      icon: <FlashOnIcon sx={{ fontSize: 20 }} />,
      color: '#0ea5e9',
      gradient: 'linear-gradient(135deg, #0284c7 0%, #0ea5e9 100%)',
      description: `${qtdNovasVendas} nova(s) venda(s) · VGV: ${formatarMoeda(volumeNovasVendas)}`
    },
    {
      title: 'Recorrência Prevista',
      value: formatarMoeda(comissaoRecorrencia),
      icon: <AutorenewIcon sx={{ fontSize: 20 }} />,
      color: '#a855f7',
      gradient: 'linear-gradient(135deg, #7e22ce 0%, #a855f7 100%)',
      description: `${qtdRecorrencia} parcela(s) recorrentes da carteira`
    },
    {
      title: 'Recebido do Mês',
      value: formatarMoeda(comissoesRecebidasNoPeriodo),
      icon: <CheckCircleIcon sx={{ fontSize: 20 }} />,
      color: '#10b981',
      gradient: 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
      description: `${qtdRecebidas} parcela(s) recebida(s) no período`
    },
    {
      title: 'A Receber (Pendente)',
      value: formatarMoeda(comissaoPendente),
      icon: <HourglassEmptyIcon sx={{ fontSize: 20 }} />,
      color: '#f97316',
      gradient: 'linear-gradient(135deg, #ea580c 0%, #f97316 100%)',
      description: `${qtdAReceber} parcela(s) pendente(s) de liquidação`
    },
    {
      title: 'Cancelados do Mês',
      value: `${qtdCancelados} (${formatarMoeda(valorTotalCancelado)})`,
      icon: <CancelIcon sx={{ fontSize: 20 }} />,
      color: '#ef4444',
      gradient: 'linear-gradient(135deg, #dc2626 0%, #ef4444 100%)',
      description: 'Contratos ou parcelas canceladas no período'
    },
    {
      title: 'Receita Total Comissões',
      value: formatarMoeda(receitaTotalComissoes),
      icon: <AccountBalanceWalletIcon sx={{ fontSize: 20 }} />,
      color: '#10b981',
      gradient: 'linear-gradient(135deg, #047857 0%, #10b981 100%)',
      description: 'Total de novas vendas + recorrência ativa'
    },
    {
      title: 'Volume Geral de Vendas',
      value: formatarMoeda(volumeTotalVendas),
      icon: <TrendingUpIcon sx={{ fontSize: 20 }} />,
      color: '#6366f1',
      gradient: 'linear-gradient(135deg, #4338ca 0%, #6366f1 100%)',
      description: 'Total de crédito faturado no período'
    },
    {
      title: 'Clientes Ativos',
      value: `${totalClientesAtivos} cliente(s)`,
      icon: <PeopleIcon sx={{ fontSize: 20 }} />,
      color: '#06b6d4',
      gradient: 'linear-gradient(135deg, #0891b2 0%, #06b6d4 100%)',
      description: 'Clientes com parcelas ativas no período'
    }
  ];

  return (
    <Box sx={{ mb: 4 }}>
      {/* Banner claro de período ativo */}
      <Box sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 1.5,
        mb: 2.5,
        p: '8px 16px',
        borderRadius: 2,
        bgcolor: isDark ? 'rgba(99, 102, 241, 0.08)' : 'rgba(99, 102, 241, 0.05)',
        border: `1px solid ${isDark ? 'rgba(99, 102, 241, 0.2)' : 'rgba(99, 102, 241, 0.15)'}`,
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <CalendarMonthIcon sx={{ color: '#6366f1', fontSize: 18 }} />
          <Typography variant="body2" sx={{ fontWeight: 700, color: 'text.primary', fontFamily: 'Outfit, sans-serif' }}>
            Período Ativo no Dashboard:
          </Typography>
          <Chip
            label={`${formatarData(dataInicio)} até ${formatarData(dataFim)}`}
            size="small"
            sx={{
              fontWeight: 800,
              fontFamily: 'Outfit, sans-serif',
              bgcolor: isDark ? 'rgba(99, 102, 241, 0.2)' : 'rgba(99, 102, 241, 0.12)',
              color: isDark ? '#a5b4fc' : '#4f46e5',
              border: '1px solid rgba(99, 102, 241, 0.3)',
              fontSize: '0.78rem'
            }}
          />
        </Box>
        <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>
          Todas as métricas abaixo refletem rigorosamente as parcelas e contratos deste período.
        </Typography>
      </Box>

      {/* Grid de KPIs */}
      <Grid container spacing={2}>
        {kpis.map((kpi, index) => (
          <Grid size={{ xs: 12, sm: 6, md: 4, lg: 3 }} key={index}>
            <Paper
              elevation={0}
              sx={{
                p: 2,
                borderRadius: 2.5,
                background: isDark ? '#1e293b' : '#ffffff',
                border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
                position: 'relative',
                overflow: 'hidden',
                transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.3s',
                '&:hover': {
                  transform: 'translateY(-2px)',
                  boxShadow: isDark 
                    ? '0 8px 16px -8px rgba(0, 0, 0, 0.5), 0 0 10px 0 rgba(99, 102, 241, 0.1)' 
                    : '0 8px 16px -8px rgba(99, 102, 241, 0.08)',
                  '& .kpi-icon-container': {
                    transform: 'scale(1.05) rotate(3deg)',
                  }
                }
              }}
            >
              {/* Efeito decorativo de fundo */}
              <Box
                sx={{
                  position: 'absolute',
                  top: -15,
                  right: -15,
                  width: 60,
                  height: 60,
                  borderRadius: '50%',
                  background: kpi.gradient,
                  opacity: 0.08,
                  filter: 'blur(8px)',
                  pointerEvents: 'none'
                }}
              />

              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                <Box>
                  <Typography
                    variant="body2"
                    sx={{ 
                      fontWeight: 700,
                      color: isDark ? '#94a3b8' : '#64748b',
                      fontSize: '0.72rem',
                      textTransform: 'uppercase',
                      letterSpacing: '0.4px',
                      fontFamily: 'Outfit, sans-serif'
                    }}
                  >
                    {kpi.title}
                  </Typography>
                  <Typography
                    variant="h6"
                    sx={{
                      fontWeight: 800,
                      fontFamily: 'Outfit, sans-serif',
                      mt: 0.3,
                      color: isDark ? '#f8fafc' : '#0f172a',
                      letterSpacing: '-0.3px',
                      fontSize: '1.25rem',
                      lineHeight: 1.15
                    }}
                  >
                    {kpi.value}
                  </Typography>
                </Box>
                
                <Box
                  className="kpi-icon-container"
                  sx={{
                    p: 0.8,
                    borderRadius: 2,
                    background: kpi.gradient,
                    color: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 2px 6px rgba(0, 0, 0, 0.12)',
                    transition: 'transform 0.3s ease',
                    flexShrink: 0
                  }}
                >
                  {kpi.icon}
                </Box>
              </Box>
              
              <Typography
                variant="caption"
                sx={{
                  color: isDark ? '#64748b' : '#94a3b8',
                  display: 'block',
                  fontSize: '0.7rem',
                  lineHeight: 1.25,
                  mt: 0.5
                }}
              >
                {kpi.description}
              </Typography>
            </Paper>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
};
