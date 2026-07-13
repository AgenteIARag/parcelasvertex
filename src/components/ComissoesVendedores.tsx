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
  Avatar
} from '@mui/material';
import PersonIcon from '@mui/icons-material/Person';
import ReceiptIcon from '@mui/icons-material/Receipt';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
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

export const ComissoesVendedores: React.FC<ComissoesVendedoresProps> = ({ vendas, vendedores }) => {
  const theme = useTheme();
  const [vendedorId, setVendedorId] = useState<string>('');

  const vendedorSelecionado = useMemo(() => {
    return vendedores.find((v) => v.id === vendedorId) || null;
  }, [vendedorId, vendedores]);

  // Processa todas as parcelas do vendedor selecionado
  const comissoesDoVendedor = useMemo((): LinhaComissao[] => {
    if (!vendedorSelecionado) return [];

    const linhas: LinhaComissao[] = [];
    const pctVendedor = Number(vendedorSelecionado.percentualComissao || 0);

    // Filtra vendas deste vendedor
    const vendasDoVendedor = vendas.filter((v) => v.vendedorId === vendedorSelecionado.id);

    vendasDoVendedor.forEach((venda) => {
      const pctMensalVendedor = pctVendedor / venda.qtdParcelas;

      // Filtra e ordena apenas os meses que de fato possuem parcelas ativas da venda
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

    // Ordena as parcelas por mês cronologicamente (YYYY-MM)
    return linhas.sort((a, b) => a.mesChave.localeCompare(b.mesChave));
  }, [vendedorSelecionado, vendas]);

  // Cálculos consolidados para os cards de resumo
  const resumoFinanceiro = useMemo(() => {
    let comissaoPaga = 0;
    let comissaoAVencer = 0;
    let comissaoTotal = 0;

    comissoDoVendedor: comissoesDoVendedor.forEach((c) => {
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
            sx={{ fontWeight: 700, fontFamily: 'Outfit, sans-serif', color: theme.palette.mode === 'dark' ? '#f8fafc' : '#0f172a' }}
          >
            Comissões dos Corretores / Vendedores
          </Typography>
          <Typography variant="body2" sx={{ color: theme.palette.mode === 'dark' ? '#94a3b8' : '#64748b' }}>
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

          {/* Tabela Timeline das Comissões */}
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
                  <TableCell align="right" sx={{ fontWeight: 700, py: 1.5 }}>Comissão Master ({resumoFinanceiro.comissaoTotal > 0 ? 'Empresa' : ''})</TableCell>
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
                      Nenhuma venda ou parcela associada a este corretor.
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
        </Box>
      )}
    </Box>
  );
};
