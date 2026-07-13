import React, { useState, useMemo } from 'react';
import {
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Grid,
  Chip,
  useTheme,
  Card,
  CardContent,
  Avatar,
  Tabs,
  Tab
} from '@mui/material';
import PersonIcon from '@mui/icons-material/Person';
import ReceiptIcon from '@mui/icons-material/Receipt';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import TableChartIcon from '@mui/icons-material/TableChart';
import ListAltIcon from '@mui/icons-material/ListAlt';
import { type LancamentoVenda, type Vendedor, type StatusParcela } from '../types';
import { formatarMoeda, formatarChaveMesExibicao } from '../utils/formatters';

interface ComissoesVendedoresProps {
  vendas: LancamentoVenda[];
  vendedores: Vendedor[];
}

interface LinhaComissao {
  id: string; // id da venda + mes
  vendaId: string;
  cliente: string;
  segmento: string;
  tabela: string;
  mesChave: string; // YYYY-MM
  valorVenda: number;
  valorParcela: number;
  status: StatusParcela;
  comissaoMaster: number;
  comissaoVendedor: number;
  parcelaIndex: number;
  qtdParcelas: number;
}

const LISTA_MESES_TIMELINE = [
  '2026-01', '2026-02', '2026-03', '2026-04',
  '2026-05', '2026-06', '2026-07', '2026-08',
  '2026-09', '2026-10', '2026-11', '2026-12'
];

