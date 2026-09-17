import React, { useMemo } from 'react';
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
import MonetizationOnIcon from '@mui/icons-material/MonetizationOn';
import PeopleIcon from '@mui/icons-material/People';
import HistoryIcon from '@mui/icons-material/History';
import { type LancamentoVenda, type Vendedor } from '../types';
import { formatarMoeda, formatarChaveMesExibicao } from '../utils/formatters';

interface RelatorioRetencaoLTVProps {
  vendas: LancamentoVenda[];
  vendedores: Vendedor[];
  dataInicio: string; // formato YYYY-MM-DD
  dataFim: string; // formato YYYY-MM-DD
}

interface DadosClienteLTV {
  vendaId: string;
  cliente: string;
  vendedorNome: string;
  dataVenda: string;
  statusCliente: string;
  ltvRealizado: number;
  parcelasPagasNomes: string[];
  mesCancelamento: string | null;
}

export const RelatorioRetencaoLTV: React.FC<RelatorioRetencaoLTVProps> = ({
  vendas,
  vendedores,
  dataInicio,
  dataFim
}) => {
  const theme = useTheme();

  // Processamento e cálculo de LTV / Retenção
  const { kpis, listaClientes } = useMemo(() => {
    let totalClientes = 0;
    let clientesCancelados = 0;
    let somaLtvRealizadoGeral = 0;

    const lista: DadosClienteLTV[] = [];

    vendas.forEach(v => {
      const dataDaVenda = v.dataVenda || (v.mesInicio ? `${v.mesInicio}-01` : '');
      if (dataDaVenda && dataDaVenda >= dataInicio && dataDaVenda <= dataFim) {
        totalClientes++;
        
        let ltvDesteCliente = 0;
        const parcelasPagas: string[] = [];
        let mesCancelamentoEncontrado: string | null = null;
        
        // As chaves no projecaoMensal estão ordenadas cronologicamente se iterarmos após ordenar
        const mesesProjecao = Object.keys(v.projecaoMensal || {}).sort();
        
        mesesProjecao.forEach((mesChave, index) => {
          const celula = v.projecaoMensal[mesChave];
          
          if (celula.status === 'Paga') {
            ltvDesteCliente += (celula.comissaoGerada || 0);
            parcelasPagas.push(`${index + 1}ª`);
          }
          
          // Se identificarmos que o status está cancelado nesta célula (e ainda não tínhamos registrado)
          if (celula.status === 'Cancelada' && !mesCancelamentoEncontrado) {
            mesCancelamentoEncontrado = mesChave;
          }
        });

        const cancelou = v.statusCliente?.toLowerCase() === 'cancelado' || mesCancelamentoEncontrado !== null;
        if (cancelou) {
          clientesCancelados++;
        }

        somaLtvRealizadoGeral += ltvDesteCliente;

        const vendedorNome = vendedores.find(vend => vend.id === v.vendedorId)?.nome || 'Sem Vendedor';

        lista.push({
          vendaId: v.id,
          cliente: v.cliente,
          vendedorNome,
          dataVenda: dataDaVenda,
          statusCliente: cancelou ? 'Cancelado' : 'Ativo',
          ltvRealizado: ltvDesteCliente,
          parcelasPagasNomes: parcelasPagas,
          mesCancelamento: mesCancelamentoEncontrado || (cancelou ? 'Indefinido' : null)
        });
      }
    });

    const taxaCancelamento = totalClientes > 0 ? (clientesCancelados / totalClientes) * 100 : 0;
    const ltvMedio = totalClientes > 0 ? somaLtvRealizadoGeral / totalClientes : 0;

    // Ordenar a lista: Primeiro cancelados, depois ativos. Dentro de cancelados, maior LTV primeiro.
    lista.sort((a, b) => {
      if (a.statusCliente === 'Cancelado' && b.statusCliente !== 'Cancelado') return -1;
      if (a.statusCliente !== 'Cancelado' && b.statusCliente === 'Cancelado') return 1;
      return b.ltvRealizado - a.ltvRealizado;
    });

    return {
      kpis: {
        totalClientes,
        clientesCancelados,
        taxaCancelamento,
        ltvMedio,
        somaLtvRealizadoGeral
      },
      listaClientes: lista
    };
  }, [vendas, vendedores, dataInicio, dataFim]);

  const listaCancelados = listaClientes.filter(c => c.statusCliente === 'Cancelado');

  return (
    <Box sx={{ p: 1 }}>
      {/* Título */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" sx={{ fontFamily: 'Outfit, sans-serif', fontWeight: 700 }}>
          Retenção e LTV (Life Time Value)
        </Typography>
        <Typography variant="caption" sx={{ color: '#94a3b8' }}>
          Análise de valor vitalício gerado pelos clientes e histórico detalhado de cancelamentos.
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
                Média de receita gerada por cliente cadastrado
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
            }}
          >
            <CardContent sx={{ p: 2.25, '&:last-child': { pb: 2.25 } }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
                <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700, textTransform: 'uppercase' }}>
                  Taxa de Cancelamento (Churn)
                </Typography>
                <Avatar sx={{ bgcolor: 'rgba(239, 68, 68, 0.15)', color: 'error.main', width: 36, height: 36 }}>
                  <TrendingDownIcon sx={{ fontSize: 20 }} />
                </Avatar>
              </Box>
              <Typography variant="h6" sx={{ fontWeight: 800, color: 'error.main' }}>
                {kpis.taxaCancelamento.toFixed(2)}%
              </Typography>
              <Typography variant="caption" sx={{ color: '#94a3b8', display: 'block', mt: 0.5 }}>
                {kpis.clientesCancelados} clientes cancelados de {kpis.totalClientes} totais
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
            }}
          >
            <CardContent sx={{ p: 2.25, '&:last-child': { pb: 2.25 } }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
                <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700, textTransform: 'uppercase' }}>
                  Total de Clientes no Período
                </Typography>
                <Avatar sx={{ bgcolor: 'rgba(59, 130, 246, 0.15)', color: 'info.main', width: 36, height: 36 }}>
                  <PeopleIcon sx={{ fontSize: 20 }} />
                </Avatar>
              </Box>
              <Typography variant="h6" sx={{ fontWeight: 800, color: 'text.primary' }}>
                {kpis.totalClientes}
              </Typography>
              <Typography variant="caption" sx={{ color: '#94a3b8', display: 'block', mt: 0.5 }}>
                Cadastrados no intervalo filtrado
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
                Toda a comissão recebida destes clientes
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Tabela de Cancelamentos Detalhada */}
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
              <TrendingDownIcon sx={{ color: 'error.main' }} />
              <Typography variant="h6" sx={{ fontFamily: 'Outfit, sans-serif', fontWeight: 700, fontSize: '1.1rem' }}>
                Histórico de Cancelamentos e Parcelas Pagas (LTV Efetivado)
              </Typography>
            </Box>
            <Table size="small">
              <TableHead sx={{ bgcolor: theme.palette.mode === 'dark' ? '#1f2937' : '#f9fafb' }}>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700, py: 1.5 }}>Cliente</TableCell>
                  <TableCell sx={{ fontWeight: 700, py: 1.5 }}>Vendedor / Corretor</TableCell>
                  <TableCell sx={{ fontWeight: 700, py: 1.5 }} align="center">Data da Venda</TableCell>
                  <TableCell sx={{ fontWeight: 700, py: 1.5 }} align="center">Mês Cancelado</TableCell>
                  <TableCell sx={{ fontWeight: 700, py: 1.5 }}>Parcelas que Foram Pagas</TableCell>
                  <TableCell sx={{ fontWeight: 700, py: 1.5 }} align="right">LTV Realizado (R$)</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {listaCancelados.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} align="center" sx={{ py: 6, color: '#64748b' }}>
                      Nenhum cancelamento registrado para os clientes cadastrados neste período. 🎉
                    </TableCell>
                  </TableRow>
                ) : (
                  listaCancelados.map((linha) => {
                    return (
                      <TableRow
                        key={linha.vendaId}
                        sx={{
                          '&:hover': {
                            bgcolor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.01)' : 'rgba(0,0,0,0.01)'
                          }
                        }}
                      >
                        <TableCell sx={{ fontWeight: 650 }}>{linha.cliente}</TableCell>
                        <TableCell sx={{ color: 'text.secondary' }}>{linha.vendedorNome}</TableCell>
                        <TableCell align="center" sx={{ color: 'text.secondary' }}>
                          {linha.dataVenda ? new Date(linha.dataVenda + 'T00:00:00').toLocaleDateString('pt-BR') : '-'}
                        </TableCell>
                        <TableCell align="center">
                          <Chip
                            label={linha.mesCancelamento && linha.mesCancelamento !== 'Indefinido' ? formatarChaveMesExibicao(linha.mesCancelamento) : 'Indefinido'}
                            size="small"
                            color="error"
                            variant="outlined"
                            sx={{ fontWeight: 700, fontSize: '0.65rem' }}
                          />
                        </TableCell>
                        <TableCell>
                          {linha.parcelasPagasNomes.length > 0 ? (
                            <Tooltip title={linha.parcelasPagasNomes.join(', ')}>
                              <Typography variant="body2" sx={{ fontWeight: 500, color: 'success.main' }}>
                                {linha.parcelasPagasNomes.length} parcela(s) paga(s)
                                <Typography component="span" variant="caption" sx={{ ml: 1, color: 'text.disabled' }}>
                                  ({linha.parcelasPagasNomes.length <= 3 ? linha.parcelasPagasNomes.join(', ') : linha.parcelasPagasNomes.slice(0, 3).join(', ') + '...'})
                                </Typography>
                              </Typography>
                            </Tooltip>
                          ) : (
                            <Typography variant="body2" sx={{ color: 'text.disabled', fontStyle: 'italic' }}>
                              Nenhuma parcela paga
                            </Typography>
                          )}
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
