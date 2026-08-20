import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Button,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Grid,
  useTheme,
  Alert,
  Tabs,
  Tab,
  Chip,
  Snackbar,
  Slide,
  FormControlLabel,
  Switch,
  InputAdornment
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import CloseIcon from '@mui/icons-material/Close';
import BlockIcon from '@mui/icons-material/Block';
import PercentIcon from '@mui/icons-material/Percent';
import TableChartIcon from '@mui/icons-material/TableChart';
import ListAltIcon from '@mui/icons-material/ListAlt';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import {
  type LancamentoVenda,
  type RegraMaster,
  type SegmentoType,
  type StatusParcela,
  type Vendedor,
  type ProjecaoMensalType,
  type UserPermissions,
  type MesProjecao,
  type TipoTabela,
  type Administradora
} from '../types';
import { gerarProjecaoVazia, calcularTotaisLinha, getStatusInicial } from '../data/initialData';
import { formatarMoeda, formatarChaveMesExibicao, obterStatusEfetivo } from '../utils/formatters';

// Funções utilitárias de máscara financeira e cálculos de vencimento
const formatarMascaraDinheiro = (valor: string): string => {
  const apenasNumeros = valor.replace(/\D/g, '');
  if (!apenasNumeros) return '';
  const valorNumerico = parseFloat(apenasNumeros) / 100;
  return valorNumerico.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
};

const formatarMoedaInput = (valor: number): string => {
  if (!valor || isNaN(valor)) return '';
  return valor.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
};

const extrairValorCru = (valorFormatado: string): number => {
  if (!valorFormatado) return 0;
  const limpo = valorFormatado
    .replace(/[R$\s]/g, '')
    .replace(/\./g, '')
    .replace(',', '.');
  return parseFloat(limpo) || 0;
};

// Calcula a data de previsão de recebimento da comissão de acordo com os ciclos de fechamento/pagamento
const calcularDataPrevisaoRecebimento = (dataVencimentoParcela: string, _ciclos?: Record<string, [number, number]>): string => {
  if (!dataVencimentoParcela) return '';
  const dt = new Date(dataVencimentoParcela + 'T00:00:00');
  const dia = dt.getDate();
  const mes = dt.getMonth(); // 0 a 11
  const ano = dt.getFullYear();

  let diaRecebimento = 15;
  let mesesAdicionais = 1;

  if (dia <= 5) {
    diaRecebimento = 15;
    mesesAdicionais = 1;
  } else if (dia <= 10) {
    diaRecebimento = 20;
    mesesAdicionais = 1;
  } else if (dia <= 15) {
    diaRecebimento = 25;
    mesesAdicionais = 1;
  } else if (dia <= 20) {
    diaRecebimento = 30;
    mesesAdicionais = 1;
  } else if (dia <= 25) {
    diaRecebimento = 5;
    mesesAdicionais = 2;
  } else {
    diaRecebimento = 10;
    mesesAdicionais = 2;
  }

  const dtRecebimento = new Date(ano, mes + mesesAdicionais, diaRecebimento);
  const anoReceb = dtRecebimento.getFullYear();
  const mesReceb = String(dtRecebimento.getMonth() + 1).padStart(2, '0');
  const diaReceb = String(dtRecebimento.getDate()).padStart(2, '0');

  return `${anoReceb}-${mesReceb}-${diaReceb}`;
};

interface SimuladorVendasProps {
  vendas: LancamentoVenda[];
  regras: RegraMaster[];
  vendedores: Vendedor[];
  onAdicionarVenda: (venda: LancamentoVenda) => void;
  onAtualizarVenda: (venda: LancamentoVenda) => void;
  onExcluirVenda: (id: string) => void;
  permissoes: UserPermissions;
  dataInicio: string;
  dataFim: string;
  ciclos: Record<string, [number, number]>;
  administradoras?: Administradora[];
  isMaster?: boolean;
}