export const ComissoesVendedores: React.FC<ComissoesVendedoresProps> = ({ vendas, vendedores }) => {
  const theme = useTheme();
  const [vendedorId, setVendedorId] = useState<string>('');
  const [abaInterna, setAbaInterna] = useState<'timeline' | 'matriz'>('timeline');

  const vendedorSelecionado = useMemo(() => {
    return vendedores.find((v) => v.id === vendedorId) || null;
  }, [vendedorId, vendedores]);

  // Filtra vendas deste vendedor
  const vendasDoVendedor = useMemo(() => {
    if (!vendedorSelecionado) return [];
    return vendas.filter((v) => v.vendedorId === vendedorSelecionado.id);
  }, [vendedorSelecionado, vendas]);

  // Processa todas as parcelas ativas do vendedor selecionado
  const comissoesDoVendedor = useMemo((): LinhaComissao[] => {
    if (!vendedorSelecionado) return [];

    const linhas: LinhaComissao[] = [];
    const pctVendedor = Number(vendedorSelecionado.percentualComissao || 0);

    vendasDoVendedor.forEach((venda) => {
      const pctMensalVendedor = pctVendedor / venda.qtdParcelas;

      const mesesAtivos = Object.keys(venda.projecaoMensal)
        .filter((mesChave) => {
          const celula = venda.projecaoMensal[mesChave];
          return celula && celula.valorVenda && celula.valorVenda > 0;
        })
        .sort();

      mesesAtivos.forEach((mesChave, idx) => {
        const celula = venda.projecaoMensal[mesChave];
        const comissaoVendedorCalculada = (venda.valorVenda * (pctMensalVendedor / 100));

        linhas.push({
          id: `${venda.id}_${mesChave}`,
          vendaId: venda.id,
          cliente: venda.cliente,
          segmento: venda.segmento,
          tabela: venda.tabela,
          mesChave,
          valorVenda: venda.valorVenda,
          valorParcela: celula.valorParcela || venda.valorParcela,
          status: celula.status,
          comissaoMaster: celula.comissaoGerada || 0,
          comissaoVendedor: Number(comissaoVendedorCalculada.toFixed(2)),
          parcelaIndex: idx + 1,
          qtdParcelas: venda.qtdParcelas
        });
      });
    });

    return linhas.sort((a, b) => a.mesChave.localeCompare(b.mesChave));
  }, [vendedorSelecionado, vendasDoVendedor]);

  // Cálculos consolidados para os cards de resumo
  const resumoFinanceiro = useMemo(() => {
    let comissaoPaga = 0;
    let comissaoAVencer = 0;
    let comissaoTotal = 0;

    comissoesDoVendedor.forEach((c) => {
      if (c.status === 'Cancelada') return;

      comissaoTotal += c.comissaoVendedor;
      if (c.status === 'Recebida' || c.status === 'Paga') {
        comissaoPaga += c.comissaoVendedor;
      } else {
        comissaoAVencer += c.comissaoVendedor;
      }
    });

    return { comissaoPaga, comissaoAVencer, comissaoTotal };
  }, [comissoesDoVendedor]);

  // Totais mensais para a matriz horizontal
  const totaisMensaisMatriz = useMemo(() => {
    const totais: Record<string, { faturamento: number; comissao: number }> = {};
    
    LISTA_MESES_TIMELINE.forEach((mes) => {
      totais[mes] = { faturamento: 0, comissao: 0 };
    });

    if (!vendedorSelecionado) return totais;

    const pctVendedor = Number(vendedorSelecionado.percentualComissao || 0);

    vendasDoVendedor.forEach((venda) => {
      if (venda.statusCliente === 'Cancelado') return;
      const pctMensalVendedor = pctVendedor / venda.qtdParcelas;

      Object.keys(venda.projecaoMensal).forEach((mesChave) => {
        const celula = venda.projecaoMensal[mesChave];
        if (celula && celula.valorVenda && celula.valorVenda > 0 && celula.status !== 'Cancelada') {
          const comissaoVendedorCalculada = (venda.valorVenda * (pctMensalVendedor / 100));
          if (totais[mesChave]) {
            totais[mesChave].faturamento += celula.valorVenda;
            totais[mesChave].comissao += comissaoVendedorCalculada;
          }
        }
      });
    });

    return totais;
  }, [vendedorSelecionado, vendasDoVendedor]);

  const getStatusChip = (status: StatusParcela) => {
    switch (status) {
      case 'Recebida':
      case 'Paga':
        return <Chip label="Recebida" size="small" color="success" sx={{ fontWeight: 700, borderRadius: 1.5, fontSize: '0.7rem' }} />;
      case 'Cancelada':
        return <Chip label="Cancelada" size="small" color="error" sx={{ fontWeight: 700, borderRadius: 1.5, fontSize: '0.7rem' }} />;
      default:
        return <Chip label="A vencer" size="small" color="warning" sx={{ fontWeight: 700, borderRadius: 1.5, fontSize: '0.7rem' }} />;
    }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography
            variant="h5"
            sx={{ fontWeight: 800, fontFamily: 'Outfit, sans-serif', color: theme.palette.mode === 'dark' ? '#f8fafc' : '#0f172a' }}
          >
            Comissões dos Corretores / Vendedores
          </Typography>
          <Typography variant="body2" sx={{ color: theme.palette.mode === 'dark' ? '#94a3b8' : '#64748b', mt: 0.5 }}>
            Acompanhe a timeline de comissões futuras e recebidas de cada corretor baseado em suas vendas ativas.
          </Typography>
        </Box>

        {/* Seleção do Vendedor */}
        <FormControl size="small" sx={{ minWidth: 240 }}>
          <InputLabel id="select-vendedor-label">Corretor / Vendedor</InputLabel>
          <Select
            labelId="select-vendedor-label"
            value={vendedorId}
            label="Corretor / Vendedor"
            onChange={(e) => setVendedorId(e.target.value)}
            sx={{ borderRadius: 2 }}
          >
            <MenuItem value="">
              <em>Selecione um Corretor...</em>
            </MenuItem>
            {vendedores.map((v) => (
              <MenuItem key={v.id} value={v.id}>
                {v.nome} ({Number(v.percentualComissao || 0).toFixed(1)}%)
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>

      {!vendedorSelecionado ? (
        <Paper
          elevation={0}
          sx={{
            p: 6,
            borderRadius: 4,
            border: `1px dashed ${theme.palette.mode === 'dark' ? '#334155' : '#cbd5e1'}`,
            textAlign: 'center',
            bgcolor: theme.palette.mode === 'dark' ? '#1e293b' : '#f8fafc'
          }}
        >
          <Avatar sx={{ width: 56, height: 56, mx: 'auto', mb: 2, bgcolor: 'primary.light' }}>
            <PersonIcon sx={{ fontSize: 32, color: 'primary.main' }} />
          </Avatar>
          <Typography variant="h6" sx={{ fontWeight: 750, mb: 1, fontFamily: 'Outfit, sans-serif' }}>
            Nenhum Corretor Selecionado
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary', maxWidth: 400, mx: 'auto' }}>
            Selecione um vendedor no menu suspenso acima para consolidar a timeline de comissões e visualizar os valores calculados.
          </Typography>
        </Paper>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {/* Cards de Resumo do Vendedor Selecionado */}
          <Grid container spacing={3}>
            <Grid size={{ xs: 12, md: 4 }}>
              <Card
                elevation={0}
                sx={{
                  borderRadius: 3.5,
                  border: `1px solid ${theme.palette.mode === 'dark' ? '#334155' : '#e2e8f0'}`,
                  bgcolor: theme.palette.mode === 'dark' ? '#1e293b' : '#ffffff'
                }}
              >
                <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Avatar sx={{ bgcolor: 'rgba(99, 102, 241, 0.1)', color: '#6366f1' }}>
                    <ReceiptIcon />
                  </Avatar>
                  <Box>
                    <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>
                      Comissão Acumulada Ativa
                    </Typography>
                    <Typography variant="h5" sx={{ fontWeight: 800, color: 'text.primary', fontFamily: 'Outfit, sans-serif' }}>
                      {formatarMoeda(resumoFinanceiro.comissaoTotal)}
                    </Typography>
                  </Box>
                </CardContent>
              </Card>
            </Grid>

            <Grid size={{ xs: 12, md: 4 }}>
              <Card
                elevation={0}
                sx={{
                  borderRadius: 3.5,
                  border: `1px solid ${theme.palette.mode === 'dark' ? '#334155' : '#e2e8f0'}`,
                  bgcolor: theme.palette.mode === 'dark' ? '#1e293b' : '#ffffff'
                }}
              >
                <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Avatar sx={{ bgcolor: 'rgba(16, 185, 129, 0.1)', color: '#10b981' }}>
                    <CheckCircleIcon />
                  </Avatar>
                  <Box>
                    <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>
                      Parcelas Recebidas / Pagas
                    </Typography>
                    <Typography variant="h5" sx={{ fontWeight: 800, color: 'success.main', fontFamily: 'Outfit, sans-serif' }}>
                      {formatarMoeda(resumoFinanceiro.comissaoPaga)}
                    </Typography>
                  </Box>
                </CardContent>
              </Card>
            </Grid>

            <Grid size={{ xs: 12, md: 4 }}>
              <Card
                elevation={0}
                sx={{
                  borderRadius: 3.5,
                  border: `1px solid ${theme.palette.mode === 'dark' ? '#334155' : '#e2e8f0'}`,
                  bgcolor: theme.palette.mode === 'dark' ? '#1e293b' : '#ffffff'
                }}
              >
                <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Avatar sx={{ bgcolor: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b' }}>
                    <HourglassEmptyIcon />
                  </Avatar>
                  <Box>
                    <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>
                      Parcelas a Vencer
                    </Typography>
                    <Typography variant="h5" sx={{ fontWeight: 800, color: 'warning.main', fontFamily: 'Outfit, sans-serif' }}>
                      {formatarMoeda(resumoFinanceiro.comissaoAVencer)}
                    </Typography>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          {/* Abas internas para alternar visualizações */}
          <Box sx={{ borderBottom: 1, borderColor: theme.palette.mode === 'dark' ? '#334155' : '#e2e8f0' }}>
            <Tabs
              value={abaInterna}
              onChange={(_, val) => setAbaInterna(val)}
              textColor="primary"
              indicatorColor="primary"
            >
              <Tab value="timeline" icon={<ListAltIcon sx={{ fontSize: 18 }} />} iconPosition="start" label="Visualização por Parcela (Timeline)" />
              <Tab value="matriz" icon={<TableChartIcon sx={{ fontSize: 18 }} />} iconPosition="start" label="Acompanhamento Mensal (Modelo Empresa)" />
            </Tabs>
          </Box>

          {/* ABA 1: TIMELINE VERTICAL */}
          {abaInterna === 'timeline' && (
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
              <Table size="small">
                <TableHead sx={{ background: theme.palette.mode === 'dark' ? '#0f172a' : '#f8fafc' }}>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700, py: 1.5 }}>Mês Ref.</TableCell>
                    <TableCell sx={{ fontWeight: 700, py: 1.5 }}>Cliente</TableCell>
                    <TableCell sx={{ fontWeight: 700, py: 1.5 }}>Segmento / Tabela</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700, py: 1.5 }}>Parcela</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700, py: 1.5 }}>Valor Parcela</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700, py: 1.5 }}>Comissão Master (Empresa)</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700, py: 1.5, color: theme.palette.primary.main }}>
                      Comissão Corretor ({Number(vendedorSelecionado.percentualComissao || 0).toFixed(2).replace('.', ',')}%)
                    </TableCell>
                    <TableCell align="center" sx={{ fontWeight: 700, py: 1.5 }}>Status</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {comissoesDoVendedor.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} align="center" sx={{ py: 6, color: 'text.secondary' }}>
                        Nenhuma venda ou parcela ativa associada a este corretor.
                      </TableCell>
                    </TableRow>
                  ) : (
                    comissoesDoVendedor.map((linha) => (
                      <TableRow
                        key={linha.id}
                        sx={{
                          opacity: linha.status === 'Cancelada' ? 0.5 : 1,
                          textDecoration: linha.status === 'Cancelada' ? 'line-through' : 'none',
                          '&:hover': {
                            background: theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.02)' : 'rgba(0, 0, 0, 0.01)'
                          },
                          transition: 'background 0.2s',
                          borderBottom: `1px solid ${theme.palette.mode === 'dark' ? '#334155' : '#e2e8f0'}`
                        }}
                      >
                        <TableCell sx={{ fontWeight: 700 }}>
                          {formatarChaveMesExibicao(linha.mesChave)}
                        </TableCell>
                        <TableCell sx={{ fontWeight: 600 }}>{linha.cliente}</TableCell>
                        <TableCell>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <span style={{ fontSize: '0.8rem', color: theme.palette.text.secondary }}>
                              {linha.segmento}
                            </span>
                            <Chip label={linha.tabela} size="small" variant="outlined" sx={{ height: 18, fontSize: '0.65rem' }} />
                          </Box>
                        </TableCell>
                        <TableCell align="right">
                          {linha.parcelaIndex}/{linha.qtdParcelas}
                        </TableCell>
                        <TableCell align="right">
                          {formatarMoeda(linha.valorParcela)}
                        </TableCell>
                        <TableCell align="right" sx={{ color: 'text.secondary' }}>
                          {formatarMoeda(linha.comissaoMaster)}
                        </TableCell>
                        <TableCell align="right" sx={{ fontWeight: 700, color: theme.palette.primary.main }}>
                          {formatarMoeda(linha.comissaoVendedor)}
                        </TableCell>
                        <TableCell align="center">
                          {getStatusChip(linha.status)}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          )}

          {/* ABA 2: ACOMPANHAMENTO MATRIZ HORIZONTAL (MODELO EMPRESA) */}
          {abaInterna === 'matriz' && (
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
                  {/* Primeira linha do cabeçalho */}
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
                      Cliente
                    </TableCell>
                    <TableCell
                      rowSpan={2}
                      sx={{
                        fontWeight: 700,
                        color: theme.palette.mode === 'dark' ? '#cbd5e1' : '#475569',
                        borderBottom: `2px solid ${theme.palette.mode === 'dark' ? '#334155' : '#cbd5e1'}`,
                        minWidth: 140,
                        position: 'sticky',
                        left: 220,
                        background: theme.palette.mode === 'dark' ? '#0f172a' : '#f8fafc',
                        zIndex: 4
                      }}
                    >
                      Tabela
                    </TableCell>
                    <TableCell
                      rowSpan={2}
                      align="center"
                      sx={{
                        fontWeight: 700,
                        color: theme.palette.mode === 'dark' ? '#cbd5e1' : '#475569',
                        borderBottom: `2px solid ${theme.palette.mode === 'dark' ? '#334155' : '#cbd5e1'}`,
                        minWidth: 160,
                        position: 'sticky',
                        left: 360,
                        background: theme.palette.mode === 'dark' ? '#0f172a' : '#f8fafc',
                        zIndex: 4
                      }}
                    >
                      % Parcela Vendedor
                    </TableCell>

                    {/* Meses do calendário */}
                    {LISTA_MESES_TIMELINE.map((mes) => (
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
                        minWidth: 130,
                        bgcolor: 'rgba(99, 102, 241, 0.03)'
                      }}
                    >
                      Crédito Total
                    </TableCell>
                    <TableCell
                      rowSpan={2}
                      align="right"
                      sx={{
                        fontWeight: 700,
                        color: theme.palette.primary.main,
                        borderBottom: `2px solid ${theme.palette.mode === 'dark' ? '#334155' : '#cbd5e1'}`,
                        minWidth: 140,
                        bgcolor: 'rgba(99, 102, 241, 0.06)'
                      }}
                    >
                      Comissão Total Corretor
                    </TableCell>
                  </TableRow>

                  {/* Segunda linha do cabeçalho */}
                  <TableRow>
                    {LISTA_MESES_TIMELINE.map((mes) => (
                      <React.Fragment key={`sub-${mes}`}>
                        <TableCell
                          align="right"
                          sx={{
                            fontSize: '0.72rem',
                            fontWeight: 600,
                            color: theme.palette.mode === 'dark' ? '#94a3b8' : '#64748b',
                            borderBottom: `2px solid ${theme.palette.mode === 'dark' ? '#334155' : '#cbd5e1'}`,
                            borderLeft: `1px solid ${theme.palette.mode === 'dark' ? '#334155' : '#e2e8f0'}`,
                            minWidth: 80
                          }}
                        >
                          Crédito
                        </TableCell>
                        <TableCell
                          align="right"
                          sx={{
                            fontSize: '0.72rem',
                            fontWeight: 600,
                            color: theme.palette.primary.main,
                            borderBottom: `2px solid ${theme.palette.mode === 'dark' ? '#334155' : '#cbd5e1'}`,
                            minWidth: 95
                          }}
                        >
                          Comissão
                        </TableCell>
                      </React.Fragment>
                    ))}
                  </TableRow>
                </TableHead>

                <TableBody>
                  {vendasDoVendedor.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5 + LISTA_MESES_TIMELINE.length * 2} align="center" sx={{ py: 6 }}>
                        Nenhuma venda cadastrada para este corretor.
                      </TableCell>
                    </TableRow>
                  ) : (
                    vendasDoVendedor.map((venda) => {
                      const pctVendedor = Number(vendedorSelecionado.percentualComissao || 0);
                      const pctProporcionalParcela = pctVendedor / venda.qtdParcelas;
                      
                      // Calcula a comissão total da venda para o corretor (ignorando parcelas canceladas)
                      let totalComissaoCorretorVenda = 0;
                      Object.keys(venda.projecaoMensal).forEach((mesChave) => {
                        const cel = venda.projecaoMensal[mesChave];
                        if (cel && cel.valorVenda && cel.valorVenda > 0 && cel.status !== 'Cancelada') {
                          totalComissaoCorretorVenda += venda.valorVenda * (pctProporcionalParcela / 100);
                        }
                      });

                      return (
                        <TableRow
                          key={venda.id}
                          sx={{
                            opacity: venda.statusCliente === 'Cancelado' ? 0.5 : 1,
                            borderBottom: `1px solid ${theme.palette.mode === 'dark' ? '#334155' : '#e2e8f0'}`,
                            '&:hover': {
                              background: theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.01)' : 'rgba(0, 0, 0, 0.005)'
                            }
                          }}
                        >
                          {/* Sticky columns */}
                          <TableCell
                            sx={{
                              fontWeight: 600,
                              position: 'sticky',
                              left: 0,
                              background: theme.palette.mode === 'dark' ? '#1e293b' : '#ffffff',
                              borderRight: `1px solid ${theme.palette.mode === 'dark' ? '#334155' : '#e2e8f0'}`,
                              zIndex: 1
                            }}
                          >
                            {venda.cliente}
                          </TableCell>
                          <TableCell
                            sx={{
                              position: 'sticky',
                              left: 220,
                              background: theme.palette.mode === 'dark' ? '#1e293b' : '#ffffff',
                              borderRight: `1px solid ${theme.palette.mode === 'dark' ? '#334155' : '#e2e8f0'}`,
                              zIndex: 1
                            }}
                          >
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                              <span style={{ fontSize: '0.72rem', color: theme.palette.text.secondary }}>{venda.segmento}</span>
                              <Chip label={venda.tabela} size="small" variant="outlined" sx={{ height: 16, fontSize: '0.6rem' }} />
                            </Box>
                          </TableCell>
                          <TableCell
                            align="center"
                            sx={{
                              fontWeight: 700,
                              position: 'sticky',
                              left: 360,
                              background: theme.palette.mode === 'dark' ? '#1e293b' : '#ffffff',
                              borderRight: `1px solid ${theme.palette.mode === 'dark' ? '#334155' : '#e2e8f0'}`,
                              zIndex: 1,
                              color: theme.palette.primary.main
                            }}
                          >
                            <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                              <Typography variant="body2" sx={{ fontWeight: 800, fontSize: '0.8rem' }}>
                                {pctVendedor.toFixed(2).replace('.', ',')}%
                              </Typography>
                              <Typography variant="caption" sx={{ fontSize: '0.62rem', color: 'text.secondary', fontWeight: 600 }}>
                                ({pctProporcionalParcela.toFixed(3).replace('.', ',')}% / parc)
                              </Typography>
                            </Box>
                          </TableCell>

                          {/* Meses */}
                          {LISTA_MESES_TIMELINE.map((mes) => {
                            const celula = venda.projecaoMensal[mes];
                            const possuiDados = celula && celula.valorVenda && celula.valorVenda > 0;
                            const comissaoVendedorCalculada = possuiDados 
                              ? (venda.valorVenda * (pctProporcionalParcela / 100))
                              : 0;

                            return (
                              <React.Fragment key={`cell-${venda.id}-${mes}`}>
                                <TableCell
                                  align="right"
                                  sx={{
                                    borderLeft: `1px solid ${theme.palette.mode === 'dark' ? '#334155' : '#e2e8f0'}`,
                                    color: celula?.status === 'Cancelada' ? 'text.secondary' : 'text.primary',
                                    fontSize: '0.8rem'
                                  }}
                                >
                                  {possuiDados ? formatarMoeda(celula.valorVenda) : '-'}
                                </TableCell>
                                <TableCell
                                  align="right"
                                  sx={{
                                    fontWeight: possuiDados && celula?.status !== 'Cancelada' ? 700 : 500,
                                    color: celula?.status === 'Cancelada' 
                                      ? 'text.secondary' 
                                      : celula?.status === 'Recebida' || celula?.status === 'Paga'
                                      ? theme.palette.success.main 
                                      : theme.palette.primary.main,
                                    fontSize: '0.8rem'
                                  }}
                                >
                                  {possuiDados ? formatarMoeda(comissaoVendedorCalculada) : '-'}
                                </TableCell>
                              </React.Fragment>
                            );
                          })}

                          {/* Totais do Lado Direito */}
                          <TableCell align="right" sx={{ borderLeft: `2px solid ${theme.palette.mode === 'dark' ? '#475569' : '#cbd5e1'}`, fontWeight: 700, fontSize: '0.8rem', bgcolor: 'rgba(99, 102, 241, 0.01)' }}>
                            {venda.statusCliente === 'Cancelado' ? '-' : formatarMoeda(venda.valorVenda)}
                          </TableCell>
                          <TableCell align="right" sx={{ fontWeight: 800, color: theme.palette.primary.main, fontSize: '0.8rem', bgcolor: 'rgba(99, 102, 241, 0.03)' }}>
                            {formatarMoeda(totalComissaoCorretorVenda)}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}

                  {/* Linha de Totais do Rodapé */}
                  {vendasDoVendedor.length > 0 && (
                    <TableRow sx={{ background: theme.palette.mode === 'dark' ? '#0f172a' : '#f8fafc', borderTop: `2px solid ${theme.palette.mode === 'dark' ? '#475569' : '#cbd5e1'}` }}>
                      <TableCell colSpan={3} sx={{ fontWeight: 800 }}>TOTAIS MENSAIS</TableCell>

                      {/* Totais por mês */}
                      {LISTA_MESES_TIMELINE.map((mes) => {
                        const tot = totaisMensaisMatriz[mes];
                        return (
                          <React.Fragment key={`tot-${mes}`}>
                            <TableCell align="right" sx={{ fontWeight: 800, borderLeft: `1px solid ${theme.palette.mode === 'dark' ? '#334155' : '#e2e8f0'}`, fontSize: '0.8rem' }}>
                              {tot.faturamento > 0 ? formatarMoeda(tot.faturamento) : '-'}
                            </TableCell>
                            <TableCell align="right" sx={{ fontWeight: 800, color: theme.palette.primary.main, fontSize: '0.8rem' }}>
                              {tot.comissao > 0 ? formatarMoeda(tot.comissao) : '-'}
                            </TableCell>
                          </React.Fragment>
                        );
                      })}

                      {/* Totais Gerais finais */}
                      <TableCell align="right" sx={{ borderLeft: `2px solid ${theme.palette.mode === 'dark' ? '#475569' : '#cbd5e1'}`, fontWeight: 800, fontSize: '0.8rem' }}>
                        {formatarMoeda(vendasDoVendedor.reduce((acc, v) => v.statusCliente !== 'Cancelado' ? acc + v.valorVenda : acc, 0))}
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight: 900, color: theme.palette.primary.main, fontSize: '0.82rem' }}>
                        {formatarMoeda(resumoFinanceiro.comissaoTotal)}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Box>
      )}
    </Box>
  );
};
