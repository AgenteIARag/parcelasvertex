import React from 'react';
import { Grid, Paper, Box, Typography, useTheme } from '@mui/material';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import MonetizationOnIcon from '@mui/icons-material/MonetizationOn';
import PeopleIcon from '@mui/icons-material/People';
import CancelIcon from '@mui/icons-material/Cancel';
import type { LancamentoVenda } from '../types';
import { formatarMoeda, obterChaveMesAtual, obterNomeMesAtual } from '../utils/formatters';

interface KPISectionProps {
  vendas: LancamentoVenda[];
}

export const KPISection: React.FC<KPISectionProps> = ({ vendas }) => {
  const theme = useTheme();

  // Cálculos globais baseados nas projeções preenchidas (ignora parcelas canceladas)
  const volumeTotalVendas = vendas.reduce((acc, v) => acc + v.totalVendas, 0);
  const receitaTotalComissoes = vendas.reduce((acc, v) => acc + v.totalComissoes, 0);
  const totalClientesAtivos = vendas.filter(v => v.statusCliente === 'Ativo').length;

  // Soma de comissões recebidas no mês atual (dinâmico)
  const mesAtualChave = obterChaveMesAtual();
  const nomeMesAtual = obterNomeMesAtual();
  const comissoesRecebidasNoMes = vendas.reduce((acc, v) => {
    const parcelaMes = v.projecaoMensal[mesAtualChave];
    if (parcelaMes && parcelaMes.status === 'Recebida') {
      return acc + (parcelaMes.comissaoGerada || 0);
    }
    return acc;
  }, 0);

  // Clientes cancelados e valor total das parcelas canceladas
  const clientesCancelados = vendas.filter(v => v.statusCliente === 'Cancelado');
  const totalClientesCancelados = clientesCancelados.length;
  
  const valorTotalCancelado = vendas.reduce((acc, v) => {
    const totalParcelas = v.qtdParcelas;
    const parcelasCanceladas = Object.values(v.projecaoMensal).filter(mes => mes.status === 'Cancelada').length;
    if (parcelasCanceladas > 0 && totalParcelas > 0) {
      const valorPorParcela = v.valorVenda / totalParcelas;
      return acc + (valorPorParcela * parcelasCanceladas);
    }
    return acc;
  }, 0);



  const kpis = [
    {
      title: 'Volume de Vendas Ativas',
      value: formatarMoeda(volumeTotalVendas),
      icon: <TrendingUpIcon sx={{ fontSize: 20 }} />,
      color: theme.palette.primary.main,
      gradient: `linear-gradient(135deg, ${theme.palette.primary.dark} 0%, ${theme.palette.primary.main} 100%)`,
      description: 'Total de vendas projetadas ativas'
    },
    {
      title: 'Receita Total de Comissões',
      value: formatarMoeda(receitaTotalComissoes),
      icon: <MonetizationOnIcon sx={{ fontSize: 20 }} />,
      color: theme.palette.success.main,
      gradient: `linear-gradient(135deg, ${theme.palette.success.dark} 0%, ${theme.palette.success.main} 100%)`,
      description: 'Total de comissões ativas projetadas'
    },
    {
      title: `Parcelas Recebidas (${nomeMesAtual})`,
      value: formatarMoeda(comissoesRecebidasNoMes),
      icon: <MonetizationOnIcon sx={{ fontSize: 20 }} />,
      color: theme.palette.warning.main,
      gradient: `linear-gradient(135deg, ${theme.palette.warning.dark} 0%, ${theme.palette.warning.main} 100%)`,
      description: `Comissões Recebidas em ${nomeMesAtual}`
    },
    {
      title: 'Clientes Ativos',
      value: totalClientesAtivos,
      icon: <PeopleIcon sx={{ fontSize: 20 }} />,
      color: theme.palette.info.main,
      gradient: `linear-gradient(135deg, ${theme.palette.info.dark} 0%, ${theme.palette.info.main} 100%)`,
      description: 'Vendas com status Ativo'
    },
    {
      title: 'Clientes Cancelados',
      value: `${totalClientesCancelados} (${formatarMoeda(valorTotalCancelado)})`,
      icon: <CancelIcon sx={{ fontSize: 20 }} />,
      color: theme.palette.error.main,
      gradient: `linear-gradient(135deg, ${theme.palette.error.dark} 0%, ${theme.palette.error.main} 100%)`,
      description: 'Clientes inativos e valor cancelado'
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
