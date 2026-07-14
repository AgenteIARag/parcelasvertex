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
  dataInicio: string;
  dataFim: string;
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

export const ComissoesVendedores: React.FC<ComissoesVendedoresProps> = ({
  vendas,
  vendedores,
  dataInicio,
  dataFim
}) => {
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

  // Gera dinamicamente a lista de chaves "YYYY-MM" cobrindo TODOS os meses que possuem parcelas reais do vendedor selecionado
  const listaMesesTimeline = useMemo(() => {
    const FALLBACK_MESES = [
      '2026-01', '2026-02', '2026-03', '2026-04',
      '2026-05', '2026-06', '2026-07', '2026-08',
      '2026-09', '2026-10', '2026-11', '2026-12'
    ];

    // Coleta todos os meses que possuem dados de parcelas nas vendas deste vendedor
    const mesesComDados = new Set<string>();
    vendasDoVendedor.forEach((venda) => {
      Object.keys(venda.projecaoMensal).forEach((mesChave) => {
        const celula = venda.projecaoMensal[mesChave];
        if (celula && celula.valorVenda > 0) {
          mesesComDados.add(mesChave);
        }
      });
    });

    // Também inclui os meses do intervalo do filtro para não perder colunas vazias do período
    if (dataInicio && dataFim) {
      try {
        const dataI = new Date(dataInicio + 'T00:00:00');
        const dataF = new Date(dataFim + 'T00:00:00');
        if (!isNaN(dataI.getTime()) && !isNaN(dataF.getTime())) {
          let dataAtual = new Date(dataI.getFullYear(), dataI.getMonth(), 15);
          const dataLimite = new Date(dataF.getFullYear(), dataF.getMonth(), 15);
          while (dataAtual <= dataLimite) {
            const ano = dataAtual.getFullYear();
            const mes = String(dataAtual.getMonth() + 1).padStart(2, '0');
            mesesComDados.add(`${ano}-${mes}`);
            dataAtual.setMonth(dataAtual.getMonth() + 1);
          }
        }
      } catch { /* fallback silencioso */ }
    }

    const resultado = Array.from(mesesComDados).sort();
    return resultado.length > 0 ? resultado : FALLBACK_MESES;
  }, [vendasDoVendedor, dataInicio, dataFim]);

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

  // Processa todas as parcelas ativas do vendedor selecionado filtrando pela data
  const comissoesDoVendedor = useMemo((): LinhaComissao[] => {
    if (!vendedorSelecionado) return [];

    const linhas: LinhaComissao[] = [];
    const pctVendedor = Number(vendedorSelecionado.percentualComissao || 0);
    const mesInicioChave = dataInicio.substring(0, 7);
    const mesFimChave = dataFim.substring(0, 7);

    vendasDoVendedor.forEach((venda) => {
      const pctMensalVendedor = pctVendedor / venda.qtdParcelas;

      const mesesAtivos = Object.keys(venda.projecaoMensal)
        .filter((mesChave) => {
          const celula = venda.projecaoMensal[mesChave];
          return celula && celula.valorVenda && celula.valorVenda > 0 &&
            mesChave >= mesInicioChave && mesChave <= mesFimChave;
        })
        .sort();

      mesesAtivos.forEach((mesChave) => {
        // Encontra o índice real cronológico da parcela ativa da venda
        const todasParcelasVenda = Object.keys(venda.projecaoMensal)
          .filter((m) => {
            const c = venda.projecaoMensal[m];
            return c && c.valorVenda && c.valorVenda > 0;
          })
          .sort();
        const parcelaIndexReal = todasParcelasVenda.indexOf(mesChave) + 1;

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
          parcelaIndex: parcelaIndexReal,
          qtdParcelas: venda.qtdParcelas
        });
      });
    });

    return linhas.sort((a, b) => a.mesChave.localeCompare(b.mesChave));
  }, [vendedorSelecionado, vendasDoVendedor, dataInicio, dataFim]);

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
    
    listaMesesTimeline.forEach((mes) => {
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
  }, [vendedorSelecionado, vendasDoVendedor, listaMesesTimeline]);

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
              <Tab value="timeline" icon={<ListAltIcon sx={{ fontSize: 18 }} />} iconPosition="start" label="Visualização por Parcela" />
              <Tab value="matriz" icon={<TableChartIcon sx={{ fontSize: 18 }} />} iconPosition="start" label="Acompanhamento Mensal" />
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

          {/* ABA 2: ACOMPANHAMENTO MATRIZ HORIZONTAL (IGUAL À DA EMPRESA) */}
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
              <Table size="small" sx={{ minWidth: 2200, borderCollapse: 'collapse' }}>
                <TableHead sx={{ background: theme.palette.mode === 'dark' ? '#0f172a' : '#f8fafc' }}>
                  {/* Primeira linha do cabeçalho */}
                  <TableRow>
                    <TableCell
                      rowSpan={2}
                      sx={{
                        fontWeight: 700,
                        color: theme.palette.mode === 'dark' ? '#cbd5e1' : '#475569',
                        borderBottom: `2px solid ${theme.palette.mode === 'dark' ? '#334155' : '#cbd5e1'}`,
                        minWidth: 320,
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
                        minWidth: 200,
                        position: 'sticky',
                        left: 320,
                        background: theme.palette.mode === 'dark' ? '#0f172a' : '#f8fafc',
                        zIndex: 4
                      }}
                    >
                      Regra Aplicada
                    </TableCell>

                    {/* Meses do calendário */}
                    {listaMesesTimeline.map((mes) => (
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
                  </TableRow>

                  {/* Segunda linha do cabeçalho */}
                  <TableRow>
                    {listaMesesTimeline.map((mes) => (
                      <React.Fragment key={`sub-${mes}`}>
                        <TableCell
                          align="right"
                          sx={{
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            color: theme.palette.mode === 'dark' ? '#94a3b8' : '#64748b',
                            borderBottom: `2px solid ${theme.palette.mode === 'dark' ? '#334155' : '#cbd5e1'}`,
                            borderLeft: `1px solid ${theme.palette.mode === 'dark' ? '#334155' : '#e2e8f0'}`,
                            minWidth: 120, whiteSpace: 'nowrap'
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
                            minWidth: 130, whiteSpace: 'nowrap'
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
                      <TableCell colSpan={4 + listaMesesTimeline.length * 2} align="center" sx={{ py: 6 }}>
                        Nenhuma venda cadastrada para este corretor.
                      </TableCell>
                    </TableRow>
                  ) : (
                    vendasDoVendedor.map((venda) => {
                      const pctVendedor = Number(vendedorSelecionado.percentualComissao || 0);
                      const pctProporcionalParcela = pctVendedor / venda.qtdParcelas;

                      return (
                        <TableRow
                          key={venda.id}
                          sx={{
                            opacity: venda.statusCliente === 'Cancelado' ? 0.65 : 1,
                            borderBottom: `1px solid ${theme.palette.mode === 'dark' ? '#334155' : '#e2e8f0'}`,
                            '&:hover': {
                              background: theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.02)' : 'rgba(0, 0, 0, 0.01)'
                            },
                            transition: 'background 0.2s, opacity 0.2s'
                          }}
                        >
                          {/* Sticky column 1: Cliente */}
                          <TableCell
                            sx={{
                              fontWeight: 600,
                              color: theme.palette.mode === 'dark' ? '#f1f5f9' : '#1e293b',
                              position: 'sticky',
                              left: 0,
                              minWidth: 320,
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
                              {(venda.dataSegundaParcela || venda.segmento) && (
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
                                  {venda.dataSegundaParcela && `2ª Parc: ${venda.dataSegundaParcela.split('-').reverse().join('/')}`}
                                  {venda.dataSegundaParcela && venda.segmento && ' | '}
                                  {venda.segmento}
                                </Typography>
                              )}
                            </Box>
                          </TableCell>

                          {/* Sticky column 2: Regra Aplicada */}
                          <TableCell
                            sx={{
                              color: theme.palette.mode === 'dark' ? '#cbd5e1' : '#475569',
                              fontSize: '0.8rem',
                              position: 'sticky',
                              left: 320,
                              minWidth: 200,
                              background: theme.palette.mode === 'dark' ? '#1e293b' : '#ffffff',
                              zIndex: 2,
                              borderRight: `2px solid ${theme.palette.mode === 'dark' ? '#475569' : '#cbd5e1'}`
                            }}
                          >
                            {venda.tabela}
                            <Typography variant="caption" sx={{ display: 'block', color: '#64748b' }}>
                              {venda.qtdParcelas} parcelas
                            </Typography>
                          </TableCell>

                          {/* Meses */}
                          {listaMesesTimeline.map((mes) => {
                            const celula = venda.projecaoMensal[mes];
                            const possuiDados = celula && celula.valorVenda && celula.valorVenda > 0;
                            const comissaoVendedorCalculada = (venda.valorVenda * (pctProporcionalParcela / 100));

                            return (
                              <React.Fragment key={`cell-${venda.id}-${mes}`}>
                                {/* Valor Venda */}
                                <TableCell
                                  align="right"
                                  sx={{
                                    borderLeft: `1px solid ${theme.palette.mode === 'dark' ? '#334155' : '#e2e8f0'}`,
                                    p: 0.5,
                                    bgcolor: celula?.status === 'Cancelada' 
                                      ? 'rgba(239, 68, 68, 0.02)' 
                                      : (!possuiDados 
                                        ? (theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.015)' : 'rgba(0, 0, 0, 0.01)')
                                        : 'inherit'),
                                    opacity: !possuiDados ? 0.35 : 1
                                  }}
                                >
                                  {possuiDados ? (
                                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                                      <span style={{ fontWeight: 650 }}>{formatarMoeda(celula.valorVenda)}</span>
                                      <Typography
                                        variant="caption"
                                        sx={{
                                          fontSize: '0.68rem',
                                          color: theme.palette.mode === 'dark' ? '#94a3b8' : '#64748b',
                                          fontWeight: 500,
                                          mt: 0.1
                                        }}
                                      >
                                        Parc: {formatarMoeda(celula.valorParcela || (venda.valorParcela || 0))}
                                      </Typography>
                                      {/* Tag de Venda / Recorrência */}
                                      {celula.status !== 'Cancelada' && (
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
                                            mt: 0.5,
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
                                  ) : ''}
                                </TableCell>

                                {/* Comissão Vendedor com Status */}
                                <TableCell
                                  align="right"
                                  sx={{
                                    borderRight: `1px solid ${theme.palette.mode === 'dark' ? '#334155' : '#e2e8f0'}`,
                                    p: 0.5,
                                    bgcolor: celula?.status === 'Cancelada' 
                                      ? 'rgba(239, 68, 68, 0.02)' 
                                      : (!possuiDados 
                                        ? (theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.015)' : 'rgba(0, 0, 0, 0.01)')
                                        : 'inherit'),
                                    opacity: !possuiDados ? 0.35 : 1
                                  }}
                                >
                                  {possuiDados ? (
                                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 0.5 }}>
                                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', whiteSpace: 'nowrap' }}>
                                        <span style={{ fontWeight: 600, color: celula.status === 'Cancelada' ? '#ef4444' : theme.palette.primary.main }}>
                                          {formatarMoeda(comissaoVendedorCalculada)}
                                        </span>
                                      </Box>
                                      {/* Status Badge */}
                                      <Box
                                        sx={{
                                          fontSize: '0.62rem',
                                          fontWeight: 700,
                                          py: 0.1,
                                          px: 0.5,
                                          borderRadius: 0.5,
                                          color: celula.status === 'Cancelada' ? '#ef4444' :
                                                 celula.status === 'Recebida' ? '#818cf8' :
                                                 celula.status === 'Paga' ? '#34d399' :
                                                 celula.status === 'Vendida' ? '#38bdf8' : '#94a3b8',
                                          background: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
                                          display: 'inline-block'
                                        }}
                                      >
                                        {celula.status}
                                      </Box>
                                    </Box>
                                  ) : ''}
                                </TableCell>
                              </React.Fragment>
                            );
                          })}

                          {/* Totais do Lado Direito */}
                          {(() => {
                            const pctV = Number(vendedorSelecionado.percentualComissao || 0);
                            const pctProporcional = pctV / venda.qtdParcelas;
                            const totaisVenda = listaMesesTimeline.reduce((acc, mes) => {
                              const cel = venda.projecaoMensal[mes];
                              if (cel && cel.valorVenda && cel.valorVenda > 0 && cel.status !== 'Cancelada') {
                                acc.vendas += cel.valorVenda;
                                acc.comissoes += (venda.valorVenda * (pctProporcional / 100));
                              }
                              return acc;
                            }, { vendas: 0, comissoes: 0 });

                            return (
                              <React.Fragment>
                                <TableCell align="right" sx={{ borderLeft: `2px solid ${theme.palette.mode === 'dark' ? '#334155' : '#cbd5e1'}`, fontWeight: 700, fontSize: '0.85rem', bgcolor: theme.palette.mode === 'dark' ? 'rgba(99, 102, 241, 0.05)' : 'rgba(99, 102, 241, 0.02)' }}>
                                  {venda.statusCliente === 'Cancelado' ? '-' : formatarMoeda(totaisVenda.vendas)}
                                </TableCell>
                                <TableCell align="right" sx={{ fontWeight: 700, fontSize: '0.85rem', color: theme.palette.success.main, bgcolor: theme.palette.mode === 'dark' ? 'rgba(16, 185, 129, 0.05)' : 'rgba(16, 185, 129, 0.02)' }}>
                                  {venda.statusCliente === 'Cancelado' ? '-' : formatarMoeda(totaisVenda.comissoes)}
                                </TableCell>
                              </React.Fragment>
                            );
                          })()}
                        </TableRow>
                      );
                    })
                  )}

                  {/* Linha de Totais Consolidados do Rodapé */}
                  {vendasDoVendedor.length > 0 && (
                    <TableRow sx={{ bgcolor: theme.palette.mode === 'dark' ? '#0f172a' : '#f8fafc', fontWeight: 'bold' }}>
                      <TableCell
                        sx={{
                          fontWeight: 750,
                          color: theme.palette.mode === 'dark' ? '#f8fafc' : '#0f172a',
                          position: 'sticky',
                          left: 0,
                          minWidth: 320,
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
                          left: 320,
                          minWidth: 200,
                          background: theme.palette.mode === 'dark' ? '#0f172a' : '#f8fafc',
                          zIndex: 2,
                          borderRight: `2px solid ${theme.palette.mode === 'dark' ? '#475569' : '#cbd5e1'}`
                        }}
                      />

                      {/* Totais por mês */}
                      {listaMesesTimeline.map((mes) => {
                        const tot = totaisMensaisMatriz[mes];
                        return (
                          <React.Fragment key={`tot-${mes}`}>
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
                              {tot.faturamento > 0 ? formatarMoeda(tot.faturamento) : '-'}
                            </TableCell>
                            <TableCell
                              align="right"
                              sx={{
                                fontWeight: 700,
                                color: theme.palette.success.main,
                                borderTop: `2px solid ${theme.palette.mode === 'dark' ? '#475569' : '#cbd5e1'}`,
                                fontSize: '0.8rem'
                              }}
                            >
                              {tot.comissao > 0 ? formatarMoeda(tot.comissao) : '-'}
                            </TableCell>
                          </React.Fragment>
                        );
                      })}

                      {/* Totais Gerais finais */}
                      {(() => {
                        const totalGeralVendas = vendasDoVendedor.reduce((acc, v) => {
                          if (v.statusCliente === 'Cancelado') return acc;
                          let totalV = 0;
                          listaMesesTimeline.forEach((mes) => {
                            const cel = v.projecaoMensal[mes];
                            if (cel && cel.valorVenda && cel.valorVenda > 0 && cel.status !== 'Cancelada') {
                              totalV += cel.valorVenda;
                            }
                          });
                          return acc + totalV;
                        }, 0);

                        const totalGeralComissoes = vendasDoVendedor.reduce((acc, v) => {
                          if (v.statusCliente === 'Cancelado') return acc;
                          let totalC = 0;
                          const pctV = Number(vendedorSelecionado.percentualComissao || 0);
                          const pctProporcional = pctV / v.qtdParcelas;
                          listaMesesTimeline.forEach((mes) => {
                            const cel = v.projecaoMensal[mes];
                            if (cel && cel.valorVenda && cel.valorVenda > 0 && cel.status !== 'Cancelada') {
                              totalC += (v.valorVenda * (pctProporcional / 100));
                            }
                          });
                          return acc + totalC;
                        }, 0);

                        return (
                          <React.Fragment>
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
                              {formatarMoeda(totalGeralVendas)}
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
                              {formatarMoeda(totalGeralComissoes)}
                            </TableCell>
                          </React.Fragment>
                        );
                      })()}
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
