import React from 'react';
import { Grid, Paper, Box, Typography, useTheme } from '@mui/material';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import MonetizationOnIcon from '@mui/icons-material/MonetizationOn';
import PeopleIcon from '@mui/icons-material/People';
import CancelIcon from '@mui/icons-material/Cancel';
import type { LancamentoVenda } from '../types';
import { formatarMoeda } from '../utils/formatters';

interface KPISectionProps {
  vendas: LancamentoVenda[];
  dataInicio: string;
  dataFim: string;
}

export const KPISection: React.FC<KPISectionProps> = ({ vendas, dataInicio, dataFim }) => {
  const theme = useTheme();

  // Chaves de início e fim no formato YYYY-MM
  const mesInicioChave = dataInicio.substring(0, 7);
  const mesFimChave = dataFim.substring(0, 7);

  // Cálculos dinâmicos baseados nas parcelas do período filtrado
  let volumeTotalVendas = 0;
  let receitaTotalComissoes = 0;
  let comissoesRecebidasNoPeriodo = 0;
  const clientesAtivosSet = new Set<string>();
  const clientesCanceladosSet = new Set<string>();
  let valorTotalCancelado = 0;

  vendas.forEach((v) => {
    // 1. Acumulador Mensal de Fluxo de Caixa (Comissões e Status no Período)
    Object.keys(v.projecaoMensal).forEach((mes) => {
      if (mes >= mesInicioChave && mes <= mesFimChave) {
        const celula = v.projecaoMensal[mes];
        if (celula) {
          if (celula.status !== 'Cancelada' && celula.valorVenda > 0) {
            receitaTotalComissoes += celula.comissaoGerada || 0;
            clientesAtivosSet.add(v.cliente);
            if (celula.status === 'Recebida') {
              comissoesRecebidasNoPeriodo += celula.comissaoGerada || 0;
            }
          } else if (celula.status === 'Cancelada') {
            clientesCanceladosSet.add(v.cliente);
            valorTotalCancelado += celula.valorParcela || v.valorParcela || 0;
          }
        }
      }
    });

    // 2. Acumulador de Faturamento (VGV - Volume Geral de Vendas no momento do fechamento)
    const dataDaVenda = v.dataVenda || (v.mesInicio ? `${v.mesInicio}-01` : '');
    if (dataDaVenda && dataDaVenda >= dataInicio && dataDaVenda <= dataFim) {
      if (v.statusCliente !== 'Cancelado') {
        volumeTotalVendas += v.valorVenda; // Computa o valor de crédito APENAS 1 VEZ por venda
      }
    }
  });

  const totalClientesAtivos = clientesAtivosSet.size;
  const totalClientesCancelados = clientesCanceladosSet.size;

  const kpis = [
    {
      title: 'Volume de Vendas Ativas',
      value: formatarMoeda(volumeTotalVendas),
      icon: <TrendingUpIcon sx={{ fontSize: 20 }} />,
      color: theme.palette.primary.main,
      gradient: `linear-gradient(135deg, ${theme.palette.primary.dark} 0%, ${theme.palette.primary.main} 100%)`,
      description: 'Total de faturamento ativo no período'
    },
    {
      title: 'Receita Total de Comissões',
      value: formatarMoeda(receitaTotalComissoes),
      icon: <MonetizationOnIcon sx={{ fontSize: 20 }} />,
      color: theme.palette.success.main,
      gradient: `linear-gradient(135deg, ${theme.palette.success.dark} 0%, ${theme.palette.success.main} 100%)`,
      description: 'Total de comissões ativas no período'
    },
    {
      title: 'Parcelas Recebidas',
      value: formatarMoeda(comissoesRecebidasNoPeriodo),
      icon: <MonetizationOnIcon sx={{ fontSize: 20 }} />,
      color: theme.palette.warning.main,
      gradient: `linear-gradient(135deg, ${theme.palette.warning.dark} 0%, ${theme.palette.warning.main} 100%)`,
      description: 'Comissões marcadas como Recebida no período'
    },
    {
      title: 'Clientes Ativos',
      value: totalClientesAtivos,
      icon: <PeopleIcon sx={{ fontSize: 20 }} />,
      color: theme.palette.info.main,
      gradient: `linear-gradient(135deg, ${theme.palette.info.dark} 0%, ${theme.palette.info.main} 100%)`,
      description: 'Vendas com parcelas ativas no período'
    },
    {
      title: 'Clientes Cancelados',
      value: `${totalClientesCancelados} (${formatarMoeda(valorTotalCancelado)})`,
      icon: <CancelIcon sx={{ fontSize: 20 }} />,
      color: theme.palette.error.main,
      gradient: `linear-gradient(135deg, ${theme.palette.error.dark} 0%, ${theme.palette.error.main} 100%)`,
      description: 'Inativos e valor cancelado no período'
    }
  ];

  return (
    <Grid container spacing={2} sx={{ mb: 4 }}>
      {kpis.map((kpi, index) => (
        <Grid size={{ xs: 12, sm: 6, md: 4, lg: 2.4 }} key={index}>
          <Paper
            elevation={0}
            sx={{
              p: 1.5,
              borderRadius: 2.5,
              background: theme.palette.mode === 'dark' ? '#1e293b' : '#ffffff',
              border: `1px solid ${theme.palette.mode === 'dark' ? '#334155' : '#e2e8f0'}`,
              position: 'relative',
              overflow: 'hidden',
              transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.3s',
              '&:hover': {
                transform: 'translateY(-2px)',
                boxShadow: theme.palette.mode === 'dark' 
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
                     fontWeight: 600,
                     color: theme.palette.mode === 'dark' ? '#94a3b8' : '#64748b',
                     fontSize: '0.72rem',
                     textTransform: 'uppercase',
                     letterSpacing: '0.5px'
                   }}
                 >
                  {kpi.title}
                </Typography>
                 <Typography
                   variant="h6"
                   sx={{
                     fontWeight: 800,
                     fontFamily: 'Outfit, sans-serif',
                     mt: 0.2,
                     color: theme.palette.mode === 'dark' ? '#f8fafc' : '#0f172a',
                     letterSpacing: '-0.5px',
                     fontSize: '1.2rem'
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
                  transition: 'transform 0.3s ease'
                }}
              >
                {kpi.icon}
              </Box>
            </Box>
            
            <Typography
              variant="caption"
              sx={{
                color: theme.palette.mode === 'dark' ? '#64748b' : '#94a3b8',
                display: 'block',
                fontSize: '0.68rem',
                lineHeight: 1.2
              }}
            >
              {kpi.description}
            </Typography>
          </Paper>
        </Grid>
      ))}
    </Grid>
  );
};