export const SimuladorVendas: React.FC<SimuladorVendasProps> = ({
  vendas,
  regras,
  vendedores,
  onAdicionarVenda,
  onAtualizarVenda,
  onExcluirVenda,
  permissoes,
  dataInicio,
  dataFim,
  ciclos,
  administradoras = [],
  isMaster,
}) => {
  const theme = useTheme();

  // Estados para inclusão de nova venda
  const [openDialog, setOpenDialog] = useState(false);

  // Estado para controle de edição inline das células de venda
  const [editingCell, setEditingCell] = useState<{ vendaId: string; mes: string } | null>(null);

  // Estado para controle do dialog de edição de parcela individual
  const [editandoParcela, setEditandoParcela] = useState<{ vendaId: string; mesChave: string } | null>(null);

  // Estado para controle de abas internas (Matriz horizontal vs Timeline vertical vs Resumo)
  const [abaInterna, setAbaInterna] = useState<'matriz' | 'timeline' | 'resumo'>('matriz');
  const [tipoFiltro, setTipoFiltro] = useState<'todos' | 'vendas' | 'recorrencia'>('todos');
  const [filtroStatus, setFiltroStatus] = useState<StatusParcela | 'Recebida' | 'Todos'>('Todos');
  const [filtroPac, setFiltroPac] = useState('');
  const [filtroAdministradora, setFiltroAdministradora] = useState<string>('Todas');

  // Estado para guardar ID da venda selecionada para exclusão (confirmação necessária)
  const [vendaParaExcluir, setVendaParaExcluir] = useState<string | null>(null);

  // Estados para edição de venda (Popup)
  const [vendaEmEdicao, setVendaEmEdicao] = useState<LancamentoVenda | null>(null);
  const [openEditDialog, setOpenEditDialog] = useState(false);

  // Estado do Snackbar de sucesso
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'info' }>({
    open: false,
    message: '',
    severity: 'success'
  });

  const mostrarSnackbar = (message: string, severity: 'success' | 'info' = 'success') => {
    setSnackbar({ open: true, message, severity });
  };

  const handleCloseSnackbar = (_: React.SyntheticEvent | Event, reason?: string) => {
    if (reason === 'clickaway') return;
    setSnackbar(prev => ({ ...prev, open: false }));
  };


  const handleIniciarEdicao = (venda: LancamentoVenda) => {
    setVendaEmEdicao(venda);
    setOpenEditDialog(true);
  };

  const handleOpenDialog = () => {
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
  };

  // Edição inline de valores mensais na timeline
  const handleAlterarValorMensal = (
    vendaId: string,
    mes: string,
    novoValor: number
  ) => {
    const venda = vendas.find((v) => v.id === vendaId);
    if (!venda) return;

    const projecaoAtualizada = {
      ...venda.projecaoMensal,
      [mes]: {
        ...(venda.projecaoMensal[mes] || {
          valorVenda: 0,
          comissaoGerada: 0,
          status: 'A vencer' as StatusParcela,
          dataVencimento: `${mes}-15`
        }),
        valorVenda: novoValor
      }
    };

    const { totalVendas, totalComissoes, projecaoAtualizada: projFina } = calcularTotaisLinha(
      projecaoAtualizada,
      venda.percentualComissao,
      venda.qtdParcelas,
      venda.tipoTabela || 'Linear',
      venda.percentualAdesao,
      venda.percentualMensal,
      venda.percentuaisParcelas
    );

    const temParcelasAtivas = Object.values(projFina).some(p => p.status !== 'Cancelada' && p.valorVenda > 0);
    const novoStatusCliente = temParcelasAtivas ? 'Ativo' : 'Cancelado';

    onAtualizarVenda({
      ...venda,
      projecaoMensal: projFina,
      totalVendas,
      totalComissoes,
      statusCliente: novoStatusCliente
    });
  };

  const handleAlterarStatusParcela = (
    vendaId: string,
    mes: string,
    novoStatus: StatusParcela
  ) => {
    const venda = vendas.find((v) => v.id === vendaId);
    if (!venda) return;

    // Se status muda para 'Cancelada', cancela em cascata todas as parcelas posteriores
    if (novoStatus === 'Cancelada') {
      handleCancelarAPartirDoMes(vendaId, mes);
      return;
    }

    const projecaoAtualizada = {
      ...venda.projecaoMensal,
      [mes]: {
        ...(venda.projecaoMensal[mes] || {
          valorVenda: 0,
          comissaoGerada: 0,
          status: 'A vencer' as StatusParcela,
          dataVencimento: `${mes}-15`
        }),
        status: novoStatus
      }
    };

    const { totalVendas, totalComissoes, projecaoAtualizada: projFina } = calcularTotaisLinha(
      projecaoAtualizada,
      venda.percentualComissao,
      venda.qtdParcelas,
      venda.tipoTabela || 'Linear',
      venda.percentualAdesao,
      venda.percentualMensal,
      venda.percentuaisParcelas
    );

    const temParcelasAtivas = Object.values(projFina).some(p => p.status !== 'Cancelada' && p.valorVenda > 0);
    const novoStatusCliente = temParcelasAtivas ? 'Ativo' : 'Cancelado';

    onAtualizarVenda({
      ...venda,
      projecaoMensal: projFina,
      totalVendas,
      totalComissoes,
      statusCliente: novoStatusCliente
    });
  };

  const handleAlterarRecebidaParcela = (
    vendaId: string,
    mes: string,
    recebida: boolean
  ) => {
    const venda = vendas.find((v) => v.id === vendaId);
    if (!venda) return;

    const projecaoAtualizada = {
      ...venda.projecaoMensal,
      [mes]: {
        ...(venda.projecaoMensal[mes] || {
          valorVenda: 0,
          comissaoGerada: 0,
          status: 'A vencer' as StatusParcela,
          dataVencimento: `${mes}-15`
        }),
        recebida: recebida
      }
    };

    const { totalVendas, totalComissoes, projecaoAtualizada: projFina } = calcularTotaisLinha(
      projecaoAtualizada,
      venda.percentualComissao,
      venda.qtdParcelas,
      venda.tipoTabela || 'Linear',
      venda.percentualAdesao,
      venda.percentualMensal,
      venda.percentuaisParcelas
    );

    const temParcelasAtivas = Object.values(projFina).some(p => p.status !== 'Cancelada' && p.valorVenda > 0);
    const novoStatusCliente = temParcelasAtivas ? 'Ativo' : 'Cancelado';

    onAtualizarVenda({
      ...venda,
      projecaoMensal: projFina,
      totalVendas,
      totalComissoes,
      statusCliente: novoStatusCliente
    });
  };

  const handleCancelarAPartirDoMes = (vendaId: string, mesLimite: string) => {
    const venda = vendas.find((v) => v.id === vendaId);
    if (!venda) return;

    const projecaoAtualizada = { ...venda.projecaoMensal };
    let iniciouCancelamento = false;

    // Ordena as chaves cronologicamente para garantir o cancelamento sequencial em múltiplos anos
    const chavesOrdenadas = Object.keys(projecaoAtualizada).sort();

    chavesOrdenadas.forEach((mes) => {
      if (mes === mesLimite) {
        iniciouCancelamento = true;
      }
      if (iniciouCancelamento) {
        projecaoAtualizada[mes] = {
          ...projecaoAtualizada[mes],
          status: 'Cancelada'
        };
      }
    });

    const { totalVendas, totalComissoes, projecaoAtualizada: projFina } = calcularTotaisLinha(
      projecaoAtualizada,
      venda.percentualComissao,
      venda.qtdParcelas,
      venda.tipoTabela || 'Linear',
      venda.percentualAdesao,
      venda.percentualMensal,
      venda.percentuaisParcelas
    );

    onAtualizarVenda({
      ...venda,
      statusCliente: 'Cancelado',
      projecaoMensal: projFina,
      totalVendas,
      totalComissoes
    });
  };

  // Altera múltiplos campos de uma parcela individual (editarParcelas)
  const handleAlterarParcelaCompleta = (
    vendaId: string,
    mes: string,
    campos: { dataVencimento?: string; dataRecebimento?: string; valorParcela?: number; comissaoGerada?: number; status?: StatusParcela; recebida?: boolean }
  ) => {
    const venda = vendas.find((v) => v.id === vendaId);
    if (!venda) return;
    const celulaAtual = venda.projecaoMensal[mes] || {
      valorVenda: 0, comissaoGerada: 0, status: 'A vencer' as StatusParcela, dataVencimento: `${mes}-15`
    };
    if (campos.status === 'Cancelada' && celulaAtual.status !== 'Cancelada') {
      handleCancelarAPartirDoMes(vendaId, mes);
      return;
    }
    const celulaNova = { ...celulaAtual, ...campos };
    const projecaoAtualizada = { ...venda.projecaoMensal, [mes]: celulaNova };
    const { totalVendas, totalComissoes, projecaoAtualizada: projFina } = calcularTotaisLinha(
      projecaoAtualizada,
      venda.percentualComissao,
      venda.qtdParcelas,
      venda.tipoTabela || 'Linear',
      venda.percentualAdesao,
      venda.percentualMensal,
      venda.percentuaisParcelas
    );
    const temParcelasAtivas = Object.values(projFina).some(p => p.status !== 'Cancelada' && p.valorVenda > 0);
    onAtualizarVenda({ ...venda, projecaoMensal: projFina, totalVendas, totalComissoes, statusCliente: temParcelasAtivas ? 'Ativo' : 'Cancelado' });
  };

  // Retorna o índice cronológico da parcela (1-based)
  const obterIndiceParcela = (venda: LancamentoVenda, mesChave: string): number => {
    const mesesAtivos = Object.keys(venda.projecaoMensal)
      .filter((m) => {
        const c = venda.projecaoMensal[m];
        return c && c.valorVenda && c.valorVenda > 0;
      })
      .sort();
    return mesesAtivos.indexOf(mesChave) + 1;
  };

  // Obtém o rótulo do número da parcela (ex: "1/36")
  // Numera a parcela com base na ordem cronológica real dos meses ativos
  // Funciona corretamente mesmo com gap entre o mês da venda e o mês da assembleia
  const obterNumeroParcela = (venda: LancamentoVenda, mesChave: string): string => {
    const idx = obterIndiceParcela(venda, mesChave);
    if (idx > 0) {
      return `${idx}/${venda.qtdParcelas}`;
    }
    return '';
  };



  // Fallback estático dos 12 meses de 2026
  const FALLBACK_MESES = [
    '2026-01', '2026-02', '2026-03', '2026-04',
    '2026-05', '2026-06', '2026-07', '2026-08',
    '2026-09', '2026-10', '2026-11', '2026-12'
  ];



  const vendasFiltradasPorPac = useMemo(() => {
    return vendas.filter((venda) => {
      if (filtroAdministradora !== 'Todas') {
        const matchAdm = venda.administradoraId === filtroAdministradora || venda.administradoraNome === filtroAdministradora;
        if (!matchAdm) return false;
      }
      if (!filtroPac.trim()) return true;
      const query = filtroPac.toLowerCase().trim();
      return (venda.pac || '').toLowerCase().includes(query) || 
             (venda.cliente || '').toLowerCase().includes(query) ||
             (venda.administradoraNome || '').toLowerCase().includes(query);
    });
  }, [vendas, filtroPac, filtroAdministradora]);

  // Gera dinamicamente a lista de chaves "YYYY-MM" cobrindo TODOS os meses de recebimento de parcelas reais
  // A coluna é determinada pelo mês de dataRecebimento da parcela (não mais pelo mês-chave da projeção)
  const mesesFiltrados = useMemo(() => {
    const mesesComDados = new Set<string>();
    vendasFiltradasPorPac.forEach((venda) => {
      Object.keys(venda.projecaoMensal).forEach((mesChave) => {
        const celula = venda.projecaoMensal[mesChave];
        if (celula && celula.valorVenda > 0) {
          if (tipoFiltro === 'vendas' && mesChave !== venda.mesInicio) return;
          if (tipoFiltro === 'recorrencia' && mesChave === venda.mesInicio) return;
          // Usa dataRecebimento como chave de coluna (fallback para mesChave)
          const mesReceb = (celula.dataRecebimento || celula.dataVencimento || `${mesChave}-15`).substring(0, 7);
          mesesComDados.add(mesReceb);
        }
      });

      // Inclui o mês da venda para exibir o marcador de registro mesmo sem parcela nesse mês
      if (venda.dataVenda) {
        const mesVenda = venda.dataVenda.substring(0, 7);
        if (!dataInicio || !dataFim || (mesVenda >= dataInicio.substring(0, 7) && mesVenda <= dataFim.substring(0, 7))) {
          mesesComDados.add(mesVenda);
        }
      }

      // Inclui o mês da 1ª Assembleia para exibir o marcador de assembleia mesmo sem comissão
      if (venda.dataAssembleia) {
        const mesAssemb = venda.dataAssembleia.substring(0, 7);
        if (!dataInicio || !dataFim || (mesAssemb >= dataInicio.substring(0, 7) && mesAssemb <= dataFim.substring(0, 7))) {
          mesesComDados.add(mesAssemb);
        }
      }
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
  }, [vendasFiltradasPorPac, dataInicio, dataFim, tipoFiltro]);

  // Helper: encontra a parcela de uma venda cujo mês de dataRecebimento é igual ao mês-coluna
  const encontrarParcelaPorMesRecebimento = (
    venda: LancamentoVenda,
    mesColuna: string
  ): { mesChave: string; celula: typeof venda.projecaoMensal[string] } | null => {
    const chaves = Object.keys(venda.projecaoMensal);
    for (const mesChave of chaves) {
      const celula = venda.projecaoMensal[mesChave];
      if (!celula || celula.valorVenda <= 0) continue;
      const mesReceb = (celula.dataRecebimento || celula.dataVencimento || `${mesChave}-15`).substring(0, 7);
      if (mesReceb === mesColuna) return { mesChave, celula };
    }
    return null;
  };


  // Totais de vendas e comissões acumulados no período filtrado para cada linha
  const obterTotaisFiltrados = (venda: LancamentoVenda) => {
    let totalComissoesPeriodo = 0;
    let parcelasAtivasPeriodo = 0;

    mesesFiltrados.forEach((mes) => {
      const dadosMes = venda.projecaoMensal[mes];
      if (dadosMes && dadosMes.status !== 'Cancelada' && dadosMes.valorVenda > 0) {
        if (tipoFiltro === 'vendas' && mes !== venda.mesInicio) return;
        if (tipoFiltro === 'recorrencia' && mes === venda.mesInicio) return;
        if (filtroStatus !== 'Todos') {
          const statusEf = obterStatusEfetivo(dadosMes.status, dadosMes.dataVencimento);
          const isRecebida = dadosMes.recebida || false;
          if (filtroStatus === 'Recebida') {
            if (!isRecebida) return;
          } else {
            if (isRecebida || statusEf !== filtroStatus) return;
          }
        }
        
        totalComissoesPeriodo += dadosMes.comissaoGerada || 0;
        parcelasAtivasPeriodo += 1;
      }
    });

    // O faturamento nominal do contrato é proporcional ao número de parcelas faturadas no período filtrado
    const totalVendasPeriodo = parcelasAtivasPeriodo > 0 
      ? (venda.valorVenda / venda.qtdParcelas) * parcelasAtivasPeriodo 
      : 0;

    return { totalVendasPeriodo, totalComissoesPeriodo };
  };

  // Cálculo dos totais de rodapé para a timeline filtrados
  const calcularTotaisMensais = () => {
    const totais: Record<string, { vendas: number; comissoes: number }> = {};
    mesesFiltrados.forEach((mes) => {
      totais[mes] = { vendas: 0, comissoes: 0 };
    });

    let totalGeralVendas = 0;
    let totalGeralComissoes = 0;

    vendasFiltradasPorPac.forEach((v) => {
      // Soma o faturamento nominal proporcional da linha no período filtrado
      const { totalVendasPeriodo } = obterTotaisFiltrados(v);
      totalGeralVendas += totalVendasPeriodo;

      mesesFiltrados.forEach((mes) => {
        const celula = v.projecaoMensal[mes];
        if (celula && celula.status !== 'Cancelada') {
          if (tipoFiltro === 'vendas' && mes !== v.mesInicio) return;
          if (tipoFiltro === 'recorrencia' && mes === v.mesInicio) return;
          if (filtroStatus !== 'Todos') {
            const statusEf = obterStatusEfetivo(celula.status, celula.dataVencimento);
            const isRecebida = celula.recebida || false;
            if (filtroStatus === 'Recebida') {
              if (!isRecebida) return;
            } else {
              if (isRecebida || statusEf !== filtroStatus) return;
            }
          }

          totais[mes].vendas += celula.valorVenda || 0;
          totais[mes].comissoes += celula.comissaoGerada || 0;
          totalGeralComissoes += celula.comissaoGerada || 0;
        }
      });
    });

    return {
      mensais: totais,
      totalGeralVendas,
      totalGeralComissoes
    };
  };

  const totaisGerais = useMemo(() => calcularTotaisMensais(), [vendasFiltradasPorPac, mesesFiltrados, tipoFiltro, filtroStatus]);

  // Processa todas as parcelas ativas de todas as vendas para a timeline consolidada vertical da empresa
  const parcelasEmpresaTimeline = useMemo(() => {
    const linhas: {
      id: string;
      vendaId: string;
      cliente: string;
      pac?: string;
      vendedorNome: string;
      segmento: string;
      tabela: string;
      mesChave: string;
      valorVenda: number;
      valorParcela: number;
      comissaoMaster: number;
      status: StatusParcela;
      dataVencimento: string;
      dataRecebimento?: string;
      dataPrevisaoRecebimento: string;
      parcelaIndex: number;
      qtdParcelas: number;
      recebida: boolean;
    }[] = [];

    const mesInicioChave = dataInicio.substring(0, 7);
    const mesFimChave = dataFim.substring(0, 7);

    vendasFiltradasPorPac.forEach((venda) => {
      // Filtra os meses de faturamento ativos no período
      const mesesAtivos = Object.keys(venda.projecaoMensal)
        .filter((mesChave) => {
          const celula = venda.projecaoMensal[mesChave];
          const isAtivo = celula && celula.valorVenda && celula.valorVenda > 0 &&
            mesChave >= mesInicioChave && mesChave <= mesFimChave;
          if (!isAtivo) return false;
          if (tipoFiltro === 'vendas' && mesChave !== venda.mesInicio) return false;
          if (tipoFiltro === 'recorrencia' && mesChave === venda.mesInicio) return false;
          if (filtroStatus !== 'Todos') {
            const statusEf = obterStatusEfetivo(celula.status, celula.dataVencimento);
            const isRecebida = celula.recebida || false;
            if (filtroStatus === 'Recebida') {
              if (!isRecebida) return false;
            } else {
              if (isRecebida || statusEf !== filtroStatus) return false;
            }
          }
          return true;
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
        
        linhas.push({
          id: `${venda.id}_${mesChave}`,
          vendaId: venda.id,
          cliente: venda.cliente,
          pac: venda.pac || '',
          vendedorNome: venda.vendedorNome || '',
          segmento: venda.segmento,
          tabela: venda.tabela,
          mesChave,
          valorVenda: venda.valorVenda,
          valorParcela: celula.valorParcela || venda.valorParcela,
          comissaoMaster: celula.comissaoGerada || 0,
          status: obterStatusEfetivo(celula.status, celula.dataVencimento),
          dataVencimento: celula.dataVencimento || `${mesChave}-15`,
          dataRecebimento: celula.dataRecebimento || celula.dataVencimento || `${mesChave}-15`,
          dataPrevisaoRecebimento: calcularDataPrevisaoRecebimento(celula.dataVencimento || `${mesChave}-15`, ciclos),
          parcelaIndex: parcelaIndexReal,
          qtdParcelas: venda.qtdParcelas,
          recebida: celula.recebida || false
        });
      });
    });

    // Ordena de forma cronológica pela dataRecebimento (não mais pelo mesChave)
    return linhas.sort((a, b) => {
      const dA = (a as { dataRecebimento?: string }).dataRecebimento || a.dataVencimento || a.mesChave;
      const dB = (b as { dataRecebimento?: string }).dataRecebimento || b.dataVencimento || b.mesChave;
      return dA.localeCompare(dB);
    });
  }, [vendasFiltradasPorPac, dataInicio, dataFim, tipoFiltro, filtroStatus, ciclos]);

  return (
    <Box>
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: { xs: 'stretch', md: 'center' },
          flexDirection: { xs: 'column', md: 'row' },
          gap: 2,
          mb: 3
        }}
      >
        <Box>
          <Typography
            variant="h5"
            sx={{ fontWeight: 700, fontFamily: 'Outfit, sans-serif', color: theme.palette.mode === 'dark' ? '#f8fafc' : '#0f172a' }}
          >
            Painel e Timeline de Vendas
          </Typography>
          <Typography variant="body2" sx={{ color: theme.palette.mode === 'dark' ? '#94a3b8' : '#64748b' }}>
            Lance vendas e acompanhe a projeção mensal de faturamento. Os cálculos de comissões e totais são em tempo real.
          </Typography>
        </Box>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 2,
            flexWrap: 'wrap',
            justifyContent: 'flex-end'
          }}
        >
          <TextField
            size="small"
            placeholder="Filtrar por Cliente / PAC"
            value={filtroPac}
            onChange={(e) => setFiltroPac(e.target.value)}
            sx={{
              minWidth: 200,
              '& .MuiOutlinedInput-root': {
                borderRadius: 2
              }
            }}
          />

          {administradoras.length > 0 && (
            <FormControl size="small" sx={{ minWidth: 180 }}>
              <InputLabel id="select-filtro-adm-vendas">Administradora</InputLabel>
              <Select
                labelId="select-filtro-adm-vendas"
                value={filtroAdministradora}
                label="Administradora"
                onChange={(e) => setFiltroAdministradora(e.target.value)}
                sx={{ borderRadius: 2 }}
              >
                <MenuItem value="Todas">Todas as ADMs</MenuItem>
                {administradoras.map((a) => (
                  <MenuItem key={a.id} value={a.id}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8 }}>
                      <AccountBalanceIcon sx={{ fontSize: 15, color: '#818cf8' }} />
                      {a.nome}
                    </Box>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}

          <FormControl size="small" sx={{ minWidth: 180 }}>
            <InputLabel id="select-tipo-filtro-label">Tipo de Lançamento</InputLabel>
            <Select
              labelId="select-tipo-filtro-label"
              value={tipoFiltro}
              label="Tipo de Lançamento"
              onChange={(e) => setTipoFiltro(e.target.value as any)}
              sx={{ borderRadius: 2 }}
            >
              <MenuItem value="todos">Todos</MenuItem>
              <MenuItem value="vendas">Apenas Vendas</MenuItem>
              <MenuItem value="recorrencia">Apenas Recorrência</MenuItem>
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ minWidth: 180 }}>
            <InputLabel id="select-filtro-status-label">Status da Parcela</InputLabel>
            <Select
              labelId="select-filtro-status-label"
              value={filtroStatus}
              label="Status da Parcela"
              onChange={(e) => setFiltroStatus(e.target.value as StatusParcela | 'Todos')}
              sx={{ borderRadius: 2 }}
            >
              <MenuItem value="Todos">Todos</MenuItem>
              <MenuItem value="A vencer">A vencer</MenuItem>
              <MenuItem value="Vencida">Vencida</MenuItem>
              <MenuItem value="Paga">Paga</MenuItem>
              <MenuItem value="Recebida">Recebida</MenuItem>
              <MenuItem value="Cancelada">Cancelada</MenuItem>
            </Select>
          </FormControl>
          
          {permissoes.editarVendas && (
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={handleOpenDialog}
              sx={{
                borderRadius: 2.5,
                textTransform: 'none',
                fontWeight: 600,
                fontFamily: 'Outfit, sans-serif',
                boxShadow: '0 4px 12px rgba(99, 102, 241, 0.25)',
                background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`
              }}
            >
              Nova Venda
            </Button>
          )}
        </Box>
      </Box>

      {/* Abas internas para alternar visualizações */}
      <Box sx={{ borderBottom: 1, borderColor: theme.palette.mode === 'dark' ? '#334155' : '#e2e8f0', mb: 3 }}>
        <Tabs
          value={abaInterna}
          onChange={(_, val) => setAbaInterna(val)}
          textColor="primary"
          indicatorColor="primary"
        >
          <Tab value="matriz" icon={<TableChartIcon sx={{ fontSize: 18 }} />} iconPosition="start" label="Acompanhamento Mensal" />
          <Tab value="timeline" icon={<ListAltIcon sx={{ fontSize: 18 }} />} iconPosition="start" label="Visualização por Parcela" />
          <Tab
            value="resumo"
            iconPosition="start"
            icon={
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <path d="M3 9h18M9 21V9" />
              </svg>
            }
            label="Resumo por Venda"
          />
        </Tabs>
      </Box>

      {abaInterna === 'matriz' && (
        <TableContainer
          component={Paper}
          elevation={0}
          sx={{
            borderRadius: 4,
            border: `1px solid ${theme.palette.mode === 'dark' ? '#334155' : '#e2e8f0'}`,
            background: theme.palette.mode === 'dark' ? '#1e293b' : '#ffffff',
            overflowX: 'auto',
            overflowY: 'auto',
            maxHeight: 'calc(100vh - 260px)',
            maxWidth: '100%'
          }}
        >
          <Table size="small" sx={{ minWidth: 2200, borderCollapse: 'separate', borderSpacing: 0 }}>
            <TableHead sx={{ 
              background: theme.palette.mode === 'dark' ? '#0f172a' : '#f8fafc',
              position: 'sticky',
              top: 0,
              zIndex: 10
            }}>
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
                  zIndex: 5
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
                  minWidth: 260,
                  position: 'sticky',
                  left: 320,
                  background: theme.palette.mode === 'dark' ? '#0f172a' : '#f8fafc',
                  zIndex: 5
                }}
              >
                Regra Aplicada
              </TableCell>

              {/* Meses Filtrados */}
              {mesesFiltrados.map((mes) => (
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
                    bgcolor: theme.palette.mode === 'dark' ? '#0f172a' : '#f8fafc'
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
                  bgcolor: theme.palette.mode === 'dark' ? '#0f172a' : '#f8fafc'
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
                  bgcolor: theme.palette.mode === 'dark' ? '#0f172a' : '#f8fafc'
                }}
              >
                Total Comissões
              </TableCell>

            </TableRow>

            {/* Segunda linha do cabeçalho */}
            <TableRow>
              {mesesFiltrados.map((mes) => (
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
            {vendasFiltradasPorPac.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5 + mesesFiltrados.length * 2} align="center" sx={{ py: 6 }}>
                  <Typography variant="body1" sx={{ color: theme.palette.mode === 'dark' ? '#64748b' : '#94a3b8' }}>
                    Nenhuma venda localizada para os filtros selecionados.
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              vendasFiltradasPorPac.map((venda) => (
                <TableRow
                  key={venda.id}
                  sx={{
                    '&:hover': {
                      background: theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.02)' : 'rgba(0, 0, 0, 0.01)'
                    },
                    opacity: venda.statusCliente === 'Cancelado' ? 0.65 : 1,
                    transition: 'background 0.2s, opacity 0.2s',
                    borderBottom: `1px solid ${theme.palette.mode === 'dark' ? '#334155' : '#e2e8f0'}`
                  }}
                >
                  {/* Nome do Cliente e Vendedor com Sticky */}
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
                        <Typography
                          component="span"
                          onClick={() => permissoes.editarVendas && handleIniciarEdicao(venda)}
                          sx={{
                            cursor: permissoes.editarVendas ? 'pointer' : 'default',
                            fontSize: '0.875rem',
                            fontWeight: 650,
                            textDecoration: venda.statusCliente === 'Cancelado' ? 'line-through' : 'none',
                            '&:hover': permissoes.editarVendas ? {
                              textDecoration: 'underline',
                              color: theme.palette.primary.main
                            } : {}
                          }}
                        >
                          {venda.cliente}
                        </Typography>

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
                        {venda.contemplado && (
                          <Box
                            component="span"
                            sx={{
                              fontSize: '0.6rem',
                              fontWeight: 700,
                              px: 0.6,
                              py: 0.2,
                              borderRadius: 0.5,
                              backgroundColor: 'rgba(245, 158, 11, 0.18)',
                              color: '#f59e0b',
                              textTransform: 'uppercase',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 0.3
                            }}
                          >
                            🏆 Contemplado{venda.dataContemplacao ? ` ${venda.dataContemplacao.split('-').reverse().join('/')}` : ''}
                          </Box>
                        )}
                        {venda.pac && (
                          <Chip
                            label={venda.pac}
                            size="small"
                            color="secondary"
                            variant="outlined"
                            sx={{ height: 18, fontSize: '0.62rem', fontWeight: 700, borderRadius: 1.5 }}
                          />
                        )}

                        {/* Botões Editar / Excluir inline na coluna Cliente */}
                        {permissoes.editarVendas && (
                          <Box sx={{ display: 'flex', gap: 0.5, ml: 'auto' }}>
                            <IconButton
                              size="small"
                              onClick={() => handleIniciarEdicao(venda)}
                              sx={{
                                p: 0.4,
                                color: theme.palette.primary.main,
                                bgcolor: theme.palette.mode === 'dark' ? 'rgba(99,102,241,0.12)' : 'rgba(99,102,241,0.08)',
                                borderRadius: 1.5,
                                '&:hover': { bgcolor: theme.palette.mode === 'dark' ? 'rgba(99,102,241,0.25)' : 'rgba(99,102,241,0.18)' }
                              }}
                              title="Editar venda"
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                              </svg>
                            </IconButton>
                            {isMaster && (
                              <IconButton
                                size="small"
                                onClick={() => setVendaParaExcluir(venda.id)}
                                sx={{
                                  p: 0.4,
                                  color: '#ef4444',
                                  bgcolor: theme.palette.mode === 'dark' ? 'rgba(239,68,68,0.12)' : 'rgba(239,68,68,0.07)',
                                  borderRadius: 1.5,
                                  '&:hover': { bgcolor: 'rgba(239,68,68,0.22)' }
                                }}
                                title="Excluir venda"
                              >
                                <DeleteIcon sx={{ fontSize: '0.9rem' }} />
                              </IconButton>
                            )}
                          </Box>
                        )}
                      </Box>
                      {venda.vendedorNome && (
                        <Typography
                          variant="caption"
                          sx={{
                            color: theme.palette.primary.main,
                            fontWeight: 600,
                            fontSize: '0.72rem',
                            display: 'block'
                          }}
                        >
                          Vend: {venda.vendedorNome}
                        </Typography>
                      )}
                      {(venda.dataVenda || venda.dataVencimentoCliente || venda.dataAssembleia || venda.segmento) && (
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
                          {[
                            venda.dataVenda && `Venda: ${venda.dataVenda.split('-').reverse().join('/')}`,
                            venda.dataVencimentoCliente && `Venc. Cliente: ${venda.dataVencimentoCliente.split('-').reverse().join('/')}`,
                            venda.dataAssembleia && `1ª Assemb: ${venda.dataAssembleia.split('-').reverse().join('/')}`,
                            venda.segmento
                          ].filter(Boolean).join(' | ')}
                        </Typography>
                      )}
                    </Box>
                  </TableCell>

                  {/* Tabela e Parcelas - Congelada */}
                  <TableCell
                    sx={{
                      color: theme.palette.mode === 'dark' ? '#cbd5e1' : '#475569',
                      fontSize: '0.8rem',
                      position: 'sticky',
                      left: 320,
                      minWidth: 260,
                      background: theme.palette.mode === 'dark' ? '#1e293b' : '#ffffff',
                      zIndex: 2,
                      borderRight: `2px solid ${theme.palette.mode === 'dark' ? '#475569' : '#cbd5e1'}`
                    }}
                  >
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.2 }}>
                      <span style={{ fontWeight: 600 }}>{venda.tabela}</span>
                      <Typography variant="caption" sx={{ display: 'block', color: '#64748b' }}>
                        {venda.qtdParcelas} parcelas
                      </Typography>
                      {(venda.administradoraNome || venda.administradoraId) && (
                        <Chip
                          icon={<AccountBalanceIcon sx={{ fontSize: 12 }} />}
                          label={venda.administradoraNome || administradoras.find(a => a.id === venda.administradoraId)?.nome || venda.administradoraId}
                          size="small"
                          sx={{
                            width: 'fit-content',
                            height: 18,
                            fontSize: '0.65rem',
                            fontWeight: 600,
                            bgcolor: 'rgba(99, 102, 241, 0.08)',
                            color: '#818cf8',
                            borderRadius: 1.2,
                            mt: 0.2
                          }}
                        />
                      )}
                    </Box>
                  </TableCell>

                  {/* Colunas mensais (Venda editável e Comissão calculada) */}
                  {mesesFiltrados.map((mes) => {
                    // Lookup pelo mês de dataRecebimento da parcela
                    const parcelaMes = encontrarParcelaPorMesRecebimento(venda, mes);
                    const mesChaveReal = parcelaMes?.mesChave || mes;
                    let dadosMes = parcelaMes?.celula || venda.projecaoMensal[mes] || {
                      valorVenda: 0,
                      comissaoGerada: 0,
                      status: 'A vencer' as StatusParcela,
                      dataVencimento: `${mes}-15`
                    };
                    
                    if (tipoFiltro === 'vendas' && mesChaveReal !== venda.mesInicio) {
                      dadosMes = { ...dadosMes, valorVenda: 0, comissaoGerada: 0 };
                    }
                    if (tipoFiltro === 'recorrencia' && mesChaveReal === venda.mesInicio) {
                      dadosMes = { ...dadosMes, valorVenda: 0, comissaoGerada: 0 };
                    }
                    // Filtro por status da parcela
                    if (filtroStatus !== 'Todos' && dadosMes.valorVenda > 0) {
                      const statusEfCel = obterStatusEfetivo(dadosMes.status, dadosMes.dataVencimento || `${mesChaveReal}-15`);
                      const isRecebida = dadosMes.recebida || false;
                      if (filtroStatus === 'Recebida') {
                        if (!isRecebida) {
                          dadosMes = { ...dadosMes, valorVenda: 0, comissaoGerada: 0 };
                        }
                      } else {
                        if (isRecebida || statusEfCel !== filtroStatus) {
                          dadosMes = { ...dadosMes, valorVenda: 0, comissaoGerada: 0 };
                        }
                      }
                    }
                    // Verificação automática de vencimento para exibição
                    if (dadosMes.valorVenda > 0 && dadosMes.status === 'A vencer') {
                      const statusEfCel = obterStatusEfetivo(dadosMes.status, dadosMes.dataVencimento || `${mesChaveReal}-15`);
                      if (statusEfCel !== dadosMes.status) {
                        dadosMes = { ...dadosMes, status: statusEfCel };
                      }
                    }

                    const pctMensal = (venda.percentualComissao / venda.qtdParcelas).toFixed(2).replace('.', ',');
                    return (
                      <React.Fragment key={`${venda.id}-${mes}`}>
                        {/* Venda - Campo Editável Click-to-Edit */}
                        <TableCell
                          align="right"
                          sx={{
                            borderLeft: `1px solid ${theme.palette.mode === 'dark' ? '#334155' : '#e2e8f0'}`,
                            p: 0.5,
                            position: 'relative',
                            bgcolor: dadosMes.status === 'Cancelada' 
                              ? 'rgba(239, 68, 68, 0.02)' 
                              : (dadosMes.valorVenda === 0 
                                ? (theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.015)' : 'rgba(0, 0, 0, 0.01)')
                                : 'inherit'),
                            opacity: dadosMes.valorVenda === 0 ? 0.35 : 1,
                            '&:hover .edit-parcela-btn': permissoes.editarParcelas ? { opacity: 1 } : {}
                          }}
                        >
                          {editingCell?.vendaId === venda.id && editingCell?.mes === mesChaveReal ? (
                            <TextField
                              variant="standard"
                              type="number"
                              autoFocus
                              value={dadosMes.valorVenda === 0 ? '' : dadosMes.valorVenda}
                              onChange={(e) => {
                                const val = e.target.value === '' ? 0 : parseFloat(e.target.value);
                                handleAlterarValorMensal(venda.id, mesChaveReal, val);
                              }}
                              onBlur={() => setEditingCell(null)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  setEditingCell(null);
                                }
                              }}
                              placeholder="0"
                              slotProps={{
                                input: {
                                  disableUnderline: true,
                                  style: {
                                    textAlign: 'right',
                                    fontSize: '0.85rem',
                                    fontWeight: 500,
                                    fontFamily: 'Outfit, sans-serif'
                                  }
                                },
                                htmlInput: {
                                  style: {
                                    textAlign: 'right',
                                    paddingRight: '4px'
                                  }
                                }
                              }}
                              sx={{
                                width: '100%',
                                '& .MuiInputBase-input': {
                                  py: 0.5,
                                  px: 0.5,
                                  borderRadius: 1,
                                  transition: 'background 0.2s',
                                  background: theme.palette.mode === 'dark' ? '#0f172a' : '#f1f5f9',
                                  outline: `1px solid ${theme.palette.primary.main}`
                                }
                              }}
                            />
                          ) : (
                            <Box
                              onClick={() => permissoes.editarVendas && setEditingCell({ vendaId: venda.id, mes: mesChaveReal })}
                              sx={{
                                cursor: permissoes.editarVendas ? 'pointer' : 'default',
                                fontSize: '0.85rem',
                                fontWeight: 500,
                                fontFamily: 'Outfit, sans-serif',
                                textAlign: 'right',
                                py: 0.5,
                                px: 1,
                                borderRadius: 1,
                                minHeight: '38px',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'flex-end',
                                justifyContent: 'center',
                                transition: 'background 0.2s',
                                textDecoration: dadosMes.status === 'Cancelada' ? 'line-through' : 'none',
                                color: dadosMes.status === 'Cancelada' ? '#ef4444' : (dadosMes.valorVenda > 0 ? (theme.palette.mode === 'dark' ? '#f1f5f9' : '#1e293b') : '#94a3b8'),
                                '&:hover': permissoes.editarVendas ? {
                                  background: theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)'
                                } : {}
                              }}
                            >
                              {dadosMes.valorVenda > 0 ? (
                                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                                  <span style={{ fontWeight: 650 }}>{formatarMoeda(dadosMes.valorVenda)}</span>
                                  <Typography
                                    variant="caption"
                                    sx={{
                                      fontSize: '0.68rem',
                                      color: theme.palette.mode === 'dark' ? '#94a3b8' : '#64748b',
                                      fontWeight: 500,
                                      mt: 0.1
                                    }}
                                  >
                                    Parc: {formatarMoeda(dadosMes.valorParcela || (venda.valorParcela || 0))}
                                  </Typography>
                                  {dadosMes.dataVencimento && (
                                    <Typography
                                      variant="caption"
                                      sx={{
                                        fontSize: '0.6rem',
                                        color: dadosMes.status === 'Vencida'
                                          ? '#ef4444'
                                          : (theme.palette.mode === 'dark' ? '#64748b' : '#94a3b8'),
                                        fontWeight: 600,
                                        mt: 0.1
                                      }}
                                    >
                                      {(() => {
                                        const idx = obterIndiceParcela(venda, mesChaveReal);
                                        const dtFormato = dadosMes.dataVencimento.split('-').reverse().join('/');
                                        return idx === 1 ? `Venc: ${dtFormato}` : `${idx}ª Assemb: ${dtFormato}`;
                                      })()}
                                    </Typography>
                                  )}
                                  {/* Data de Recebimento (quando diferente do vencimento) */}
                                  {dadosMes.dataRecebimento && dadosMes.dataRecebimento !== dadosMes.dataVencimento && dadosMes.status !== 'Cancelada' && (
                                    <Typography
                                      variant="caption"
                                      sx={{
                                        fontSize: '0.58rem',
                                        color: '#10b981',
                                        fontWeight: 700,
                                        mt: 0.1,
                                        whiteSpace: 'nowrap'
                                      }}
                                    >
                                      🗓 Receb: {dadosMes.dataRecebimento.split('-').reverse().join('/')}
                                    </Typography>
                                  )}
                                  {dadosMes.dataPrevisaoRecebimento && dadosMes.status !== 'Cancelada' && (
                                    <Typography
                                      variant="caption"
                                      sx={{
                                        fontSize: '0.58rem',
                                        color: theme.palette.mode === 'dark' ? '#818cf8' : '#6366f1',
                                        fontWeight: 700,
                                        mt: 0.1,
                                        whiteSpace: 'nowrap',
                                        display: 'inline-block'
                                      }}
                                    >
                                      {(() => {
                                        const dtPrev = calcularDataPrevisaoRecebimento(dadosMes.dataVencimento || `${mes}-15`, ciclos);
                                        if (!dtPrev || dtPrev.includes('undefined')) return null;
                                        return `💰 ${dtPrev.split('-').reverse().join('/')}`;
                                      })()}
                                    </Typography>
                                  )}
                                </Box>
                              ) : venda.dataAssembleia?.substring(0, 7) === mes ? (
                                /* Marcador de registro de 1ª Assembleia (sem comissão) */
                                <Box
                                  sx={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'flex-end',
                                    py: 0.5,
                                    px: 1,
                                    minHeight: '38px',
                                    justifyContent: 'center'
                                  }}
                                >
                                  {venda.dataAssembleia && (
                                    <Typography
                                      variant="caption"
                                      sx={{
                                        fontSize: '0.6rem',
                                        color: theme.palette.mode === 'dark' ? '#64748b' : '#94a3b8',
                                        fontWeight: 500,
                                        mb: 0.3
                                      }}
                                    >
                                      {venda.dataAssembleia.split('-').reverse().join('/')}
                                    </Typography>
                                  )}
                                  <Box
                                    component="span"
                                    sx={{
                                      fontSize: '0.58rem',
                                      fontWeight: 700,
                                      px: 0.5,
                                      py: 0.1,
                                      borderRadius: 0.4,
                                      backgroundColor: 'rgba(245, 158, 11, 0.15)',
                                      color: '#f59e0b',
                                      textTransform: 'uppercase',
                                      display: 'inline-block',
                                      lineHeight: 1
                                    }}
                                  >
                                    1ª Assemb
                                  </Box>
                                </Box>
                              ) : venda.dataVenda?.substring(0, 7) === mes ? (
                                /* Marcador de registro de venda — visual idêntico ao badge de parcela */
                                <Box
                                  sx={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'flex-end',
                                    py: 0.5,
                                    px: 1,
                                    minHeight: '38px',
                                    justifyContent: 'center'
                                  }}
                                >
                                  {venda.dataVenda && (
                                    <Typography
                                      variant="caption"
                                      sx={{
                                        fontSize: '0.6rem',
                                        color: theme.palette.mode === 'dark' ? '#64748b' : '#94a3b8',
                                        fontWeight: 500,
                                        mb: 0.3
                                      }}
                                    >
                                      {venda.dataVenda.split('-').reverse().join('/')}
                                    </Typography>
                                  )}
                                  <Box
                                    component="span"
                                    sx={{
                                      fontSize: '0.58rem',
                                      fontWeight: 700,
                                      px: 0.5,
                                      py: 0.1,
                                      borderRadius: 0.4,
                                      backgroundColor: 'rgba(99, 102, 241, 0.15)',
                                      color: '#818cf8',
                                      textTransform: 'uppercase',
                                      display: 'inline-block',
                                      lineHeight: 1
                                    }}
                                  >
                                    Venda
                                  </Box>
                                </Box>
                              ) : ''}

                              {dadosMes.valorVenda > 0 && dadosMes.status !== 'Cancelada' && (
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
                                    mt: 0.2,
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
                          )}
                        </TableCell>

                        {/* Comissão Gerada - Apresenta o Valor, % do Mês, Seletor de Status e Botão de Cancelar */}
                        <TableCell
                          align="right"
                          sx={{
                            fontSize: '0.8rem',
                            fontWeight: 600,
                            borderRight: `1px solid ${theme.palette.mode === 'dark' ? '#334155' : '#e2e8f0'}`,
                            color: dadosMes.status === 'Cancelada' ? '#ef4444' : (dadosMes.comissaoGerada > 0 ? theme.palette.success.main : theme.palette.mode === 'dark' ? '#475569' : '#cbd5e1'),
                            bgcolor: dadosMes.status === 'Cancelada' 
                              ? 'rgba(239, 68, 68, 0.02)' 
                              : (dadosMes.valorVenda === 0 
                                ? (theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.015)' : 'rgba(0, 0, 0, 0.01)')
                                : 'inherit'),
                            opacity: dadosMes.valorVenda === 0 ? 0.35 : 1,
                            p: 0.5
                          }}
                        >
                          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 0.5 }}>
                            {dadosMes.comissaoGerada > 0 ? (
                              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', whiteSpace: 'nowrap' }}>
                                <span style={{ textDecoration: dadosMes.status === 'Cancelada' ? 'line-through' : 'none' }}>
                                  {formatarMoeda(dadosMes.comissaoGerada)}
                                </span>
                                <Typography
                                  component="span"
                                  sx={{
                                    fontSize: '0.65rem',
                                    color: dadosMes.status === 'Cancelada' ? '#ef4444' : (theme.palette.mode === 'dark' ? '#64748b' : '#94a3b8'),
                                    ml: 0.5,
                                    fontWeight: 500
                                  }}
                                >
                                  ({pctMensal}%)
                                </Typography>
                              </Box>
                            ) : ''}
                            
                            {/* Controle de Status da Parcela e Ação de Cancelar - Apenas exibidos se houver parcela ativa faturada no mês */}
                            {dadosMes.valorVenda > 0 && (
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                  {/* Select para Comissão Recebida */}
                                  {(permissoes.editarVendas || permissoes.receberParcelas) ? (
                                    <Select
                                      value={dadosMes.recebida ? 'Recebida' : 'A receber'}
                                      onChange={(e) => handleAlterarRecebidaParcela(venda.id, mesChaveReal, e.target.value === 'Recebida')}
                                      variant="standard"
                                      disableUnderline
                                      sx={{
                                        fontSize: '0.62rem',
                                        fontWeight: 700,
                                        color: dadosMes.recebida ? '#f97316' : '#64748b',
                                        '& .MuiSelect-select': {
                                          py: 0.1,
                                          px: 0.5,
                                          borderRadius: 0.5,
                                          background: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)'
                                        }
                                      }}
                                    >
                                      <MenuItem value="A receber" sx={{ fontSize: '0.7rem' }}>A receber</MenuItem>
                                      <MenuItem value="Recebida" sx={{ fontSize: '0.7rem' }}>Recebida</MenuItem>
                                    </Select>
                                  ) : (
                                    <Box
                                      sx={{
                                        fontSize: '0.62rem',
                                        fontWeight: 700,
                                        py: 0.1,
                                        px: 0.5,
                                        borderRadius: 0.5,
                                        color: dadosMes.recebida ? '#f97316' : '#64748b',
                                        background: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
                                        display: 'inline-block'
                                      }}
                                    >
                                      {dadosMes.recebida ? 'Recebida' : 'A receber'}
                                    </Box>
                                  )}

                                  {(permissoes.editarVendas || permissoes.receberParcelas) ? (
                                    <Select
                                      value={dadosMes.status}
                                      onChange={(e) => handleAlterarStatusParcela(venda.id, mesChaveReal, e.target.value as StatusParcela)}
                                      variant="standard"
                                      disableUnderline
                                      sx={{
                                        fontSize: '0.62rem',
                                        fontWeight: 700,
                                        color: dadosMes.status === 'Cancelada' ? '#ef4444' :
                                               dadosMes.recebida ? '#f97316' :
                                               dadosMes.status === 'Paga' ? '#34d399' :
                                               dadosMes.status === 'Vencida' ? '#ef4444' : '#3b82f6',
                                        '& .MuiSelect-select': {
                                          py: 0.1,
                                          px: 0.5,
                                          borderRadius: 0.5,
                                          background: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)'
                                        }
                                      }}
                                    >
                                      {(permissoes.editarVendas || dadosMes.status === 'A vencer') && <MenuItem value="A vencer" sx={{ fontSize: '0.7rem' }}>A vencer</MenuItem>}
                                      {(permissoes.editarVendas || dadosMes.status === 'Vencida') && <MenuItem value="Vencida" sx={{ fontSize: '0.7rem' }}>Vencida</MenuItem>}
                                      {(permissoes.editarVendas || dadosMes.status === 'Paga') && <MenuItem value="Paga" sx={{ fontSize: '0.7rem' }}>Paga</MenuItem>}
                                      {(permissoes.editarVendas || dadosMes.status === 'Cancelada') && <MenuItem value="Cancelada" sx={{ fontSize: '0.7rem' }}>Cancelada</MenuItem>}
                                    </Select>
                                  ) : (
                                    <Box
                                      sx={{
                                        fontSize: '0.62rem',
                                        fontWeight: 700,
                                        py: 0.1,
                                        px: 0.5,
                                        borderRadius: 0.5,
                                        color: dadosMes.status === 'Cancelada' ? '#ef4444' :
                                               dadosMes.recebida ? '#f97316' :
                                               dadosMes.status === 'Paga' ? '#34d399' :
                                               dadosMes.status === 'Vencida' ? '#ef4444' : '#3b82f6',
                                        background: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
                                        display: 'inline-block'
                                      }}
                                    >
                                      {dadosMes.recebida ? 'Recebida' : dadosMes.status}
                                    </Box>
                                  )}

                                  {permissoes.editarVendas && dadosMes.status !== 'Cancelada' && (
                                    <IconButton
                                      size="small"
                                      onClick={() => handleCancelarAPartirDoMes(venda.id, mesChaveReal)}
                                      sx={{
                                        p: 0.1,
                                        color: theme.palette.error.main,
                                        '&:hover': {
                                          background: 'rgba(239, 68, 68, 0.15)'
                                        }
                                      }}
                                      title="Cancelar esta e as demais parcelas"
                                    >
                                      <BlockIcon sx={{ fontSize: 10 }} />
                                    </IconButton>
                                      )}
                                  {/* Botão de edição individual de parcela */}
                                  {permissoes.editarParcelas && dadosMes.valorVenda > 0 && (
                                    <IconButton
                                      className="edit-parcela-btn"
                                      size="small"
                                      onClick={() => setEditandoParcela({ vendaId: venda.id, mesChave: mesChaveReal })}
                                      sx={{
                                        p: 0.1,
                                        opacity: 0,
                                        transition: 'opacity 0.2s',
                                        color: theme.palette.primary.main,
                                        '&:hover': {
                                          background: 'rgba(99, 102, 241, 0.15)'
                                        }
                                      }}
                                      title="Editar parcela individualmente"
                                    >
                                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                                      </svg>
                                    </IconButton>
                                  )}
                              </Box>
                            )}
                          </Box>
                        </TableCell>
                      </React.Fragment>
                    );
                  })}

                  {/* Totais Consolidados por Linha Filtrados */}
                  {(() => {
                    const { totalVendasPeriodo, totalComissoesPeriodo } = obterTotaisFiltrados(venda);
                    return (
                      <React.Fragment>
                        <TableCell
                          align="right"
                          sx={{
                            fontWeight: 700,
                            color: theme.palette.mode === 'dark' ? '#f8fafc' : '#0f172a',
                            borderLeft: `2px solid ${theme.palette.mode === 'dark' ? '#334155' : '#cbd5e1'}`,
                            bgcolor: theme.palette.mode === 'dark' ? 'rgba(99, 102, 241, 0.05)' : 'rgba(99, 102, 241, 0.02)'
                          }}
                        >
                          {formatarMoeda(totalVendasPeriodo)}
                        </TableCell>
                        <TableCell
                          align="right"
                          sx={{
                            fontWeight: 700,
                            color: theme.palette.success.main,
                            bgcolor: theme.palette.mode === 'dark' ? 'rgba(16, 185, 129, 0.05)' : 'rgba(16, 185, 129, 0.02)'
                          }}
                        >
                          {formatarMoeda(totalComissoesPeriodo)}
                        </TableCell>
                      </React.Fragment>
                    );
                  })()}


                </TableRow>
              ))
            )}

            {/* Linha de Totais Consolidados do Rodapé */}
            {vendas.length > 0 && (
              <TableRow sx={{ bgcolor: theme.palette.mode === 'dark' ? '#0f172a' : '#f8fafc', fontWeight: 'bold' }}>
                <TableCell
                  sx={{
                    fontWeight: 750,
                    color: theme.palette.mode === 'dark' ? '#f8fafc' : '#0f172a',
                    position: 'sticky',
                    bottom: 0,
                    left: 0,
                    minWidth: 320,
                    background: theme.palette.mode === 'dark' ? '#0f172a' : '#f8fafc',
                    zIndex: 4,
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
                    bottom: 0,
                    left: 320,
                    minWidth: 200,
                    background: theme.palette.mode === 'dark' ? '#0f172a' : '#f8fafc',
                    zIndex: 4,
                    borderRight: `2px solid ${theme.palette.mode === 'dark' ? '#475569' : '#cbd5e1'}`
                  }}
                />

                {mesesFiltrados.map((mes) => {
                  const mVal = totaisGerais.mensais[mes];
                  return (
                    <React.Fragment key={`total-${mes}`}>
                      {/* Vendas do Mês */}
                      <TableCell
                        align="right"
                        sx={{
                          fontWeight: 700,
                          color: theme.palette.mode === 'dark' ? '#f8fafc' : '#0f172a',
                          borderTop: `2px solid ${theme.palette.mode === 'dark' ? '#475569' : '#cbd5e1'}`,
                          borderLeft: `1px solid ${theme.palette.mode === 'dark' ? '#334155' : '#e2e8f0'}`,
                          fontSize: '0.8rem',
                          position: 'sticky',
                          bottom: 0,
                          zIndex: 2,
                          background: theme.palette.mode === 'dark' ? '#0f172a' : '#f8fafc',
                        }}
                      >
                        {formatarMoeda(mVal.vendas)}
                      </TableCell>
                      {/* Comissões do Mês */}
                      <TableCell
                        align="right"
                        sx={{
                          fontWeight: 700,
                          color: theme.palette.success.main,
                          borderTop: `2px solid ${theme.palette.mode === 'dark' ? '#475569' : '#cbd5e1'}`,
                          fontSize: '0.8rem',
                          position: 'sticky',
                          bottom: 0,
                          zIndex: 2,
                          background: theme.palette.mode === 'dark' ? '#0f172a' : '#f8fafc',
                        }}
                      >
                        {formatarMoeda(mVal.comissoes)}
                      </TableCell>
                    </React.Fragment>
                  );
                })}

                {/* Totais Gerais Globais */}
                <TableCell
                  align="right"
                  sx={{
                    fontWeight: 800,
                    color: theme.palette.mode === 'dark' ? '#f8fafc' : '#0f172a',
                    borderTop: `2px solid ${theme.palette.mode === 'dark' ? '#475569' : '#cbd5e1'}`,
                    borderLeft: `2px solid ${theme.palette.mode === 'dark' ? '#475569' : '#cbd5e1'}`,
                    bgcolor: theme.palette.mode === 'dark' ? 'rgba(99, 102, 241, 0.15)' : 'rgba(99, 102, 241, 0.05)',
                    fontSize: '0.85rem',
                    position: 'sticky',
                    bottom: 0,
                    zIndex: 2,
                  }}
                >
                  {formatarMoeda(totaisGerais.totalGeralVendas)}
                </TableCell>
                <TableCell
                  align="right"
                  sx={{
                    fontWeight: 800,
                    color: theme.palette.success.main,
                    borderTop: `2px solid ${theme.palette.mode === 'dark' ? '#475569' : '#cbd5e1'}`,
                    bgcolor: theme.palette.mode === 'dark' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(16, 185, 129, 0.05)',
                    fontSize: '0.85rem',
                    position: 'sticky',
                    bottom: 0,
                    zIndex: 2,
                  }}
                >
                  {formatarMoeda(totaisGerais.totalGeralComissoes)}
                </TableCell>


              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
    )}

      {/* ========== ABA RESUMO POR VENDA ========== */}
      {abaInterna === 'resumo' && (
        <Box>
          <TableContainer
            component={Paper}
            elevation={0}
            sx={{
              borderRadius: 4,
              border: `1px solid ${theme.palette.mode === 'dark' ? '#334155' : '#e2e8f0'}`,
              background: theme.palette.mode === 'dark' ? '#1e293b' : '#ffffff',
              overflow: 'auto',
              maxHeight: 'calc(100vh - 260px)',
              maxWidth: '100%'
            }}
          >
            <Table size="small" sx={{ minWidth: 1500, borderCollapse: 'separate', borderSpacing: 0 }}>
              <TableHead sx={{
                background: theme.palette.mode === 'dark' ? '#0f172a' : '#f8fafc',
                position: 'sticky', top: 0, zIndex: 10
              }}>
                <TableRow>
                  {/* Cliente */}
                  <TableCell sx={{
                    fontWeight: 700, fontSize: '0.75rem',
                    color: theme.palette.mode === 'dark' ? '#cbd5e1' : '#475569',
                    borderBottom: `2px solid ${theme.palette.mode === 'dark' ? '#334155' : '#cbd5e1'}`,
                    minWidth: 260,
                    position: 'sticky', left: 0,
                    background: theme.palette.mode === 'dark' ? '#0f172a' : '#f8fafc',
                    zIndex: 5
                  }}>
                    Cliente / Projeto
                  </TableCell>
                  {/* Tabela / Parcelas */}
                  <TableCell sx={{
                    fontWeight: 700, fontSize: '0.75rem',
                    color: theme.palette.mode === 'dark' ? '#cbd5e1' : '#475569',
                    borderBottom: `2px solid ${theme.palette.mode === 'dark' ? '#334155' : '#cbd5e1'}`,
                    minWidth: 220,
                    position: 'sticky', left: 260,
                    background: theme.palette.mode === 'dark' ? '#0f172a' : '#f8fafc',
                    zIndex: 5,
                    borderRight: `2px solid ${theme.palette.mode === 'dark' ? '#475569' : '#cbd5e1'}`
                  }}>
                    Tabela / Regra
                  </TableCell>

                  {/* Meses Filtrados */}
                  {mesesFiltrados.map((mes) => (
                    <TableCell
                      key={mes}
                      align="right"
                      sx={{
                        fontWeight: 700, fontSize: '0.75rem',
                        textTransform: 'capitalize',
                        borderBottom: `2px solid ${theme.palette.mode === 'dark' ? '#334155' : '#cbd5e1'}`,
                        borderLeft: `1px solid ${theme.palette.mode === 'dark' ? '#334155' : '#e2e8f0'}`,
                        color: theme.palette.mode === 'dark' ? '#e2e8f0' : '#334155',
                        minWidth: 150,
                        whiteSpace: 'nowrap'
                      }}
                    >
                      {formatarChaveMesExibicao(mes)} (V / C)
                    </TableCell>
                  ))}

                  {/* Totais Consolidados por Linha Filtrados */}
                  <TableCell
                    align="right"
                    sx={{
                      fontWeight: 700, fontSize: '0.75rem',
                      color: theme.palette.mode === 'dark' ? '#cbd5e1' : '#475569',
                      borderBottom: `2px solid ${theme.palette.mode === 'dark' ? '#334155' : '#cbd5e1'}`,
                      borderLeft: `2px solid ${theme.palette.mode === 'dark' ? '#475569' : '#cbd5e1'}`,
                      minWidth: 130
                    }}
                  >
                    Total Vendas
                  </TableCell>
                  <TableCell
                    align="right"
                    sx={{
                      fontWeight: 700, fontSize: '0.75rem',
                      color: theme.palette.success.main,
                      borderBottom: `2px solid ${theme.palette.mode === 'dark' ? '#334155' : '#cbd5e1'}`,
                      minWidth: 130
                    }}
                  >
                    Total Comissões
                  </TableCell>

                  {/* Ações */}
                  {permissoes.editarVendas && (
                    <TableCell
                      align="center"
                      sx={{
                        fontWeight: 700, fontSize: '0.75rem',
                        color: theme.palette.mode === 'dark' ? '#cbd5e1' : '#475569',
                        borderBottom: `2px solid ${theme.palette.mode === 'dark' ? '#334155' : '#cbd5e1'}`,
                        minWidth: 85
                      }}
                    >
                      Ações
                    </TableCell>
                  )}
                </TableRow>
              </TableHead>

              <TableBody>
                {vendasFiltradasPorPac.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5 + mesesFiltrados.length} align="center" sx={{ py: 6, color: theme.palette.mode === 'dark' ? '#475569' : '#94a3b8' }}>
                      Nenhuma venda encontrada para os filtros selecionados.
                    </TableCell>
                  </TableRow>
                )}

                {vendasFiltradasPorPac.map((venda, idx) => {
                  const { totalVendasPeriodo, totalComissoesPeriodo } = obterTotaisFiltrados(venda);
                  return (
                    <TableRow
                      key={venda.id}
                      sx={{
                        bgcolor: idx % 2 === 0
                          ? (theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.012)' : 'rgba(0,0,0,0.008)')
                          : 'transparent',
                        '&:hover': {
                          bgcolor: theme.palette.mode === 'dark' ? 'rgba(99,102,241,0.07)' : 'rgba(99,102,241,0.04)'
                        },
                        opacity: venda.statusCliente === 'Cancelado' ? 0.6 : 1,
                        transition: 'background 0.15s',
                        borderBottom: `1px solid ${theme.palette.mode === 'dark' ? '#1e293b' : '#f1f5f9'}`
                      }}
                    >
                      {/* Cliente / Vendedor (Sticky) */}
                      <TableCell sx={{
                        position: 'sticky', left: 0,
                        background: theme.palette.mode === 'dark' ? '#1e293b' : '#ffffff',
                        zIndex: 2,
                        borderRight: `1px solid ${theme.palette.mode === 'dark' ? '#334155' : '#e2e8f0'}`,
                        py: 0.8
                      }}>
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.2 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8, flexWrap: 'wrap' }}>
                            <Typography
                              component="span"
                              onClick={() => permissoes.editarVendas && handleIniciarEdicao(venda)}
                              sx={{
                                fontSize: '0.82rem', fontWeight: 650,
                                cursor: permissoes.editarVendas ? 'pointer' : 'default',
                                textDecoration: venda.statusCliente === 'Cancelado' ? 'line-through' : 'none',
                                '&:hover': permissoes.editarVendas ? { textDecoration: 'underline', color: theme.palette.primary.main } : {}
                              }}
                            >
                              {venda.cliente}
                            </Typography>
                            {venda.pac && (
                              <Chip label={venda.pac} size="small" color="secondary" variant="outlined"
                                sx={{ height: 16, fontSize: '0.58rem', fontWeight: 700, borderRadius: 1 }} />
                            )}
                          </Box>
                          {venda.vendedorNome && (
                            <Typography variant="caption" sx={{ fontSize: '0.68rem', color: theme.palette.primary.main, fontWeight: 500 }}>
                              Vend: {venda.vendedorNome}
                            </Typography>
                          )}
                        </Box>
                      </TableCell>

                      {/* Tabela / Parcelas (Sticky) */}
                      <TableCell sx={{
                        position: 'sticky', left: 260,
                        background: theme.palette.mode === 'dark' ? '#1e293b' : '#ffffff',
                        zIndex: 2,
                        borderRight: `2px solid ${theme.palette.mode === 'dark' ? '#475569' : '#cbd5e1'}`,
                        py: 0.8
                      }}>
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.2 }}>
                          <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>{venda.tabela}</span>
                          <span style={{ fontSize: '0.65rem', color: theme.palette.text.secondary }}>{venda.qtdParcelas}x de {formatarMoeda(venda.valorParcela)}</span>
                          {(venda.administradoraNome || venda.administradoraId) && (
                            <Chip
                              icon={<AccountBalanceIcon sx={{ fontSize: 11 }} />}
                              label={venda.administradoraNome || administradoras.find(a => a.id === venda.administradoraId)?.nome || venda.administradoraId}
                              size="small"
                              sx={{
                                width: 'fit-content',
                                height: 17,
                                fontSize: '0.62rem',
                                fontWeight: 600,
                                bgcolor: 'rgba(99, 102, 241, 0.08)',
                                color: '#818cf8',
                                borderRadius: 1.2,
                                mt: 0.2
                              }}
                            />
                          )}
                        </Box>
                      </TableCell>

                      {/* Projeção Mês a Mês simplificada */}
                      {mesesFiltrados.map((mes) => {
                        let dadosMes = venda.projecaoMensal[mes] || {
                          valorVenda: 0,
                          comissaoGerada: 0,
                          status: 'A vencer' as StatusParcela,
                          recebida: false,
                          dataVencimento: `${mes}-15`
                        };

                        if (tipoFiltro === 'vendas' && mes !== venda.mesInicio) {
                          dadosMes = { ...dadosMes, valorVenda: 0, comissaoGerada: 0 };
                        }
                        if (tipoFiltro === 'recorrencia' && mes === venda.mesInicio) {
                          dadosMes = { ...dadosMes, valorVenda: 0, comissaoGerada: 0 };
                        }
                        if (filtroStatus !== 'Todos' && dadosMes.valorVenda > 0) {
                           const statusEfCel = obterStatusEfetivo(dadosMes.status, dadosMes.dataVencimento || `${mes}-15`);
                           const isRecebida = dadosMes.recebida || false;
                           if (filtroStatus === 'Recebida') {
                             if (!isRecebida) {
                               dadosMes = { ...dadosMes, valorVenda: 0, comissaoGerada: 0 };
                             }
                           } else {
                             if (isRecebida || statusEfCel !== filtroStatus) {
                               dadosMes = { ...dadosMes, valorVenda: 0, comissaoGerada: 0 };
                             }
                           }
                         }

                        const temFaturamento = dadosMes.valorVenda > 0;

                        return (
                          <TableCell
                            key={mes}
                            align="right"
                            sx={{
                              py: 0.8,
                              borderLeft: `1px solid ${theme.palette.mode === 'dark' ? '#334155' : '#e2e8f0'}`,
                              opacity: temFaturamento ? 1 : 0.25
                            }}
                          >
                            {temFaturamento ? (
                              <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'right', alignItems: 'center', whiteSpace: 'nowrap', fontSize: '0.78rem' }}>
                                <span style={{ fontWeight: 600, color: dadosMes.status === 'Cancelada' ? '#ef4444' : 'inherit' }}>
                                  {formatarMoeda(dadosMes.valorVenda)}
                                </span>
                                <span style={{ color: theme.palette.text.secondary }}>/</span>
                                <span style={{ color: theme.palette.success.main, fontWeight: 700 }}>
                                  {formatarMoeda(dadosMes.comissaoGerada)}
                                </span>
                              </Box>
                            ) : (
                              <span style={{ color: theme.palette.text.secondary, fontSize: '0.8rem' }}>—</span>
                            )}
                          </TableCell>
                        );
                      })}

                      {/* Totais da venda no período */}
                      <TableCell
                        align="right"
                        sx={{
                          py: 0.8,
                          borderLeft: `2px solid ${theme.palette.mode === 'dark' ? '#334155' : '#e2e8f0'}`,
                          bgcolor: theme.palette.mode === 'dark' ? 'rgba(99, 102, 241, 0.02)' : 'rgba(99, 102, 241, 0.01)'
                        }}
                      >
                        <Typography sx={{ fontSize: '0.85rem', fontWeight: 750 }}>
                          {formatarMoeda(totalVendasPeriodo)}
                        </Typography>
                      </TableCell>
                      <TableCell
                        align="right"
                        sx={{
                          py: 0.8,
                          bgcolor: theme.palette.mode === 'dark' ? 'rgba(16, 185, 129, 0.02)' : 'rgba(16, 185, 129, 0.01)'
                        }}
                      >
                        <Typography sx={{ fontSize: '0.85rem', fontWeight: 750, color: theme.palette.success.main }}>
                          {formatarMoeda(totalComissoesPeriodo)}
                        </Typography>
                      </TableCell>

                      {/* Ações */}
                      {permissoes.editarVendas && (
                        <TableCell align="center" sx={{ py: 0.8 }}>
                          <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'center' }}>
                            <IconButton
                              size="small"
                              onClick={() => handleIniciarEdicao(venda)}
                              sx={{
                                p: 0.5,
                                color: theme.palette.primary.main,
                                bgcolor: theme.palette.mode === 'dark' ? 'rgba(99,102,241,0.12)' : 'rgba(99,102,241,0.08)',
                                borderRadius: 1.5,
                                '&:hover': { bgcolor: theme.palette.mode === 'dark' ? 'rgba(99,102,241,0.25)' : 'rgba(99,102,241,0.18)' }
                              }}
                              title="Editar venda"
                            >
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                              </svg>
                            </IconButton>
                            {isMaster && (
                              <IconButton
                                size="small"
                                onClick={() => setVendaParaExcluir(venda.id)}
                                sx={{
                                  p: 0.5,
                                  color: '#ef4444',
                                  bgcolor: theme.palette.mode === 'dark' ? 'rgba(239,68,68,0.12)' : 'rgba(239,68,68,0.07)',
                                  borderRadius: 1.5,
                                  '&:hover': { bgcolor: 'rgba(239,68,68,0.22)' }
                                }}
                                title="Excluir venda"
                              >
                                <DeleteIcon sx={{ fontSize: '0.85rem' }} />
                              </IconButton>
                            )}
                          </Box>
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>

              {/* Rodapé de totais consolidados mês a mês */}
              {vendasFiltradasPorPac.length > 0 && (
                <TableBody>
                  <TableRow sx={{ bgcolor: theme.palette.mode === 'dark' ? '#0f172a' : '#f8fafc', position: 'sticky', bottom: 0, zIndex: 3 }}>
                    <TableCell colSpan={2} sx={{
                      fontWeight: 750, fontSize: '0.78rem',
                      color: theme.palette.mode === 'dark' ? '#f8fafc' : '#0f172a',
                      borderTop: `2px solid ${theme.palette.mode === 'dark' ? '#475569' : '#cbd5e1'}`,
                      borderRight: `2px solid ${theme.palette.mode === 'dark' ? '#475569' : '#cbd5e1'}`,
                      position: 'sticky', left: 0,
                      background: theme.palette.mode === 'dark' ? '#0f172a' : '#f8fafc',
                      zIndex: 4
                    }}>
                      TOTAL CONSOLIDADO
                    </TableCell>

                    {mesesFiltrados.map((mes) => {
                      const mVal = totaisGerais.mensais[mes];
                      return (
                        <TableCell
                          key={`total-resumo-${mes}`}
                          align="right"
                          sx={{
                            fontWeight: 700,
                            borderTop: `2px solid ${theme.palette.mode === 'dark' ? '#475569' : '#cbd5e1'}`,
                            borderLeft: `1px solid ${theme.palette.mode === 'dark' ? '#334155' : '#e2e8f0'}`,
                            fontSize: '0.78rem',
                            bgcolor: theme.palette.mode === 'dark' ? '#0f172a' : '#f8fafc'
                          }}
                        >
                          <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'right', whiteSpace: 'nowrap' }}>
                            <span style={{ fontWeight: 700 }}>{formatarMoeda(mVal.vendas)}</span>
                            <span style={{ color: theme.palette.text.secondary }}>/</span>
                            <span style={{ color: theme.palette.success.main, fontWeight: 800 }}>{formatarMoeda(mVal.comissoes)}</span>
                          </Box>
                        </TableCell>
                      );
                    })}

                    {/* Finais Globais */}
                    <TableCell
                      align="right"
                      sx={{
                        fontWeight: 800, fontSize: '0.88rem',
                        color: theme.palette.mode === 'dark' ? '#f1f5f9' : '#0f172a',
                        borderTop: `2px solid ${theme.palette.mode === 'dark' ? '#475569' : '#cbd5e1'}`,
                        borderLeft: `2px solid ${theme.palette.mode === 'dark' ? '#475569' : '#cbd5e1'}`,
                        bgcolor: theme.palette.mode === 'dark' ? 'rgba(99, 102, 241, 0.15)' : 'rgba(99, 102, 241, 0.05)'
                      }}
                    >
                      {formatarMoeda(totaisGerais.totalGeralVendas)}
                    </TableCell>
                    <TableCell
                      align="right"
                      sx={{
                        fontWeight: 800, fontSize: '0.88rem',
                        color: theme.palette.success.main,
                        borderTop: `2px solid ${theme.palette.mode === 'dark' ? '#475569' : '#cbd5e1'}`,
                        bgcolor: theme.palette.mode === 'dark' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(16, 185, 129, 0.05)'
                      }}
                    >
                      {formatarMoeda(totaisGerais.totalGeralComissoes)}
                    </TableCell>
                    {permissoes.editarVendas && (
                      <TableCell sx={{
                        borderTop: `2px solid ${theme.palette.mode === 'dark' ? '#475569' : '#cbd5e1'}`,
                        bgcolor: theme.palette.mode === 'dark' ? '#0f172a' : '#f8fafc'
                      }} />
                    )}
                  </TableRow>
                </TableBody>
              )}
            </Table>
          </TableContainer>
        </Box>
      )}

      {abaInterna === 'timeline' && (
        <TableContainer
          component={Paper}
          elevation={0}
          sx={{
            borderRadius: 4,
            border: `1px solid ${theme.palette.mode === 'dark' ? '#334155' : '#e2e8f0'}`,
            background: theme.palette.mode === 'dark' ? '#1e293b' : '#ffffff',
            overflow: 'auto',
            maxHeight: 'calc(100vh - 260px)'
          }}
        >
          <Table stickyHeader size="small">
            <TableHead sx={{ background: theme.palette.mode === 'dark' ? '#0f172a' : '#f8fafc' }}>
              <TableRow>
                <TableCell sx={{ fontWeight: 700, py: 1.5 }}>Mês Ref.</TableCell>
                <TableCell sx={{ fontWeight: 700, py: 1.5 }}>Cliente</TableCell>
                <TableCell sx={{ fontWeight: 700, py: 1.5 }}>Corretor / Vendedor</TableCell>
                <TableCell sx={{ fontWeight: 700, py: 1.5 }}>Segmento / Tabela</TableCell>
                <TableCell align="right" sx={{ fontWeight: 700, py: 1.5 }}>Parcela</TableCell>
                <TableCell align="center" sx={{ fontWeight: 700, py: 1.5 }}>Vencimento</TableCell>
                <TableCell align="center" sx={{ fontWeight: 700, py: 1.5, color: theme.palette.mode === 'dark' ? '#818cf8' : '#6366f1' }}>Prev. Recebimento</TableCell>
                <TableCell align="right" sx={{ fontWeight: 700, py: 1.5 }}>Valor Parcela</TableCell>
                <TableCell align="right" sx={{ fontWeight: 700, py: 1.5, color: theme.palette.success.main }}>
                  Comissão Master (Empresa)
                </TableCell>
                <TableCell align="center" sx={{ fontWeight: 700, py: 1.5 }}>Status</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {parcelasEmpresaTimeline.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} align="center" sx={{ py: 6, color: 'text.secondary' }}>
                    Nenhuma venda ou parcela ativa registrada no sistema.
                  </TableCell>
                </TableRow>
              ) : (
                parcelasEmpresaTimeline.map((linha) => (
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
                    <TableCell sx={{ fontWeight: 600 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8, flexWrap: 'wrap' }}>
                        <span>{linha.cliente}</span>
                        {linha.pac && (
                          <Chip
                            label={linha.pac}
                            size="small"
                            color="secondary"
                            variant="outlined"
                            sx={{ height: 16, fontSize: '0.58rem', fontWeight: 700, borderRadius: 1 }}
                          />
                        )}
                      </Box>
                    </TableCell>
                    <TableCell sx={{ fontWeight: 500, color: theme.palette.primary.main }}>
                      {linha.vendedorNome || '-'}
                    </TableCell>
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
                    <TableCell align="center">
                      <Typography variant="caption" sx={{ fontWeight: 600, fontSize: '0.75rem', color: linha.status === 'Vencida' ? '#ef4444' : (theme.palette.mode === 'dark' ? '#94a3b8' : '#64748b') }}>
                        {linha.parcelaIndex === 1
                          ? `Venda: ${linha.dataVencimento?.split('-').reverse().join('/')}`
                          : `${linha.parcelaIndex}ª Assemb: ${linha.dataVencimento?.split('-').reverse().join('/')}`}
                      </Typography>
                    </TableCell>
                    <TableCell align="center">
                      <Typography variant="caption" sx={{ fontWeight: 700, fontSize: '0.75rem', color: theme.palette.mode === 'dark' ? '#818cf8' : '#6366f1', whiteSpace: 'nowrap' }}>
                        {(() => {
                          const dtPrev = calcularDataPrevisaoRecebimento(linha.dataVencimento, ciclos);
                          if (!dtPrev || dtPrev.includes('undefined')) return null;
                          return `💰 ${dtPrev.split('-').reverse().join('/')}`;
                        })()}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      {formatarMoeda(linha.valorParcela)}
                    </TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700, color: theme.palette.success.main }}>
                      {formatarMoeda(linha.comissaoMaster)}
                    </TableCell>
                    <TableCell align="center">
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5 }}>
                        {/* Select para Comissão Recebida na Timeline */}
                        {(permissoes.editarVendas || permissoes.receberParcelas) ? (
                          <Select
                            value={linha.recebida ? 'Recebida' : 'A receber'}
                            onChange={(e) => handleAlterarRecebidaParcela(linha.vendaId, linha.mesChave, e.target.value === 'Recebida')}
                            variant="standard"
                            disableUnderline
                            sx={{
                              fontSize: '0.62rem',
                              fontWeight: 700,
                              color: linha.recebida ? '#f97316' : '#64748b',
                              '& .MuiSelect-select': {
                                py: 0.1,
                                px: 0.5,
                                borderRadius: 0.5,
                                background: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)'
                              }
                            }}
                          >
                            <MenuItem value="A receber" sx={{ fontSize: '0.7rem' }}>A receber</MenuItem>
                            <MenuItem value="Recebida" sx={{ fontSize: '0.7rem' }}>Recebida</MenuItem>
                          </Select>
                        ) : (
                          <Box
                            sx={{
                              fontSize: '0.62rem',
                              fontWeight: 700,
                              py: 0.1,
                              px: 0.5,
                              borderRadius: 0.5,
                              color: linha.recebida ? '#f97316' : '#64748b',
                              background: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
                              display: 'inline-block'
                            }}
                          >
                            {linha.recebida ? 'Recebida' : 'A receber'}
                          </Box>
                        )}

                        {(permissoes.editarVendas || permissoes.receberParcelas) ? (
                          <Select
                            value={linha.status}
                            onChange={(e) => handleAlterarStatusParcela(linha.vendaId, linha.mesChave, e.target.value as StatusParcela)}
                            variant="standard"
                            disableUnderline
                            sx={{
                              fontSize: '0.62rem',
                              fontWeight: 700,
                              color: linha.status === 'Cancelada' ? '#ef4444' :
                                     linha.recebida ? '#f97316' :
                                     linha.status === 'Paga' ? '#34d399' :
                                     linha.status === 'Vencida' ? '#ef4444' : '#3b82f6',
                              '& .MuiSelect-select': {
                                py: 0.1,
                                px: 0.5,
                                borderRadius: 0.5,
                                background: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)'
                              }
                            }}
                          >
                            {(permissoes.editarVendas || linha.status === 'A vencer') && <MenuItem value="A vencer" sx={{ fontSize: '0.7rem' }}>A vencer</MenuItem>}
                            {(permissoes.editarVendas || linha.status === 'Vencida') && <MenuItem value="Vencida" sx={{ fontSize: '0.7rem' }}>Vencida</MenuItem>}
                            {(permissoes.editarVendas || linha.status === 'Paga') && <MenuItem value="Paga" sx={{ fontSize: '0.7rem' }}>Paga</MenuItem>}
                            {(permissoes.editarVendas || linha.status === 'Cancelada') && <MenuItem value="Cancelada" sx={{ fontSize: '0.7rem' }}>Cancelada</MenuItem>}
                          </Select>
                        ) : (
                          <Box
                            sx={{
                              fontSize: '0.62rem',
                              fontWeight: 700,
                              py: 0.1,
                              px: 0.5,
                              borderRadius: 0.5,
                              color: linha.status === 'Cancelada' ? '#ef4444' :
                                     linha.recebida ? '#f97316' :
                                     linha.status === 'Paga' ? '#34d399' :
                                     linha.status === 'Vencida' ? '#ef4444' : '#3b82f6',
                              background: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
                              display: 'inline-block'
                            }}
                          >
                            {linha.recebida ? 'Recebida' : linha.status}
                          </Box>
                        )}
                      </Box>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}




      {/* Dialog para Nova Venda */}
      <NovaVendaDialog
        open={openDialog}
        onClose={handleCloseDialog}
        onSave={(novaVenda) => {
          onAdicionarVenda(novaVenda);
          handleCloseDialog();
          mostrarSnackbar('✅ Venda lançada com sucesso!');
        }}
        vendedores={vendedores}
        regras={regras}
        ciclos={ciclos}
        administradoras={administradoras}
      />

      {/* Dialog de Confirmação para Excluir Venda */}
      <Dialog
        open={vendaParaExcluir !== null}
        onClose={() => setVendaParaExcluir(null)}
        slotProps={{
          paper: {
            sx: {
              borderRadius: 3,
              background: theme.palette.mode === 'dark' ? '#1e293b' : '#ffffff',
              backgroundImage: 'none',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3), 0 10px 10px -5px rgba(0, 0, 0, 0.2)'
            }
          }
        }}
      >
        <DialogTitle sx={{ fontFamily: 'Outfit, sans-serif', fontWeight: 700 }}>
          Confirmar Exclusão
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ color: 'text.secondary', mt: 1 }}>
            Tem certeza que deseja excluir esta venda? Esta ação é permanente e removerá todas as parcelas faturadas, projeções mensais e comissões associadas a esta venda.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, pt: 1 }}>
          <Button
            onClick={() => setVendaParaExcluir(null)}
            sx={{
              borderRadius: 2,
              textTransform: 'none',
              fontWeight: 600,
              color: theme.palette.mode === 'dark' ? '#94a3b8' : '#64748b'
            }}
          >
            Cancelar
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={() => {
              if (vendaParaExcluir) {
                onExcluirVenda(vendaParaExcluir);
                setVendaParaExcluir(null);
              }
            }}
            sx={{
              borderRadius: 2,
              textTransform: 'none',
              fontWeight: 600,
              boxShadow: '0 4px 10px rgba(239, 68, 68, 0.2)'
            }}
          >
            Confirmar Exclusão
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog para Editar Venda */}
      <EditarVendaDialog
        open={openEditDialog}
        onClose={() => {
          setOpenEditDialog(false);
          setVendaEmEdicao(null);
        }}
        onSave={(vendaAtualizada) => {
          onAtualizarVenda(vendaAtualizada);
          setOpenEditDialog(false);
          setVendaEmEdicao(null);
          mostrarSnackbar('✅ Venda atualizada com sucesso!');
        }}
        venda={vendaEmEdicao}
        vendedores={vendedores}
        regras={regras}
        ciclos={ciclos}
        administradoras={administradoras}
      />

      {/* Dialog de Edição Individual de Parcela */}
      {editandoParcela && (() => {
        const venda = vendas.find(v => v.id === editandoParcela.vendaId);
        const celula = venda?.projecaoMensal[editandoParcela.mesChave];
        if (!venda || !celula) return null;
        return (
          <EditarParcelaDialog
            open={!!editandoParcela}
            onClose={() => setEditandoParcela(null)}
            onSave={(campos) => {
              handleAlterarParcelaCompleta(editandoParcela.vendaId, editandoParcela.mesChave, campos);
              setEditandoParcela(null);
              mostrarSnackbar('✅ Parcela atualizada com sucesso!');
            }}
            mesChave={editandoParcela.mesChave}
            celula={celula}
            nomeCliente={venda.cliente}
          />
        );
      })()}

      {/* Snackbar de sucesso */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={3500}
        onClose={handleCloseSnackbar}
        slots={{ transition: Slide }}
        slotProps={{ transition: { direction: 'up' } as object }}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={handleCloseSnackbar}
          severity={snackbar.severity}
          variant="filled"
          sx={{
            fontFamily: 'Outfit, sans-serif',
            fontWeight: 700,
            fontSize: '0.95rem',
            borderRadius: 3,
            boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
            minWidth: '280px',
            '& .MuiAlert-icon': { fontSize: '1.3rem' }
          }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

// ==========================================
// Subcomponentes Modulares de Dialogs (Evitam Lag de Digitação no Componente Principal)
// ==========================================

// EditarParcelaDialog — Dialog para edição individual de uma parcela (requer permissão editarParcelas)
interface EditarParcelaDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (campos: { dataVencimento?: string; dataRecebimento?: string; valorParcela?: number; comissaoGerada?: number; status?: StatusParcela; recebida?: boolean }) => void;
  mesChave: string;
  celula: MesProjecao;
  nomeCliente: string;
}

const EditarParcelaDialog: React.FC<EditarParcelaDialogProps> = ({ open, onClose, onSave, mesChave, celula, nomeCliente }) => {
  const theme = useTheme();
  const [dataVencimento, setDataVencimento] = useState(celula.dataVencimento || `${mesChave}-15`);
  const [dataRecebimento, setDataRecebimento] = useState(celula.dataRecebimento || celula.dataVencimento || `${mesChave}-15`);
  const [valorParcela, setValorParcela] = useState(String(celula.valorParcela || 0));
  const [comissaoGerada, setComissaoGerada] = useState(String(celula.comissaoGerada || 0));
  const [status, setStatus] = useState<StatusParcela>(celula.status);
  const [recebida, setRecebida] = useState(celula.recebida || false);

  // Reinicia os campos ao abrir o dialog
  React.useEffect(() => {
    if (open) {
      setDataVencimento(celula.dataVencimento || `${mesChave}-15`);
      setDataRecebimento(celula.dataRecebimento || celula.dataVencimento || `${mesChave}-15`);
      setValorParcela(String(celula.valorParcela || 0));
      setComissaoGerada(String(celula.comissaoGerada || 0));
      setStatus(celula.status);
      setRecebida(celula.recebida || false);
    }
  }, [open, celula, mesChave]);

  const handleSalvar = () => {
    onSave({
      dataVencimento,
      dataRecebimento,
      valorParcela: parseFloat(valorParcela) || 0,
      comissaoGerada: parseFloat(comissaoGerada) || 0,
      status,
      recebida
    });
  };

  const mesFormatado = mesChave ? new Date(`${mesChave}-15T00:00:00`).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }) : mesChave;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="xs"
      slotProps={{ paper: { sx: { borderRadius: 4, bgcolor: theme.palette.mode === 'dark' ? '#1e293b' : '#ffffff', border: `1px solid ${theme.palette.mode === 'dark' ? '#334155' : '#e2e8f0'}`, p: 1 } } }}
    >
      <DialogTitle sx={{ fontFamily: 'Outfit, sans-serif', fontWeight: 700, display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: theme.palette.mode === 'dark' ? '#f8fafc' : '#0f172a' }}>
        <Box>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, fontFamily: 'Outfit, sans-serif' }}>Editar Parcela</Typography>
          <Typography variant="caption" sx={{ color: '#94a3b8', fontWeight: 500 }}>{nomeCliente} — {mesFormatado}</Typography>
        </Box>
        <IconButton onClick={onClose} size="small"><CloseIcon /></IconButton>
      </DialogTitle>
      <DialogContent>
        <Grid container spacing={2} sx={{ mt: 0.5 }}>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField fullWidth label="Data de Vencimento" type="date" value={dataVencimento} onChange={(e) => setDataVencimento(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField
              fullWidth
              label="Data de Recebimento"
              type="date"
              value={dataRecebimento}
              onChange={(e) => setDataRecebimento(e.target.value)}
              slotProps={{ inputLabel: { shrink: true } }}
              helperText="Pode ser diferente do vencimento"
              sx={{ '& .MuiOutlinedInput-root': { borderColor: '#10b981' } }}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField
              fullWidth
              label="Valor da Parcela (R$)"
              type="number"
              value={valorParcela}
              onChange={(e) => setValorParcela(e.target.value)}
              slotProps={{ input: { startAdornment: <InputAdornment position="start">R$</InputAdornment> } }}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField
              fullWidth
              label="Comissão Gerada (R$)"
              type="number"
              value={comissaoGerada}
              onChange={(e) => setComissaoGerada(e.target.value)}
              slotProps={{ input: { startAdornment: <InputAdornment position="start">R$</InputAdornment> } }}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <FormControl fullWidth>
              <InputLabel>Status</InputLabel>
              <Select value={status} label="Status" onChange={(e) => setStatus(e.target.value as StatusParcela)}>
                <MenuItem value="A vencer">A vencer</MenuItem>
                <MenuItem value="Vencida">Vencida</MenuItem>
                <MenuItem value="Paga">Paga</MenuItem>
                <MenuItem value="Cancelada">Cancelada</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <FormControl fullWidth>
              <InputLabel>Comissão</InputLabel>
              <Select
                value={recebida ? 'Recebida' : 'A receber'}
                label="Comissão"
                onChange={(e) => setRecebida(e.target.value === 'Recebida')}
              >
                <MenuItem value="A receber">A receber</MenuItem>
                <MenuItem value="Recebida">Recebida</MenuItem>
              </Select>
            </FormControl>
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2, pt: 1 }}>
        <Button onClick={onClose} sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 600, color: theme.palette.mode === 'dark' ? '#94a3b8' : '#64748b' }}>Cancelar</Button>
        <Button variant="contained" onClick={handleSalvar} sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 600, boxShadow: '0 4px 10px rgba(99, 102, 241, 0.2)' }}>Salvar Parcela</Button>
      </DialogActions>
    </Dialog>
  );
};

interface NovaVendaDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (venda: LancamentoVenda) => void;
  vendedores: Vendedor[];
  regras: RegraMaster[];
  ciclos: Record<string, [number, number]>;
  administradoras?: Administradora[];
}

const NovaVendaDialog: React.FC<NovaVendaDialogProps> = ({
  open,
  onClose,
  onSave,
  vendedores,
  regras,
  ciclos,
  administradoras = []
}) => {
  const theme = useTheme();
  const [cliente, setCliente] = useState('');
  const [pac, setPac] = useState('');
  const [vendedorId, setVendedorId] = useState('');
  const [administradoraIdInput, setAdministradoraIdInput] = useState('');
  const [administradoraNomeInput, setAdministradoraNomeInput] = useState('');
  const [segmento, setSegmento] = useState<SegmentoType | ''>('');
  const [tabela, setTabela] = useState('');
  const [qtdParcelas, setQtdParcelas] = useState<number | ''>('');
  const [percentualComissao, setPercentualComissao] = useState<number>(0);

  const [valorVendaExibicao, setValorVendaExibicao] = useState('');
  const [valorParcelaExibicao, setValorParcelaExibicao] = useState('');
  const [dataVendaInput, setDataVendaInput] = useState<string>('');
  const [dataVencimentoClienteInput, setDataVencimentoClienteInput] = useState<string>('');
  const [dataAssembleiaInput, setDataAssembleiaInput] = useState<string>('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [tabelasDisponiveis, setTabelasDisponiveis] = useState<string[]>([]);
  const [parcelasDisponiveis, setParcelasDisponiveis] = useState<number[]>([]);

  useEffect(() => {
    if (segmento) {
      const tabs = regras
        .filter((r) => r.segmento === segmento)
        .map((r) => r.tabela);
      setTabelasDisponiveis(Array.from(new Set(tabs)));
      setTabela('');
      setQtdParcelas('');
      setPercentualComissao(0);
    } else {
      setTabelasDisponiveis([]);
      setTabela('');
      setQtdParcelas('');
      setPercentualComissao(0);
    }
  }, [segmento, regras]);

  const [tipoTabelaInput, setTipoTabelaInput] = useState<TipoTabela>('Linear');
  const [percentualAdesaoInput, setPercentualAdesaoInput] = useState<number>(0);
  const [percentualMensalInput, setPercentualMensalInput] = useState<number>(0);
  const [percentuaisParcelasInput, setPercentuaisParcelasInput] = useState<number[] | undefined>(undefined);

  const opcoesAdministradoras = useMemo(() => {
    const lista = [...administradoras];
    if (administradoraIdInput && !lista.some(a => a.id === administradoraIdInput)) {
      lista.unshift({
        id: administradoraIdInput,
        nome: administradoraNomeInput || 'Âncora',
        ativo: true
      });
    }
    return lista;
  }, [administradoras, administradoraIdInput, administradoraNomeInput]);

  useEffect(() => {
    if (segmento && tabela) {
      const parsFiltrado = regras
        .filter((r) => r.segmento === segmento && r.tabela === tabela)
        .map((r) => r.qtdParcelas);
      setParcelasDisponiveis(Array.from(new Set(parsFiltrado)));
      setQtdParcelas('');
      setPercentualComissao(0);
      setTipoTabelaInput('Linear');
      setPercentualAdesaoInput(0);
      setPercentualMensalInput(0);
      setPercentuaisParcelasInput(undefined);
    } else {
      setParcelasDisponiveis([]);
      setQtdParcelas('');
      setPercentualComissao(0);
      setTipoTabelaInput('Linear');
      setPercentualAdesaoInput(0);
      setPercentualMensalInput(0);
      setPercentuaisParcelasInput(undefined);
    }
  }, [tabela, segmento, regras]);

  useEffect(() => {
    if (segmento && tabela && qtdParcelas !== '') {
      const regra = regras.find(
        (r) =>
          r.segmento === segmento &&
          r.tabela === tabela &&
          r.qtdParcelas === Number(qtdParcelas)
      );
      if (regra) {
        setPercentualComissao(regra.percentualComissao);
        setTipoTabelaInput(regra.tipoTabela || 'Linear');
        setPercentualAdesaoInput(regra.percentualAdesao || 0);
        setPercentualMensalInput(regra.percentualMensal || 0);
        setPercentuaisParcelasInput(regra.percentuaisParcelas);
        if (regra.administradoraId) {
          setAdministradoraIdInput(regra.administradoraId);
          setAdministradoraNomeInput(regra.administradoraNome || '');
        } else if (regra.administradoraNome) {
          setAdministradoraNomeInput(regra.administradoraNome);
          const adm = administradoras.find(a => a.nome.toLowerCase() === regra.administradoraNome?.toLowerCase());
          if (adm) setAdministradoraIdInput(adm.id);
        }
      } else {
        setPercentualComissao(0);
        setTipoTabelaInput('Linear');
        setPercentualAdesaoInput(0);
        setPercentualMensalInput(0);
        setPercentuaisParcelasInput(undefined);
      }
    } else {
      setPercentualComissao(0);
      setTipoTabelaInput('Linear');
      setPercentualAdesaoInput(0);
      setPercentualMensalInput(0);
      setPercentuaisParcelasInput(undefined);
    }
  }, [qtdParcelas, tabela, segmento, regras, administradoras]);

  const handleSalvarVenda = () => {
    const tempErrors: Record<string, string> = {};
    if (!cliente.trim()) tempErrors.cliente = 'Nome do cliente é obrigatório.';
    if (!pac.trim()) tempErrors.pac = 'PAC (Contrato) é obrigatório.';
    if (!vendedorId) tempErrors.vendedorId = 'Selecione o vendedor.';
    if (!segmento) tempErrors.segmento = 'Selecione o segmento.';
    if (!tabela) tempErrors.tabela = 'Selecione a tabela.';
    if (qtdParcelas === '') tempErrors.qtdParcelas = 'Selecione a quantidade de parcelas.';
    
    const valorVendaV = extrairValorCru(valorVendaExibicao);
    const valorParcelaV = extrairValorCru(valorParcelaExibicao);
    
    if (valorVendaV <= 0) {
      tempErrors.valorVendaInput = 'O valor do crédito é obrigatório e deve ser maior que zero.';
    }
    if (valorParcelaV <= 0) {
      tempErrors.valorParcelaInput = 'O valor da parcela é obrigatório e deve ser maior que zero.';
    }
    if (!dataVendaInput) {
      tempErrors.dataVendaInput = 'A data da venda é obrigatória.';
    }
    if (!dataVencimentoClienteInput) {
      tempErrors.dataVencimentoClienteInput = 'Vencimento do cliente é obrigatório.';
    }
    if (!dataAssembleiaInput) {
      tempErrors.dataAssembleiaInput = 'A data da 1ª Assembleia é obrigatória.';
    }

    setErrors(tempErrors);

    if (Object.keys(tempErrors).length > 0) return;

    const proj: ProjecaoMensalType = {};
    const parcelas = Number(qtdParcelas);
    const isAdesao = tipoTabelaInput === 'Adesão';
    const percentualMensalLinear = percentualComissao / parcelas;
    const parcelasRestantes = Math.max(1, parcelas - 1);
    const vendedorSelecionado = vendedores.find((v) => v.id === vendedorId);

    const projVaziaBase = gerarProjecaoVazia();
    Object.assign(proj, projVaziaBase);

    const mesInicioChave = dataVendaInput.substring(0, 7);

    for (let i = 0; i < parcelas; i++) {
      let dataVenc: string;
      if (i === 0) {
        dataVenc = dataVendaInput;
      } else {
        const dateAssembleiaBase = new Date(dataAssembleiaInput + 'T00:00:00');
        const dateVencClienteBase = new Date(dataVencimentoClienteInput + 'T00:00:00');
        const diaVenc = dateVencClienteBase.getDate();
        
        const dtAlvo = new Date(dateAssembleiaBase.getFullYear(), dateAssembleiaBase.getMonth() + i, 1);
        const ultimoDiaMes = new Date(dtAlvo.getFullYear(), dtAlvo.getMonth() + 1, 0).getDate();
        const diaFinal = Math.min(diaVenc, ultimoDiaMes);
        dtAlvo.setDate(diaFinal);
        
        const anoCalc = dtAlvo.getFullYear();
        const mesCalc = String(dtAlvo.getMonth() + 1).padStart(2, '0');
        const diaCalc = String(dtAlvo.getDate()).padStart(2, '0');
        dataVenc = `${anoCalc}-${mesCalc}-${diaCalc}`;
      }

      const mesChave = dataVenc.substring(0, 7);
      const status = i === 0 ? 'Paga' : getStatusInicial(dataVenc);
      const dataPrevisaoRecebimento = calcularDataPrevisaoRecebimento(dataVenc, ciclos);

      let comissaoCalculada = 0;
      if (percentuaisParcelasInput && percentuaisParcelasInput.length > 0) {
        const pParcela = percentuaisParcelasInput[i] !== undefined ? percentuaisParcelasInput[i] : 0;
        comissaoCalculada = Number((valorVendaV * (pParcela / 100)).toFixed(2));
      } else if (isAdesao) {
        if (i === 0) {
          // 1ª Parcela recebe comissão de Adesão
          comissaoCalculada = Number((valorVendaV * (percentualAdesaoInput / 100)).toFixed(2));
        } else {
          // Parcelas 2..N recebem percentual mensal fracionado
          comissaoCalculada = Number((valorVendaV * ((percentualMensalInput / parcelasRestantes) / 100)).toFixed(2));
        }
      } else {
        comissaoCalculada = Number((valorVendaV * (percentualMensalLinear / 100)).toFixed(2));
      }

      proj[mesChave] = {
        valorVenda: valorVendaV,
        valorParcela: valorParcelaV,
        comissaoGerada: comissaoCalculada,
        status,
        dataVencimento: dataVenc,
        dataPrevisaoRecebimento
      };
    }

    const { totalVendas, totalComissoes, projecaoAtualizada } = calcularTotaisLinha(
      proj,
      percentualComissao,
      parcelas,
      tipoTabelaInput,
      percentualAdesaoInput,
      percentualMensalInput,
      percentuaisParcelasInput
    );

    const novaVenda: LancamentoVenda = {
      id: `v_${Date.now()}`,
      cliente: cliente.trim(),
      administradoraId: administradoraIdInput || undefined,
      administradoraNome: administradoraNomeInput || undefined,
      pac: pac.trim(),
      vendedorId,
      vendedorNome: vendedorSelecionado?.nome || '',
      dataVenda: dataVendaInput,
      dataVencimentoCliente: dataVencimentoClienteInput,
      dataAssembleia: dataAssembleiaInput,
      mesInicio: mesInicioChave,
      segmento: segmento as SegmentoType,
      tabela,
      qtdParcelas: parcelas,
      tipoTabela: tipoTabelaInput,
      percentualComissao,
      percentualAdesao: isAdesao ? percentualAdesaoInput : undefined,
      percentualMensal: isAdesao ? percentualMensalInput : undefined,
      percentuaisParcelas: percentuaisParcelasInput,
      valorVenda: valorVendaV,
      valorParcela: valorParcelaV,
      projecaoMensal: projecaoAtualizada,
      totalVendas,
      totalComissoes,
      statusCliente: 'Ativo'
    };

    onSave(novaVenda);
    
    setCliente('');
    setPac('');
    setVendedorId('');
    setAdministradoraIdInput('');
    setAdministradoraNomeInput('');
    setSegmento('');
    setTabela('');
    setQtdParcelas('');
    setTipoTabelaInput('Linear');
    setPercentualComissao(0);
    setPercentualAdesaoInput(0);
    setPercentualMensalInput(0);
    setValorVendaExibicao('');
    setValorParcelaExibicao('');
    setDataVendaInput('');
    setDataVencimentoClienteInput('');
    setDataAssembleiaInput('');
    setErrors({});
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      slotProps={{
        paper: {
          sx: {
            borderRadius: 3,
            background: theme.palette.mode === 'dark' ? '#1e293b' : '#ffffff',
            backgroundImage: 'none',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3), 0 10px 10px -5px rgba(0, 0, 0, 0.2)'
          }
        }
      }}
    >
      <DialogTitle
        sx={{
          fontFamily: 'Outfit, sans-serif',
          fontWeight: 700,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          color: theme.palette.mode === 'dark' ? '#f8fafc' : '#0f172a'
        }}
      >
        Nova Venda
        <IconButton onClick={onClose} size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent>
        <Grid container spacing={3} sx={{ mt: 0.5 }}>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField
              fullWidth
              label="Cliente / Projeto"
              placeholder="Ex: Condomínio Jardim Real"
              value={cliente}
              onChange={(e) => setCliente(e.target.value)}
              error={!!errors.cliente}
              helperText={errors.cliente}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <FormControl fullWidth error={!!errors.vendedorId}>
              <InputLabel id="vend-venda-label">Vendedor Responsável</InputLabel>
              <Select
                labelId="vend-venda-label"
                value={vendedorId}
                label="Vendedor Responsável"
                onChange={(e) => setVendedorId(e.target.value)}
              >
                {vendedores.map((v) => (
                  <MenuItem key={v.id} value={v.id}>
                    {v.nome}
                  </MenuItem>
                ))}
              </Select>
              {errors.vendedorId && (
                <Typography variant="caption" color="error" sx={{ mt: 0.5 }}>
                  {errors.vendedorId}
                </Typography>
              )}
            </FormControl>
          </Grid>

          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField
              fullWidth
              label="Valor do Crédito"
              type="text"
              placeholder="Ex: R$ 1.200.000,00"
              value={valorVendaExibicao}
              onChange={(e) => {
                const formatado = formatarMascaraDinheiro(e.target.value);
                setValorVendaExibicao(formatado);
              }}
              error={!!errors.valorVendaInput}
              helperText={errors.valorVendaInput}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField
              fullWidth
              label="Valor da Parcela"
              type="text"
              placeholder="Ex: R$ 10.000,00"
              value={valorParcelaExibicao}
              onChange={(e) => {
                const formatado = formatarMascaraDinheiro(e.target.value);
                setValorParcelaExibicao(formatado);
              }}
              error={!!errors.valorParcelaInput}
              helperText={errors.valorParcelaInput}
            />
          </Grid>

          <Grid size={{ xs: 12, sm: 3 }}>
            <TextField
              fullWidth
              label="Data da Venda"
              type="date"
              value={dataVendaInput}
              onChange={(e) => setDataVendaInput(e.target.value)}
              slotProps={{ inputLabel: { shrink: true } }}
              error={!!errors.dataVendaInput}
              helperText={errors.dataVendaInput}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 3 }}>
            <TextField
              fullWidth
              label="Vencimento do Cliente"
              type="date"
              value={dataVencimentoClienteInput}
              onChange={(e) => setDataVencimentoClienteInput(e.target.value)}
              slotProps={{ inputLabel: { shrink: true } }}
              error={!!errors.dataVencimentoClienteInput}
              helperText={errors.dataVencimentoClienteInput || 'Data da 2ª parcela'}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 3 }}>
            <TextField
              fullWidth
              label="Data da 1ª Assembleia"
              type="date"
              value={dataAssembleiaInput}
              onChange={(e) => setDataAssembleiaInput(e.target.value)}
              slotProps={{ inputLabel: { shrink: true } }}
              error={!!errors.dataAssembleiaInput}
              helperText={errors.dataAssembleiaInput}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 4 }}>
            <FormControl fullWidth error={!!errors.segmento}>
              <InputLabel id="seg-venda-label">Segmento</InputLabel>
              <Select
                labelId="seg-venda-label"
                value={segmento}
                label="Segmento"
                onChange={(e) => setSegmento(e.target.value as SegmentoType)}
              >
                <MenuItem value="Imóveis">Imóveis</MenuItem>
                <MenuItem value="Autos Leves">Autos Leves</MenuItem>
                <MenuItem value="Pesados">Pesados</MenuItem>
              </Select>
              {errors.segmento && (
                <Typography variant="caption" color="error" sx={{ mt: 0.5 }}>
                  {errors.segmento}
                </Typography>
              )}
            </FormControl>
          </Grid>

          <Grid size={{ xs: 12, sm: 4 }}>
            <FormControl fullWidth>
              <InputLabel id="adm-venda-label">Administradora</InputLabel>
              <Select
                labelId="adm-venda-label"
                value={administradoraIdInput}
                label="Administradora"
                onChange={(e) => {
                  const id = e.target.value;
                  setAdministradoraIdInput(id);
                  const adm = administradoras.find(a => a.id === id);
                  setAdministradoraNomeInput(adm?.nome || '');
                }}
              >
                <MenuItem value=""><em>Nenhuma / Não especificada</em></MenuItem>
                {opcoesAdministradoras.filter(a => a.ativo || a.id === administradoraIdInput).map((a) => (
                  <MenuItem key={a.id} value={a.id}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8 }}>
                      <AccountBalanceIcon sx={{ fontSize: 15, color: '#818cf8' }} />
                      {a.nome}
                    </Box>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          <Grid size={{ xs: 12, sm: 4 }}>
            <TextField
              fullWidth
              label="PAC (Contrato)"
              placeholder="Ex: PAC-987654"
              value={pac}
              onChange={(e) => setPac(e.target.value)}
              error={!!errors.pac}
              helperText={errors.pac}
            />
          </Grid>

          <Grid size={{ xs: 12, sm: 6 }}>
            <FormControl fullWidth error={!!errors.tabela} disabled={!segmento}>
              <InputLabel id="tab-venda-label">Tabela</InputLabel>
              <Select
                labelId="tab-venda-label"
                value={tabela}
                label="Tabela"
                onChange={(e) => setTabela(e.target.value)}
              >
                {tabelasDisponiveis.map((tab) => (
                  <MenuItem key={tab} value={tab}>
                    {tab}
                  </MenuItem>
                ))}
              </Select>
              {errors.tabela && (
                <Typography variant="caption" color="error" sx={{ mt: 0.5 }}>
                  {errors.tabela}
                </Typography>
              )}
            </FormControl>
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <FormControl fullWidth error={!!errors.qtdParcelas} disabled={!tabela}>
              <InputLabel id="parc-venda-label">Prazo (Parcelas)</InputLabel>
              <Select
                labelId="parc-venda-label"
                value={qtdParcelas}
                label="Prazo (Parcelas)"
                onChange={(e) => setQtdParcelas(Number(e.target.value))}
              >
                {parcelasDisponiveis.map((parc) => (
                  <MenuItem key={parc} value={parc}>
                    {parc}x
                  </MenuItem>
                ))}
              </Select>
              {errors.qtdParcelas && (
                <Typography variant="caption" color="error" sx={{ mt: 0.5 }}>
                  {errors.qtdParcelas}
                </Typography>
              )}
            </FormControl>
          </Grid>

          {/* Informações da comissão buscada */}
          {segmento && tabela && qtdParcelas !== '' && (
            <Grid size={{ xs: 12 }}>
              <Alert
                severity={percentualComissao > 0 ? 'success' : 'warning'}
                icon={<PercentIcon />}
                sx={{ borderRadius: 3 }}
              >
                {percentualComissao > 0 ? (
                  tipoTabelaInput === 'Adesão' ? (
                    <span>
                      Modalidade <strong>Adesão</strong>: <strong>{Number(percentualAdesaoInput).toFixed(2).replace('.', ',')}%</strong> na 1ª Parcela (Adesão) + <strong>{Number(percentualMensalInput).toFixed(2).replace('.', ',')}%</strong> fracionado em {Math.max(1, Number(qtdParcelas) - 1)}x. (Total: {percentualComissao.toFixed(2).replace('.', ',')}%)
                    </span>
                  ) : (
                    <span>
                      Modalidade <strong>Linear</strong>: Comissão automática de <strong>{percentualComissao.toFixed(2).replace('.', ',')}%</strong> distribuída em {qtdParcelas} parcelas.
                    </span>
                  )
                ) : (
                  <span>Não foi localizada nenhuma comissão para essa combinação no BD Master.</span>
                )}
              </Alert>
            </Grid>
          )}
        </Grid>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2, pt: 1 }}>
        <Button
          onClick={onClose}
          sx={{
            borderRadius: 2,
            textTransform: 'none',
            fontWeight: 600,
            color: theme.palette.mode === 'dark' ? '#94a3b8' : '#64748b'
          }}
        >
          Cancelar
        </Button>
        <Button
          variant="contained"
          onClick={handleSalvarVenda}
          sx={{
            borderRadius: 2,
            textTransform: 'none',
            fontWeight: 600,
            boxShadow: '0 4px 10px rgba(99, 102, 241, 0.2)'
          }}
        >
          Lançar Venda
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export interface EditarVendaDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (venda: LancamentoVenda) => void;
  venda: LancamentoVenda | null;
  vendedores: Vendedor[];
  regras: RegraMaster[];
  ciclos: Record<string, [number, number]>;
  administradoras?: Administradora[];
}

export const EditarVendaDialog: React.FC<EditarVendaDialogProps> = ({
  open,
  onClose,
  onSave,
  venda,
  vendedores,
  regras,
  ciclos,
  administradoras = []
}) => {
  const theme = useTheme();
  const [cliente, setCliente] = useState('');
  const [pac, setPac] = useState('');
  const [vendedorId, setVendedorId] = useState('');
  const [administradoraIdInput, setAdministradoraIdInput] = useState('');
  const [administradoraNomeInput, setAdministradoraNomeInput] = useState('');
  const [segmento, setSegmento] = useState<SegmentoType | ''>('');
  const [tabela, setTabela] = useState('');
  const [qtdParcelas, setQtdParcelas] = useState<number | ''>('');
  const [percentualComissao, setPercentualComissao] = useState<number>(0);

  const [valorVendaExibicao, setValorVendaExibicao] = useState('');
  const [valorParcelaExibicao, setValorParcelaExibicao] = useState('');
  const [dataVendaInput, setDataVendaInput] = useState<string>('');
  const [dataVencimentoClienteInput, setDataVencimentoClienteInput] = useState<string>('');
  const [dataAssembleiaInput, setDataAssembleiaInput] = useState<string>('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [tabelasDisponiveis, setTabelasDisponiveis] = useState<string[]>([]);
  const [parcelasDisponiveis, setParcelasDisponiveis] = useState<number[]>([]);
  const [contemplado, setContemplado] = useState(false);
  const [dataContemplacao, setDataContemplacao] = useState('');
  const [numeroRelatorio, setNumeroRelatorio] = useState('');
  const [dataRelatorio, setDataRelatorio] = useState('');
  const [tipoTabelaInput, setTipoTabelaInput] = useState<TipoTabela>('Linear');
  const [percentualAdesaoInput, setPercentualAdesaoInput] = useState<number>(0);
  const [percentualMensalInput, setPercentualMensalInput] = useState<number>(0);
  const [percentuaisParcelasInput, setPercentuaisParcelasInput] = useState<number[] | undefined>(undefined);

  const opcoesAdministradoras = useMemo(() => {
    const lista = [...administradoras];
    if (administradoraIdInput && !lista.some(a => a.id === administradoraIdInput)) {
      lista.unshift({
        id: administradoraIdInput,
        nome: administradoraNomeInput || 'Âncora',
        ativo: true
      });
    }
    return lista;
  }, [administradoras, administradoraIdInput, administradoraNomeInput]);

  useEffect(() => {
    if (venda) {
      setCliente(venda.cliente);
      setPac(venda.pac || '');
      setVendedorId(venda.vendedorId || '');
      
      const admEncontrada = administradoras.find(a => 
        (venda.administradoraId && a.id === venda.administradoraId) ||
        (venda.administradoraNome && a.nome.toLowerCase() === venda.administradoraNome.toLowerCase())
      );
      setAdministradoraIdInput(venda.administradoraId || admEncontrada?.id || '');
      setAdministradoraNomeInput(venda.administradoraNome || admEncontrada?.nome || '');

      setSegmento(venda.segmento);
      setTabela(venda.tabela);
      setQtdParcelas(venda.qtdParcelas);
      setTipoTabelaInput(venda.tipoTabela || 'Linear');
      setPercentualComissao(venda.percentualComissao);
      setPercentualAdesaoInput(venda.percentualAdesao || 0);
      setPercentualMensalInput(venda.percentualMensal || 0);
      setPercentuaisParcelasInput(venda.percentuaisParcelas);
      setValorVendaExibicao(formatarMoedaInput(venda.valorVenda));
      setValorParcelaExibicao(formatarMoedaInput(venda.valorParcela));
      setDataVendaInput(venda.dataVenda || '');
      setDataVencimentoClienteInput(venda.dataVencimentoCliente || '');
      setDataAssembleiaInput(venda.dataAssembleia || '');
      setContemplado(venda.contemplado || false);
      setDataContemplacao(venda.dataContemplacao || '');
      setNumeroRelatorio(venda.numeroRelatorio || '');
      setDataRelatorio(venda.dataRelatorio || '');
      setErrors({});

      const tabs = regras
        .filter((r) => r.segmento === venda.segmento)
        .map((r) => r.tabela);
      setTabelasDisponiveis(Array.from(new Set(tabs)));

      const pars = regras
        .filter((r) => r.segmento === venda.segmento && r.tabela === venda.tabela)
        .map((r) => r.qtdParcelas);
      setParcelasDisponiveis(Array.from(new Set(pars)));
    }
  }, [venda, regras, administradoras]);

  const handleSegmentoChange = (seg: SegmentoType) => {
    setSegmento(seg);
    const tabs = regras
      .filter((r) => r.segmento === seg)
      .map((r) => r.tabela);
    setTabelasDisponiveis(Array.from(new Set(tabs)));
    setTabela('');
    setQtdParcelas('');
    setPercentualComissao(0);
    setTipoTabelaInput('Linear');
    setPercentualAdesaoInput(0);
    setPercentualMensalInput(0);
    setPercentuaisParcelasInput(undefined);
    setParcelasDisponiveis([]);
  };

  const handleTabelaChange = (tab: string) => {
    setTabela(tab);
    const pars = regras
      .filter((r) => r.segmento === segmento && r.tabela === tab)
      .map((r) => r.qtdParcelas);
    setParcelasDisponiveis(Array.from(new Set(pars)));
    setQtdParcelas('');
    setPercentualComissao(0);
    setTipoTabelaInput('Linear');
    setPercentualAdesaoInput(0);
    setPercentualMensalInput(0);
    setPercentuaisParcelasInput(undefined);
  };

  const handleQtdParcelasChange = (pars: number) => {
    setQtdParcelas(pars);
    const regra = regras.find(
      (r) =>
        r.segmento === segmento &&
        r.tabela === tabela &&
        r.qtdParcelas === pars
    );
    if (regra) {
      setPercentualComissao(regra.percentualComissao);
      setTipoTabelaInput(regra.tipoTabela || 'Linear');
      setPercentualAdesaoInput(regra.percentualAdesao || 0);
      setPercentualMensalInput(regra.percentualMensal || 0);
      setPercentuaisParcelasInput(regra.percentuaisParcelas);
      if (regra.administradoraId) {
        setAdministradoraIdInput(regra.administradoraId);
        setAdministradoraNomeInput(regra.administradoraNome || '');
      } else if (regra.administradoraNome) {
        setAdministradoraNomeInput(regra.administradoraNome);
        const adm = administradoras.find(a => a.nome.toLowerCase() === regra.administradoraNome?.toLowerCase());
        if (adm) setAdministradoraIdInput(adm.id);
      }
    } else {
      setPercentualComissao(0);
      setTipoTabelaInput('Linear');
      setPercentualAdesaoInput(0);
      setPercentualMensalInput(0);
      setPercentuaisParcelasInput(undefined);
    }
  };

  const handleSalvarEdicao = () => {
    if (!venda) return;

    const tempErrors: Record<string, string> = {};
    if (!cliente.trim()) tempErrors.cliente = 'Nome do cliente é obrigatório.';
    if (!pac.trim()) tempErrors.pac = 'PAC (Contrato) é obrigatório.';
    if (!vendedorId) tempErrors.vendedorId = 'Selecione o vendedor.';
    if (!segmento) tempErrors.segmento = 'Selecione o segmento.';
    if (!tabela) tempErrors.tabela = 'Selecione a tabela.';
    if (qtdParcelas === '') tempErrors.qtdParcelas = 'Selecione a quantidade de parcelas.';
    
    const valorVendaV = extrairValorCru(valorVendaExibicao);
    const valorParcelaV = extrairValorCru(valorParcelaExibicao);
    
    if (valorVendaV <= 0) {
      tempErrors.valorVendaInput = 'O valor do crédito é obrigatório e deve ser maior que zero.';
    }
    if (valorParcelaV <= 0) {
      tempErrors.valorParcelaInput = 'O valor da parcela é obrigatório e deve ser maior que zero.';
    }
    if (!dataVendaInput) {
      tempErrors.dataVendaInput = 'A data da venda é obrigatória.';
    }
    if (!dataVencimentoClienteInput) {
      tempErrors.dataVencimentoClienteInput = 'Vencimento do cliente é obrigatório.';
    }
    if (!dataAssembleiaInput) {
      tempErrors.dataAssembleiaInput = 'A data da 1ª Assembleia é obrigatória.';
    }

    setErrors(tempErrors);

    if (Object.keys(tempErrors).length > 0) return;

    const proj: ProjecaoMensalType = {};
    const parcelas = Number(qtdParcelas);
    const isAdesao = tipoTabelaInput === 'Adesão';
    const percentualMensalLinear = percentualComissao / parcelas;
    const parcelasRestantes = Math.max(1, parcelas - 1);
    const vendedorSelecionado = vendedores.find((v) => v.id === vendedorId);

    const projVaziaBase = gerarProjecaoVazia();
    Object.assign(proj, projVaziaBase);

    const mesInicioChave = dataVendaInput.substring(0, 7);

    for (let i = 0; i < parcelas; i++) {
      let dataVenc: string;
      if (i === 0) {
        dataVenc = dataVendaInput;
      } else {
        const dateAssembleiaBase = new Date(dataAssembleiaInput + 'T00:00:00');
        const dateVencClienteBase = new Date(dataVencimentoClienteInput + 'T00:00:00');
        const diaVenc = dateVencClienteBase.getDate();
        
        const dtAlvo = new Date(dateAssembleiaBase.getFullYear(), dateAssembleiaBase.getMonth() + i, 1);
        const ultimoDiaMes = new Date(dtAlvo.getFullYear(), dtAlvo.getMonth() + 1, 0).getDate();
        const diaFinal = Math.min(diaVenc, ultimoDiaMes);
        dtAlvo.setDate(diaFinal);
        
        const anoCalc = dtAlvo.getFullYear();
        const mesCalc = String(dtAlvo.getMonth() + 1).padStart(2, '0');
        const diaCalc = String(dtAlvo.getDate()).padStart(2, '0');
        dataVenc = `${anoCalc}-${mesCalc}-${diaCalc}`;
      }

      const mesChave = dataVenc.substring(0, 7);
      const statusAnterior = venda.projecaoMensal[mesChave]?.status;
      const status = i === 0 ? (statusAnterior || 'Paga') : (statusAnterior || getStatusInicial(dataVenc));
      const dataPrevisaoRecebimento = calcularDataPrevisaoRecebimento(dataVenc, ciclos);

      let comissaoCalculada = 0;
      if (isAdesao) {
        if (i === 0) {
          comissaoCalculada = Number((valorVendaV * (percentualAdesaoInput / 100)).toFixed(2));
        } else {
          comissaoCalculada = Number((valorVendaV * ((percentualMensalInput / parcelasRestantes) / 100)).toFixed(2));
        }
      } else {
        comissaoCalculada = Number((valorVendaV * (percentualMensalLinear / 100)).toFixed(2));
      }

      proj[mesChave] = {
        valorVenda: valorVendaV,
        valorParcela: valorParcelaV,
        comissaoGerada: comissaoCalculada,
        status,
        dataVencimento: dataVenc,
        dataPrevisaoRecebimento,
        dataRecebimento: venda.projecaoMensal[mesChave]?.dataRecebimento || dataVenc
      };
    }

    // Lançamento de comissão de contemplação no mês da contemplação
    let valorComissaoContempl = 0;
    if (contemplado && dataContemplacao) {
      const mesContemplacao = dataContemplacao.substring(0, 7);
      const regraVigente = regras.find(r => r.segmento === segmento && r.tabela === tabela && r.qtdParcelas === Number(qtdParcelas));
      const pctContempl = regraVigente?.percentualComissaoContemplacao || 0;
      valorComissaoContempl = pctContempl > 0 ? Number((valorVendaV * (pctContempl / 100)).toFixed(2)) : 0;
      if (proj[mesContemplacao]) {
        proj[mesContemplacao] = { ...proj[mesContemplacao], comissaoGerada: (proj[mesContemplacao].comissaoGerada || 0) + valorComissaoContempl };
      }
    }

    const { totalVendas, totalComissoes, projecaoAtualizada } = calcularTotaisLinha(
      proj,
      percentualComissao,
      parcelas,
      tipoTabelaInput,
      percentualAdesaoInput,
      percentualMensalInput,
      percentuaisParcelasInput
    );

    const vendaAtualizada: LancamentoVenda = {
      ...venda,
      cliente: cliente.trim(),
      administradoraId: administradoraIdInput || undefined,
      administradoraNome: administradoraNomeInput || undefined,
      pac: pac.trim(),
      vendedorId,
      vendedorNome: vendedorSelecionado?.nome || '',
      dataVenda: dataVendaInput,
      dataVencimentoCliente: dataVencimentoClienteInput,
      dataAssembleia: dataAssembleiaInput,
      mesInicio: mesInicioChave,
      segmento: segmento as SegmentoType,
      tabela,
      qtdParcelas: parcelas,
      tipoTabela: tipoTabelaInput,
      percentualComissao,
      percentualAdesao: isAdesao ? percentualAdesaoInput : undefined,
      percentualMensal: isAdesao ? percentualMensalInput : undefined,
      percentuaisParcelas: percentuaisParcelasInput,
      valorVenda: valorVendaV,
      valorParcela: valorParcelaV,
      projecaoMensal: projecaoAtualizada,
      totalVendas,
      totalComissoes,
      contemplado,
      dataContemplacao: contemplado ? dataContemplacao : undefined,
      comissaoContemplacao: contemplado && dataContemplacao ? (() => {
        const regraV = regras.find(r => r.segmento === segmento && r.tabela === tabela && r.qtdParcelas === parcelas);
        const pct = regraV?.percentualComissaoContemplacao || 0;
        return pct > 0 ? Number((valorVendaV * (pct / 100)).toFixed(2)) : 0;
      })() : undefined,
      numeroRelatorio: numeroRelatorio.trim() || undefined,
      dataRelatorio: dataRelatorio || undefined,
    };

    onSave(vendaAtualizada);
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      slotProps={{
        paper: {
          sx: {
            borderRadius: 3,
            background: theme.palette.mode === 'dark' ? '#1e293b' : '#ffffff',
            backgroundImage: 'none',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3), 0 10px 10px -5px rgba(0, 0, 0, 0.2)'
          }
        }
      }}
    >
      <DialogTitle
        sx={{
          fontFamily: 'Outfit, sans-serif',
          fontWeight: 700,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          color: theme.palette.mode === 'dark' ? '#f8fafc' : '#0f172a'
        }}
      >
        Editar Lançamento
        <IconButton onClick={onClose} size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent>
        <Grid container spacing={3} sx={{ mt: 0.5 }}>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField
              fullWidth
              label="Cliente / Projeto"
              placeholder="Ex: Condomínio Jardim Real"
              value={cliente}
              onChange={(e) => setCliente(e.target.value)}
              error={!!errors.cliente}
              helperText={errors.cliente}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <FormControl fullWidth error={!!errors.vendedorId}>
              <InputLabel id="edit-vend-venda-label">Vendedor Responsável</InputLabel>
              <Select
                labelId="edit-vend-venda-label"
                value={vendedorId}
                label="Vendedor Responsável"
                onChange={(e) => setVendedorId(e.target.value)}
              >
                {vendedores.map((v) => (
                  <MenuItem key={v.id} value={v.id}>
                    {v.nome}
                  </MenuItem>
                ))}
              </Select>
              {errors.vendedorId && (
                <Typography variant="caption" color="error" sx={{ mt: 0.5 }}>
                  {errors.vendedorId}
                </Typography>
              )}
            </FormControl>
          </Grid>

          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField
              fullWidth
              label="Valor do Crédito"
              type="text"
              placeholder="Ex: R$ 1.200.000,00"
              value={valorVendaExibicao}
              onChange={(e) => {
                const formatado = formatarMascaraDinheiro(e.target.value);
                setValorVendaExibicao(formatado);
              }}
              error={!!errors.valorVendaInput}
              helperText={errors.valorVendaInput}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField
              fullWidth
              label="Valor da Parcela"
              type="text"
              placeholder="Ex: R$ 10.000,00"
              value={valorParcelaExibicao}
              onChange={(e) => {
                const formatado = formatarMascaraDinheiro(e.target.value);
                setValorParcelaExibicao(formatado);
              }}
              error={!!errors.valorParcelaInput}
              helperText={errors.valorParcelaInput}
            />
          </Grid>

          <Grid size={{ xs: 12, sm: 3 }}>
            <TextField
              fullWidth
              label="Data da Venda"
              type="date"
              value={dataVendaInput}
              onChange={(e) => setDataVendaInput(e.target.value)}
              slotProps={{ inputLabel: { shrink: true } }}
              error={!!errors.dataVendaInput}
              helperText={errors.dataVendaInput}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 3 }}>
            <TextField
              fullWidth
              label="Vencimento do Cliente"
              type="date"
              value={dataVencimentoClienteInput}
              onChange={(e) => setDataVencimentoClienteInput(e.target.value)}
              slotProps={{ inputLabel: { shrink: true } }}
              error={!!errors.dataVencimentoClienteInput}
              helperText={errors.dataVencimentoClienteInput || 'Data da 2ª parcela'}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 3 }}>
            <TextField
              fullWidth
              label="Data da 1ª Assembleia"
              type="date"
              value={dataAssembleiaInput}
              onChange={(e) => setDataAssembleiaInput(e.target.value)}
              slotProps={{ inputLabel: { shrink: true } }}
              error={!!errors.dataAssembleiaInput}
              helperText={errors.dataAssembleiaInput}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 4 }}>
            <FormControl fullWidth error={!!errors.segmento}>
              <InputLabel id="edit-seg-venda-label">Segmento</InputLabel>
              <Select
                labelId="edit-seg-venda-label"
                value={segmento}
                label="Segmento"
                onChange={(e) => handleSegmentoChange(e.target.value as SegmentoType)}
              >
                <MenuItem value="Imóveis">Imóveis</MenuItem>
                <MenuItem value="Autos Leves">Autos Leves</MenuItem>
                <MenuItem value="Pesados">Pesados</MenuItem>
              </Select>
              {errors.segmento && (
                <Typography variant="caption" color="error" sx={{ mt: 0.5 }}>
                  {errors.segmento}
                </Typography>
              )}
            </FormControl>
          </Grid>

          <Grid size={{ xs: 12, sm: 4 }}>
            <FormControl fullWidth>
              <InputLabel id="edit-adm-venda-label">Administradora</InputLabel>
              <Select
                labelId="edit-adm-venda-label"
                value={administradoraIdInput}
                label="Administradora"
                onChange={(e) => {
                  const id = e.target.value;
                  setAdministradoraIdInput(id);
                  const adm = administradoras.find(a => a.id === id);
                  setAdministradoraNomeInput(adm?.nome || '');
                }}
              >
                <MenuItem value=""><em>Nenhuma / Não especificada</em></MenuItem>
                {opcoesAdministradoras.filter(a => a.ativo || a.id === administradoraIdInput).map((a) => (
                  <MenuItem key={a.id} value={a.id}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8 }}>
                      <AccountBalanceIcon sx={{ fontSize: 15, color: '#818cf8' }} />
                      {a.nome}
                    </Box>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          <Grid size={{ xs: 12, sm: 4 }}>
            <TextField
              fullWidth
              label="PAC (Contrato)"
              placeholder="Número do Contrato"
              value={pac}
              onChange={(e) => setPac(e.target.value)}
              error={!!errors.pac}
              helperText={errors.pac}
            />
          </Grid>

          <Grid size={{ xs: 12, sm: 6 }}>
            <FormControl fullWidth error={!!errors.tabela}>
              <InputLabel id="edit-tab-venda-label">Tabela</InputLabel>
              <Select
                labelId="edit-tab-venda-label"
                value={tabela}
                label="Tabela"
                onChange={(e) => handleTabelaChange(e.target.value as string)}
                disabled={!segmento}
              >
                {tabelasDisponiveis.map((t) => (
                  <MenuItem key={t} value={t}>
                    {t}
                  </MenuItem>
                ))}
              </Select>
              {errors.tabela && (
                <Typography variant="caption" color="error" sx={{ mt: 0.5 }}>
                  {errors.tabela}
                </Typography>
              )}
            </FormControl>
          </Grid>

          <Grid size={{ xs: 12, sm: 6 }}>
            <FormControl fullWidth error={!!errors.qtdParcelas}>
              <InputLabel id="edit-parc-venda-label">Quantidade de Parcelas</InputLabel>
              <Select
                labelId="edit-parc-venda-label"
                value={qtdParcelas}
                label="Quantidade de Parcelas"
                onChange={(e) => handleQtdParcelasChange(Number(e.target.value))}
                disabled={!tabela}
              >
                {parcelasDisponiveis.map((p) => (
                  <MenuItem key={p} value={p}>
                    {p} parcelas
                  </MenuItem>
                ))}
              </Select>
              {errors.qtdParcelas && (
                <Typography variant="caption" color="error" sx={{ mt: 0.5 }}>
                  {errors.qtdParcelas}
                </Typography>
              )}
            </FormControl>
          </Grid>
          <Grid size={{ xs: 12, sm: 4 }}>
            <TextField
              fullWidth
              label="PAC (Contrato)"
              placeholder="Número do Contrato"
              value={pac}
              onChange={(e) => setPac(e.target.value)}
              error={!!errors.pac}
              helperText={errors.pac}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <FormControlLabel
              control={
                <Switch
                  checked={contemplado}
                  onChange={(e) => {
                    setContemplado(e.target.checked);
                    if (!e.target.checked) setDataContemplacao('');
                  }}
                  color="warning"
                />
              }
              label={
                <Typography variant="body2" sx={{ fontWeight: 600, color: contemplado ? '#f59e0b' : 'inherit' }}>
                  🏆 Cliente Contemplado
                </Typography>
              }
            />
          </Grid>
          {contemplado && (
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                label="Data da Contemplação"
                type="date"
                value={dataContemplacao}
                onChange={(e) => setDataContemplacao(e.target.value)}
                slotProps={{ inputLabel: { shrink: true } }}
                helperText="Lança a comissão de contemplação no mês escolhido"
                sx={{ '& .MuiOutlinedInput-root': { borderColor: '#f59e0b' } }}
              />
            </Grid>
          )}
          {/* ── Campos ADM ── */}
          <Grid size={{ xs: 12 }}>
            <Box sx={{
              py: 1, px: 2, borderRadius: 1.5, mb: 0.5,
              bgcolor: theme.palette.mode === 'dark' ? 'rgba(99,102,241,0.08)' : 'rgba(99,102,241,0.05)',
              border: `1px dashed ${theme.palette.mode === 'dark' ? '#4f46e5' : '#a5b4fc'}`,
            }}>
              <Typography variant="caption" sx={{ fontWeight: 700, color: theme.palette.primary.main, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
                📋 Dados do Relatório ADM
              </Typography>
            </Box>
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField
              fullWidth
              label="Nº do Relatório ADM"
              placeholder="Ex: REL-2026-001"
              value={numeroRelatorio}
              onChange={(e) => setNumeroRelatorio(e.target.value)}
              helperText="Número do relatório gerado pela ADM"
              slotProps={{ input: { sx: { fontFamily: 'monospace', letterSpacing: '0.5px' } } }}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField
              fullWidth
              label="Data do Relatório ADM"
              type="date"
              value={dataRelatorio}
              onChange={(e) => setDataRelatorio(e.target.value)}
              slotProps={{ inputLabel: { shrink: true } }}
              helperText="Data de emissão do relatório"
            />
          </Grid>
          {/* ── Comissão Master ── */}
          <Grid size={{ xs: 12 }}>
            <Box
              sx={{
                py: 1.5,
                px: 2,
                borderRadius: 2,
                display: 'flex',
                alignItems: 'center',
                bgcolor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)',
                border: `1px solid ${theme.palette.mode === 'dark' ? '#374151' : '#e5e7eb'}`,
                color: 'text.secondary',
                fontSize: '0.85rem'
              }}
            >
              <PercentIcon sx={{ fontSize: 16, mr: 1, color: theme.palette.primary.main }} />
              <span>
                Comissão Master Calculada: <strong>{percentualComissao}%</strong> (
                {(percentualComissao / (Number(qtdParcelas) || 1)).toFixed(2)}% ao mês)
              </span>
            </Box>
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2, pt: 1 }}>
        <Button
          onClick={onClose}
          sx={{
            borderRadius: 2,
            textTransform: 'none',
            fontWeight: 600,
            color: theme.palette.mode === 'dark' ? '#94a3b8' : '#64748b'
          }}
        >
          Cancelar
        </Button>
        <Button
          variant="contained"
          onClick={handleSalvarEdicao}
          sx={{
            borderRadius: 2,
            textTransform: 'none',
            fontWeight: 600,
            boxShadow: '0 4px 10px rgba(99, 102, 241, 0.2)'
          }}
        >
          Salvar Alterações
        </Button>
      </DialogActions>
    </Dialog>
  );
};
