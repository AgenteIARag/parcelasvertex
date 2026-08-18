import { useState, useEffect, useMemo } from 'react';
import {
  ThemeProvider,
  createTheme,
  CssBaseline,
  Box,
  Container,
  Typography,
  Tabs,
  Tab,
  Button,
  IconButton,
  Tooltip,
  TextField,
  Divider
} from '@mui/material';
import StorageIcon from '@mui/icons-material/Storage';
import LightModeIcon from '@mui/icons-material/LightMode';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import AssessmentIcon from '@mui/icons-material/Assessment';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import FilterAltIcon from '@mui/icons-material/FilterAlt';
import DashboardIcon from '@mui/icons-material/Dashboard';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import GroupIcon from '@mui/icons-material/Group';
import BusinessIcon from '@mui/icons-material/Business';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import { EmpresasCadastro } from './components/EmpresasCadastro';
import { RegrasFilha } from './components/RegrasFilha';

import { type RegraMaster, type RegraFilha, type LancamentoVenda, type Vendedor, type Usuario, type StatusComissao, type Empresa } from './types';
import { INITIAL_REGRAS, INITIAL_VENDAS, INITIAL_VENDEDORES, calcularTotaisLinha } from './data/initialData';
import { KPISection } from './components/KPISection';
import { SimuladorVendas } from './components/SimuladorVendas';
import { RegrasMaster } from './components/RegrasMaster';
import { AnalyticsCharts } from './components/AnalyticsCharts';
import { Login } from './components/Login';
import { UsuariosCadastro } from './components/UsuariosCadastro';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ComissoesVendedores } from './components/ComissoesVendedores';
import { RelatorioRecebimentos } from './components/RelatorioRecebimentos';
import { RelatorioComissoes } from './components/RelatorioComissoes';
import { DashboardVendedores } from './components/DashboardVendedores';
import {
  obterVendedoresSupabase,
  obterRegrasSupabase,
  obterVendasSupabase,
  salvarVendedorSupabase,
  salvarRegraSupabase,
  excluirRegraSupabase,
  salvarVendaSupabase,
  excluirVendaSupabase,
  excluirVendasEspelhoSupabase,
  obterRegrasFilhaSupabase,
  obterRegrasFilhaLocal,
  inicializarUsuarioMaster,
  inicializarEmpresasPadrao
} from './utils/supabase';
import CloudQueueIcon from '@mui/icons-material/CloudQueue';
import CloudDoneIcon from '@mui/icons-material/CloudDone';
import CloudOffIcon from '@mui/icons-material/CloudOff';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import LogoutIcon from '@mui/icons-material/Logout';
import SettingsIcon from '@mui/icons-material/Settings';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
const migrarDadosStatusRecebida = async (
  vendasOriginais: LancamentoVenda[],
  salvarNoSupabase: boolean = false
): Promise<{ novasVendas: LancamentoVenda[]; alterou: boolean }> => {
  let alterouAlguma = false;
  const novasVendas = await Promise.all(
    vendasOriginais.map(async (venda) => {
      let vendaAlterada = false;
      const projecaoAtualizada = { ...venda.projecaoMensal };

      Object.keys(projecaoAtualizada).forEach((mesKey) => {
        const parcela = projecaoAtualizada[mesKey];
        if (parcela && (parcela.status as string) === 'Recebida') {
          projecaoAtualizada[mesKey] = {
            ...parcela,
            status: 'Paga',
            recebida: true
          };
          vendaAlterada = true;
          alterouAlguma = true;
        }
      });

      if (vendaAlterada) {
        const { totalVendas, totalComissoes } = calcularTotaisLinha(
          projecaoAtualizada,
          venda.percentualComissao,
          venda.qtdParcelas
        );
        const vendaNova = {
          ...venda,
          projecaoMensal: projecaoAtualizada,
          totalVendas,
          totalComissoes
        };
        if (salvarNoSupabase) {
          try {
            await salvarVendaSupabase(vendaNova);
            console.log(`[MIGRAÇÃO] Venda ${venda.id} migrada no Supabase.`);
          } catch (err) {
            console.error(`[MIGRAÇÃO] Erro ao migrar venda ${venda.id}:`, err);
          }
        }
        return vendaNova;
      }
      return venda;
    })
  );
  return { novasVendas, alterou: alterouAlguma };
};

function App() {
  // Estado do tema (Claro/Escuro) - Padrão escuro por ser premium e financeiro
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    const saved = localStorage.getItem('apex_dark_mode');
    return saved ? saved === 'true' : true;
  });

  const [sidebarContraida, setSidebarContraida] = useState<boolean>(() => {
    const saved = localStorage.getItem('apex_sidebar_collapsed');
    return saved ? saved === 'true' : false;
  });

  useEffect(() => {
    localStorage.setItem('apex_sidebar_collapsed', String(sidebarContraida));
  }, [sidebarContraida]);

  // Tema Customizado Material UI v6
  const theme = useMemo(() => createTheme({
    palette: {
      mode: darkMode ? 'dark' : 'light',
      primary: {
        main: '#6366f1', // Indigo elegante
        dark: '#4f46e5',
        light: '#818cf8',
      },
      secondary: {
        main: '#f59e0b', // Âmbar / Ouro comercial
      },
      success: {
        main: '#10b981', // Verde esmeralda para comissão
        dark: '#059669',
      },
      background: {
        default: darkMode ? '#0b0f19' : '#f8fafc', // Fundo azul profundo moderno ou cinza claro
        paper: darkMode ? '#111827' : '#ffffff',
      },
      text: {
        primary: darkMode ? '#f9fafb' : '#0f172a',
        secondary: darkMode ? '#9ca3af' : '#475569',
      },
    },
    typography: {
      fontFamily: 'Inter, sans-serif',
      h1: { fontFamily: 'Outfit, sans-serif' },
      h2: { fontFamily: 'Outfit, sans-serif' },
      h3: { fontFamily: 'Outfit, sans-serif' },
      h4: { fontFamily: 'Outfit, sans-serif' },
      h5: { fontFamily: 'Outfit, sans-serif' },
      h6: { fontFamily: 'Outfit, sans-serif' },
    },
    components: {
      MuiButton: {
        styleOverrides: {
          root: {
            textTransform: 'none',
            borderRadius: 8,
            fontWeight: 600,
          },
        },
      },
      MuiTableCell: {
        styleOverrides: {
          root: {
            borderColor: darkMode ? '#1f2937' : '#e5e7eb',
          },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: {
            backgroundImage: 'none',
          },
        },
      },
    },
  }), [darkMode]);

  // Estado do Usuário Autenticado (Sessão)
  const [usuarioLogado, setUsuarioLogado] = useState<Usuario | null>(() => {
    const saved = localStorage.getItem('apex_usuario_sessao');
    return saved ? JSON.parse(saved) : null;
  });

  useEffect(() => {
    if (usuarioLogado) {
      localStorage.setItem('apex_usuario_sessao', JSON.stringify(usuarioLogado));
    } else {
      localStorage.removeItem('apex_usuario_sessao');
    }
  }, [usuarioLogado]);

  // Estados do Banco de Dados Master e Simulações
  const [regras, setRegras] = useState<RegraMaster[]>(() => {
    const saved = localStorage.getItem('apex_regras_master');
    return saved ? JSON.parse(saved) : INITIAL_REGRAS;
  });

  const [vendas, setVendas] = useState<LancamentoVenda[]>(() => {
    const saved = localStorage.getItem('apex_lancamentos_vendas');
    const lista: LancamentoVenda[] = saved ? JSON.parse(saved) : INITIAL_VENDAS;
    return lista.map(v => ({ ...v, empresaId: v.empresaId || 'emp_vertex' }));
  });

  const [vendedores, setVendedores] = useState<Vendedor[]>(() => {
    const saved = localStorage.getItem('apex_vendedores');
    const lista: Vendedor[] = saved ? JSON.parse(saved) : INITIAL_VENDEDORES;
    return lista.map(v => ({ ...v, empresaId: v.empresaId || 'emp_vertex' }));
  });

  const [abaAtiva, setAbaAtiva] = useState<'dashboard' | 'dashboard_vendedores' | 'vendas' | 'comissoes' | 'relatorio' | 'relatorio_comissoes' | 'configuracoes'>('dashboard');
  const [subAbaAtiva, setSubAbaAtiva] = useState<'regras' | 'regras_filha' | 'vendedores' | 'acessos' | 'empresas'>('regras');

  // Multi-tenant: empresas
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [empresaFiltroMaster, setEmpresaFiltroMaster] = useState<string>(''); // '' = todas

  // Regras Filha (percentuais customizados das empresas filhas)
  const [regrasFilha, setRegrasFilha] = useState<RegraFilha[]>(() => {
    try { return obterRegrasFilhaLocal(); } catch { return []; }
  });

  const isSuperMaster = usuarioLogado?.role === 'super_master' || usuarioLogado?.email?.toLowerCase() === 'master@apex.com';

  // Empresa do usuário logado
  const empresaAtual = useMemo(() =>
    empresas.find(e => e.id === (usuarioLogado?.empresaId || 'emp_vertex')),
    [empresas, usuarioLogado]
  );

  // Verifica se a empresa do usuário é uma filha
  const empresaAtualEhFilha = useMemo(() => !!empresaAtual?.empresaMaeId, [empresaAtual]);

  // Regras efetivas para exibição no SimuladorVendas:
  // Se for uma empresa filha, usa as regrasMaster da mãe mas sobrescreve % com os da filha.
  const regrasEfetivasParaEmpresaAtual = useMemo((): RegraMaster[] => {
    const empId = usuarioLogado?.empresaId || 'emp_vertex';
    const empObj = empresas.find(e => e.id === empId);

    if (!empObj?.empresaMaeId) {
      // Empresa mãe ou standalone: vê apenas as regras da sua empresa (ou globais)
      return regras.filter(r => !r.empresaId || r.empresaId === empId);
    }

    // Empresa filha: mostra as regras da empresa mãe com os %s da filha sobrepostos
    const regrasDaMae = regras.filter(r => !r.empresaId || r.empresaId === empObj.empresaMaeId);
    return regrasDaMae.map(rm => {
      const rFilha = regrasFilha.find(
        rf => rf.regraMasterId === rm.id && rf.empresaFilhaId === empId
      );
      if (rFilha) {
        return {
          ...rm,
          tipoTabela: rFilha.tipoTabela || rm.tipoTabela || 'Linear',
          percentualComissao: rFilha.percentualComissao,
          percentualAdesao: rFilha.percentualAdesao ?? rm.percentualAdesao,
          percentualMensal: rFilha.percentualMensal ?? rm.percentualMensal,
          percentuaisParcelas: rFilha.percentuaisParcelas ?? rm.percentuaisParcelas,
          percentualComissaoContemplacao: rFilha.percentualComissaoContemplacao ?? rm.percentualComissaoContemplacao,
        };
      }
      return rm; // Sem regra filha: usa o % da mãe
    });
  }, [regras, regrasFilha, empresas, usuarioLogado]);

  // Para o super_master que está filtrando por empresa, também precisa de regras filtradas
  const regrasParaExibicao = useMemo((): RegraMaster[] => {
    if (isSuperMaster) return regras; // Super master vê tudo (filtro interno no RegrasMaster)
    return regrasEfetivasParaEmpresaAtual;
  }, [isSuperMaster, regras, regrasEfetivasParaEmpresaAtual]);

  // Vendas e Vendedores filtrados por empresa e por vendedor
  const vendasFiltradas = useMemo(() => {
    if (!usuarioLogado) return vendas;
    let base = vendas;
    if (isSuperMaster) {
      if (empresaFiltroMaster) {
        base = base.filter(v => (v.empresaId || 'emp_vertex') === empresaFiltroMaster);
      }
    } else {
      const empId = usuarioLogado.empresaId || 'emp_vertex';
      base = base.filter(v => (v.empresaId || 'emp_vertex') === empId);
      // Empresas filhas NÃO enxergam vendas espelho (geradas para a mãe)
      if (empresaAtualEhFilha) {
        base = base.filter(v => !v.isVendaEspelho);
      }
    }
    // Se o usuário logado for um Vendedor, filtra estritamente as suas próprias vendas
    if (usuarioLogado.role === 'vendedor' || usuarioLogado.vendedorId) {
      const vId = usuarioLogado.vendedorId;
      const vNome = usuarioLogado.nome.toLowerCase();
      base = base.filter(v => !v.isVendaEspelho && ((vId && v.vendedorId === vId) || v.vendedorNome?.toLowerCase() === vNome));
    }
    return base;
  }, [vendas, usuarioLogado, empresaFiltroMaster, isSuperMaster, empresaAtualEhFilha]);

  const vendedoresFiltrados = useMemo(() => {
    if (!usuarioLogado) return vendedores;
    let base = vendedores;
    if (isSuperMaster) {
      if (empresaFiltroMaster) {
        base = base.filter(v => (v.empresaId || 'emp_vertex') === empresaFiltroMaster);
      }
    } else {
      const empId = usuarioLogado.empresaId || 'emp_vertex';
      base = base.filter(v => (v.empresaId || 'emp_vertex') === empId);
    }
    if (usuarioLogado.role === 'vendedor' || usuarioLogado.vendedorId) {
      const vId = usuarioLogado.vendedorId;
      const vNome = usuarioLogado.nome.toLowerCase();
      base = base.filter(v => (vId && v.id === vId) || v.nome?.toLowerCase() === vNome);
    }
    return base;
  }, [vendedores, usuarioLogado, empresaFiltroMaster, isSuperMaster]);

  // Filtro de data global compartilhado entre Dashboard, Painel de Vendas e Comissões
  const [dataInicio, setDataInicio] = useState<string>('2026-01-01');
  const [dataFim, setDataFim] = useState<string>('2026-12-31');

  // Ciclos de faturamento (mês a mês)
  const [ciclos, setCiclos] = useState<Record<string, [number, number]>>(() => {
    const saved = localStorage.getItem('apex_ciclos_faturamento');
    return saved ? JSON.parse(saved) : {
      'padrao': [10, 25]
    };
  });

  // Estados temporários para os inputs de data antes do clique no botão Filtrar
  const [tempDataInicio, setTempDataInicio] = useState<string>('2026-01-01');
  const [tempDataFim, setTempDataFim] = useState<string>('2026-12-31');

  // Expande automaticamente a dataFim do filtro geral quando alguma parcela ativa ultrapassar o ano de 2026
  useEffect(() => {
    let dataMax = '2026-12-31';
    vendas.forEach((venda) => {
      Object.values(venda.projecaoMensal).forEach((mesObj) => {
        if (mesObj.valorVenda > 0 && mesObj.status !== 'Cancelada' && mesObj.dataVencimento > dataMax) {
          dataMax = mesObj.dataVencimento;
        }
      });
    });

    const [ano] = dataMax.split('-');
    const novaDataFim = `${ano}-12-31`;
    if (novaDataFim > dataFim) {
      setDataFim(novaDataFim);
      setTempDataFim(novaDataFim);
    }
  }, [vendas, dataFim]);

  const handleFiltrar = () => {
    const ini = (tempDataInicio && tempDataInicio.length >= 10 && !tempDataInicio.includes('d')) ? tempDataInicio : '2026-01-01';
    const fim = (tempDataFim && tempDataFim.length >= 10 && !tempDataFim.includes('d')) ? tempDataFim : '2026-12-31';
    setDataInicio(ini);
    setDataFim(fim);
  };

  // Estado de sincronização com o Supabase
  const [statusSincronizacao, setStatusSincronizacao] = useState<'sincronizando' | 'sincronizado' | 'erro'>('sincronizando');

  // Carga inicial do Supabase
  useEffect(() => {
    const carregarDadosSupabase = async () => {
      setStatusSincronizacao('sincronizando');
      try {
        // Inicializa o Master padrão se a tabela de usuários estiver vazia
        await inicializarUsuarioMaster();

        // Inicializa as empresas padrão (Vertex, Winvest, Shazam)
        const emps = await inicializarEmpresasPadrao();
        setEmpresas(emps);

        const [vend, reg, vendasData] = await Promise.all([
          obterVendedoresSupabase(),
          obterRegrasSupabase(),
          obterVendasSupabase()
        ]);
        
        setVendedores(vend.map(v => ({ ...v, empresaId: v.empresaId || 'emp_vertex' })));
        setRegras(reg);

        // Carregar regras filha
        try {
          const rFilha = await obterRegrasFilhaSupabase();
          setRegrasFilha(rFilha);
          localStorage.setItem('apex_regras_filha', JSON.stringify(rFilha));
        } catch {
          console.warn('regras_filha indisponível, usando local');
        }

        // Roda a migração de status nos dados vindos do Supabase e atribui Vertex se não tiver empresa
        const vendasComEmpresa = vendasData.map(v => ({ ...v, empresaId: v.empresaId || 'emp_vertex' }));
        const { novasVendas } = await migrarDadosStatusRecebida(vendasComEmpresa, true);
        setVendas(novasVendas.map(v => ({ ...v, empresaId: v.empresaId || 'emp_vertex' })));
        
        setStatusSincronizacao('sincronizado');
      } catch (err) {
        console.error('Erro ao conectar ao Supabase, mantendo dados locais:', err);
        setStatusSincronizacao('erro');

        // Roda a migração de status também nos dados locais salvos se houver falha
        const savedVendas = localStorage.getItem('apex_lancamentos_vendas');
        if (savedVendas) {
          try {
            const parsed = JSON.parse(savedVendas);
            migrarDadosStatusRecebida(parsed, false).then(({ novasVendas }) => {
              setVendas(novasVendas.map(v => ({ ...v, empresaId: v.empresaId || 'emp_vertex' })));
            });
          } catch (e) {
            console.error('Erro ao ler vendas locais do localStorage:', e);
          }
        }
      }
    };

    carregarDadosSupabase();
  }, []);

  // Persistência local
  useEffect(() => {
    localStorage.setItem('apex_regras_master', JSON.stringify(regras));
  }, [regras]);

  useEffect(() => {
    localStorage.setItem('apex_lancamentos_vendas', JSON.stringify(vendas));
  }, [vendas]);

  useEffect(() => {
    localStorage.setItem('apex_vendedores', JSON.stringify(vendedores));
  }, [vendedores]);

  useEffect(() => {
    localStorage.setItem('apex_dark_mode', String(darkMode));
    localStorage.setItem('apex_ciclos_faturamento', JSON.stringify(ciclos));
  }, [ciclos]);



  // Ações de Regras
  const handleAdicionarRegra = (novaRegra: Omit<RegraMaster, 'id'>) => {
    const regra: RegraMaster = {
      ...novaRegra,
      id: `r_${Date.now()}`
    };
    setRegras((prev) => [...prev, regra]);
    salvarRegraSupabase(regra).catch((err) => console.error('Erro Supabase Regras:', err));
  };

  const handleEditarRegra = (regraEditada: RegraMaster) => {
    setRegras((prev) =>
      prev.map((r) => (r.id === regraEditada.id ? regraEditada : r))
    );
    salvarRegraSupabase(regraEditada).catch((err) => console.error('Erro Supabase Regras:', err));
    
    // Atualizar percentual de comissões em vendas que usavam essa regra antiga
    setVendas((prevVendas) =>
      prevVendas.map((venda) => {
        if (
          venda.segmento === regraEditada.segmento &&
          venda.tabela === regraEditada.tabela &&
          venda.qtdParcelas === regraEditada.qtdParcelas
        ) {
          // Recalcular comissões com base na nova regra
          const percentualMensal = regraEditada.percentualComissao / regraEditada.qtdParcelas;
          const projecaoRecalculada = { ...venda.projecaoMensal };

          Object.keys(projecaoRecalculada).forEach((mes) => {
            const valor = projecaoRecalculada[mes].valorVenda || 0;
            const comissao = valor * (percentualMensal / 100);
            projecaoRecalculada[mes] = {
              ...projecaoRecalculada[mes],
              comissaoGerada: Number(comissao.toFixed(2))
            };
          });

          // Reutiliza calcularTotaisLinha para consistência nos totais
          const { totalVendas, totalComissoes, projecaoAtualizada } = calcularTotaisLinha(
            projecaoRecalculada,
            regraEditada.percentualComissao,
            regraEditada.qtdParcelas
          );

          const vendaAtualizada = {
            ...venda,
            percentualComissao: regraEditada.percentualComissao,
            projecaoMensal: projecaoAtualizada,
            totalVendas,
            totalComissoes
          };

          salvarVendaSupabase(vendaAtualizada).catch((err) => console.error('Erro Supabase Vendas (Edição Regra):', err));

          return vendaAtualizada;
        }
        return venda;
      })
    );
  };

  const handleExcluirRegra = (id: string) => {
    setRegras((prev) => prev.filter((r) => r.id !== id));
    excluirRegraSupabase(id).catch((err) => console.error('Erro Supabase Regras (Exclusão):', err));
  };

  // Ações de Vendas
  const handleAdicionarVenda = (novaVenda: LancamentoVenda) => {
    // Injeta a empresa: super_master usa a do filtro; masters de empresa usam a sua empresa
    const empId = isSuperMaster
      ? (empresaFiltroMaster || usuarioLogado?.empresaId || 'emp_vertex')
      : (usuarioLogado?.empresaId || 'emp_vertex');
    const vendaComEmpresa: LancamentoVenda = { ...novaVenda, empresaId: empId };
    setVendas((prev) => [...prev, vendaComEmpresa]);
    salvarVendaSupabase(vendaComEmpresa).catch((err) => console.error('Erro Supabase Vendas:', err));

    // ===== Lógica de geração de venda espelho para a empresa mãe =====
    const empresaFilhaObj = empresas.find(e => e.id === empId);
    if (empresaFilhaObj?.empresaMaeId) {
      const maeId = empresaFilhaObj.empresaMaeId;

      // Encontrar a regra mestre correspondente (da empresa mãe)
      const regraMae = regras.find(r =>
        r.segmento === novaVenda.segmento &&
        r.tabela === novaVenda.tabela &&
        r.qtdParcelas === novaVenda.qtdParcelas &&
        (!r.empresaId || r.empresaId === maeId)
      );

      // Encontrar a regra filha correspondente
      const regraFilhaCorrespondente = regrasFilha.find(rf =>
        rf.empresaFilhaId === empId &&
        rf.regraMasterId === regraMae?.id
      );

      if (regraMae && regraFilhaCorrespondente) {
        const qtd = novaVenda.qtdParcelas;
        
        // Obter grade completa de parcelas da mãe
        let gradeMae = regraMae.percentuaisParcelas;
        if (!gradeMae || gradeMae.length !== qtd) {
          if (regraMae.tipoTabela === 'Adesão') {
            const rest = Math.max(1, qtd - 1);
            const vM = Number(((regraMae.percentualMensal || 0) / rest).toFixed(3));
            gradeMae = [regraMae.percentualAdesao || 0];
            for (let i = 1; i < qtd; i++) gradeMae.push(vM);
          } else {
            const vL = Number((regraMae.percentualComissao / qtd).toFixed(3));
            gradeMae = Array(qtd).fill(vL);
          }
        }

        // Obter grade completa de parcelas da filha
        let gradeFilha = novaVenda.percentuaisParcelas || regraFilhaCorrespondente.percentuaisParcelas;
        if (!gradeFilha || gradeFilha.length !== qtd) {
          if (regraFilhaCorrespondente.tipoTabela === 'Adesão') {
            const rest = Math.max(1, qtd - 1);
            const vM = Number(((regraFilhaCorrespondente.percentualMensal || 0) / rest).toFixed(3));
            gradeFilha = [regraFilhaCorrespondente.percentualAdesao || 0];
            for (let i = 1; i < qtd; i++) gradeFilha.push(vM);
          } else {
            const vL = Number((regraFilhaCorrespondente.percentualComissao / qtd).toFixed(3));
            gradeFilha = Array(qtd).fill(vL);
          }
        }

        // Calcular grade diferencial exata [difP1, difP2, ..., difPn]
        const gradeDiferencial = gradeMae.map((pMae, i) =>
          Math.max(0, Number((pMae - (gradeFilha![i] || 0)).toFixed(2)))
        );

        const percDifTotal = Number(gradeDiferencial.reduce((a, b) => a + b, 0).toFixed(2));
        const temDiferencialPositivo = gradeDiferencial.some(d => d > 0);

        if (temDiferencialPositivo) {
          const projecaoEspelho = { ...novaVenda.projecaoMensal };
          const difAdesao = gradeDiferencial[0] || 0;
          const difMensal = Number(gradeDiferencial.slice(1).reduce((a, b) => a + b, 0).toFixed(2));

          const { totalVendas: tvEsp, totalComissoes: tcEsp, projecaoAtualizada: projEsp } =
            calcularTotaisLinha(
              projecaoEspelho,
              percDifTotal,
              novaVenda.qtdParcelas,
              regraMae.tipoTabela || 'Linear',
              difAdesao,
              difMensal,
              gradeDiferencial
            );

          const vendaEspelho: LancamentoVenda = {
            ...vendaComEmpresa,
            id: `esp_${vendaComEmpresa.id}_${Date.now()}`,
            empresaId: maeId,
            vendedorId: undefined,
            vendedorNome: undefined,
            tipoTabela: regraMae.tipoTabela || 'Linear',
            percentualComissao: percDifTotal,
            percentualAdesao: difAdesao,
            percentualMensal: difMensal,
            percentuaisParcelas: gradeDiferencial,
            projecaoMensal: projEsp,
            totalVendas: tvEsp,
            totalComissoes: tcEsp,
            isVendaEspelho: true,
            vendaOrigemId: vendaComEmpresa.id,
            empresaFilhaOrigemId: empId,
          };

          setVendas(prev => [...prev, vendaEspelho]);
          salvarVendaSupabase(vendaEspelho).catch(err => console.error('Erro ao salvar venda espelho:', err));
        }

        // Contemplação: também gera espelho se houver diferencial
        if (
          regraMae.percentualComissaoContemplacao != null &&
          regraFilhaCorrespondente.percentualComissaoContemplacao != null
        ) {
          const percDifContempl = regraMae.percentualComissaoContemplacao - regraFilhaCorrespondente.percentualComissaoContemplacao;
          if (percDifContempl > 0 && novaVenda.contemplado && novaVenda.comissaoContemplacao != null) {
            const comissaoContemplEspelho = (novaVenda.comissaoContemplacao / regraFilhaCorrespondente.percentualComissaoContemplacao) * percDifContempl;
            console.log('[ESPELHO] Diferencial de contemplação:', comissaoContemplEspelho);
          }
        }
      }
    }
  };

  const handleAtualizarVenda = (vendaAtualizada: LancamentoVenda) => {
    setVendas((prev) =>
      prev.map((v) => (v.id === vendaAtualizada.id ? vendaAtualizada : v))
    );
    salvarVendaSupabase(vendaAtualizada).catch((err) => console.error('Erro Supabase Vendas (Edição):', err));

    // Atualizar vendas espelho vinculadas (sincronizar dados do contrato, mantendo modalidade e % diferencial)
    setVendas(prev => prev.map(v => {
      if (v.vendaOrigemId !== vendaAtualizada.id || !v.isVendaEspelho) return v;
      
      const projecaoEspelho = { ...vendaAtualizada.projecaoMensal };
      const { totalVendas: tvEsp, totalComissoes: tcEsp, projecaoAtualizada: projEsp } =
        calcularTotaisLinha(
          projecaoEspelho,
          v.percentualComissao,
          vendaAtualizada.qtdParcelas,
          v.tipoTabela || 'Linear',
          v.percentualAdesao,
          v.percentualMensal,
          v.percentuaisParcelas
        );

      const espelhoAtualizado: LancamentoVenda = {
        ...v,
        cliente: vendaAtualizada.cliente,
        pac: vendaAtualizada.pac,
        segmento: vendaAtualizada.segmento,
        tabela: vendaAtualizada.tabela,
        qtdParcelas: vendaAtualizada.qtdParcelas,
        tipoTabela: v.tipoTabela || 'Linear',
        valorVenda: vendaAtualizada.valorVenda,
        valorParcela: vendaAtualizada.valorParcela,
        dataVenda: vendaAtualizada.dataVenda,
        statusCliente: vendaAtualizada.statusCliente,
        projecaoMensal: projEsp,
        totalVendas: tvEsp,
        totalComissoes: tcEsp,
      };
      salvarVendaSupabase(espelhoAtualizado).catch(err => console.error('Erro ao atualizar espelho:', err));
      return espelhoAtualizado;
    }));
  };

  const handleExcluirVenda = (vendaId: string) => {
    // Excluir também as vendas espelho vinculadas
    setVendas((prev) => prev.filter((v) => v.id !== vendaId && v.vendaOrigemId !== vendaId));
    excluirVendaSupabase(vendaId).catch((err) => console.error('Erro Supabase Excluir Vendas:', err));
    excluirVendasEspelhoSupabase(vendaId).catch((err) => console.warn('Erro ao excluir espelhos:', err));
  };

  // Alterar status de comissão de uma parcela específica (independente do status da venda)
  const handleAlterarStatusComissao = (vendaId: string, mesChave: string, novoStatus: StatusComissao) => {
    setVendas((prev) => {
      const atualizadas = prev.map((v) => {
        if (v.id !== vendaId) return v;
        const celulaAtual = v.projecaoMensal[mesChave];
        if (!celulaAtual) return v;
        const projecaoAtualizada = { ...celulaAtual, statusComissao: novoStatus };
        const vendaAtualizada = {
          ...v,
          projecaoMensal: { ...v.projecaoMensal, [mesChave]: projecaoAtualizada },
        };
        salvarVendaSupabase(vendaAtualizada).catch((err) => console.error('Erro Supabase StatusComissao:', err));
        return vendaAtualizada;
      });
      return atualizadas;
    });
  };

  // Ações de Vendedores
  const handleAdicionarVendedor = (novoVendedor: Vendedor) => {
    const empId = novoVendedor.empresaId || (
      isSuperMaster
        ? (empresaFiltroMaster || usuarioLogado?.empresaId || 'emp_vertex')
        : (usuarioLogado?.empresaId || 'emp_vertex')
    );
    const vendedorComEmpresa = { ...novoVendedor, empresaId: empId };
    setVendedores((prev) => {
      const index = prev.findIndex(v => v.id === vendedorComEmpresa.id);
      if (index >= 0) {
        const cop = [...prev];
        cop[index] = vendedorComEmpresa;
        return cop;
      }
      return [...prev, vendedorComEmpresa];
    });
    salvarVendedorSupabase(vendedorComEmpresa).catch((err) => console.error('Erro Supabase Vendedores:', err));
  };

  // Exportar dados como JSON para fins de backup
  const handleExportarDados = () => {
    const dados = { regras, vendas, vendedores };
    const blob = new Blob([JSON.stringify(dados, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `apex_comissoes_backup_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  if (usuarioLogado === null) {
    return (
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <Login onLoginSuccess={(u) => setUsuarioLogado(u)} />
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      
      <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'background.default' }}>
        {/* Sidebar Lateral Fixa */}
        <Box
          sx={{
            width: sidebarContraida ? 80 : 280,
            flexShrink: 0,
            borderRight: `1px solid ${theme.palette.mode === 'dark' ? '#1f2937' : '#e5e7eb'}`,
            bgcolor: theme.palette.mode === 'dark' ? '#111827' : '#ffffff',
            display: 'flex',
            flexDirection: 'column',
            position: 'fixed',
            top: 0,
            bottom: 0,
            left: 0,
            zIndex: 1200,
            transition: 'width 0.2s ease-in-out'
          }}
        >
          {/* Logo */}
          <Box sx={{ 
            p: sidebarContraida ? 2 : 3, 
            display: 'flex', 
            flexDirection: sidebarContraida ? 'column' : 'row',
            alignItems: 'center', 
            justifyContent: sidebarContraida ? 'center' : 'space-between',
            gap: sidebarContraida ? 1.5 : 1.5, 
            borderBottom: `1px solid ${theme.palette.mode === 'dark' ? '#1f2937' : '#e5e7eb'}`,
            transition: 'all 0.2s'
          }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Box
                sx={{
                  p: 1,
                  borderRadius: 2,
                  background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                  color: '#ffffff',
                  boxShadow: '0 4px 10px rgba(99, 102, 241, 0.25)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <AssessmentIcon />
              </Box>
              {!sidebarContraida && (
                <Box>
                  <Typography
                    variant="h6"
                    sx={{
                      fontWeight: 800,
                      fontFamily: 'Outfit, sans-serif',
                      color: theme.palette.mode === 'dark' ? '#f3f4f6' : '#0f172a',
                      lineHeight: 1.1,
                      letterSpacing: '-0.5px'
                    }}
                  >
                    APEX
                  </Typography>
                  <Typography
                    variant="caption"
                    sx={{
                      fontWeight: 600,
                      color: theme.palette.primary.main,
                      fontSize: '0.65rem',
                      letterSpacing: '1px',
                      textTransform: 'uppercase'
                    }}
                  >
                    Comissão & Projeção
                  </Typography>
                </Box>
              )}
            </Box>

            <IconButton 
              size="small" 
              onClick={() => setSidebarContraida(!sidebarContraida)}
              sx={{ 
                color: 'text.secondary',
              }}
            >
              {sidebarContraida ? <ChevronRightIcon /> : <ChevronLeftIcon />}
            </IconButton>
          </Box>

          {/* Menu de Navegação da Sidebar */}
          <Box sx={{ flexGrow: 1, px: sidebarContraida ? 1 : 2, py: 3, display: 'flex', flexDirection: 'column', gap: 1, overflowX: 'hidden', overflowY: 'auto', transition: 'all 0.2s' }}>
            <Tooltip title="Dashboard" placement="right" disableHoverListener={!sidebarContraida}>
              <Button
                variant={abaAtiva === 'dashboard' ? 'contained' : 'text'}
                startIcon={!sidebarContraida ? <DashboardIcon /> : undefined}
                onClick={() => setAbaAtiva('dashboard')}
                fullWidth
                sx={{
                  justifyContent: sidebarContraida ? 'center' : 'flex-start',
                  py: 1.25,
                  px: sidebarContraida ? 0 : 2,
                  minWidth: sidebarContraida ? 48 : undefined,
                  borderRadius: 2,
                  fontWeight: 600,
                  fontFamily: 'Outfit, sans-serif',
                  fontSize: '0.9rem',
                  color: abaAtiva === 'dashboard' ? '#ffffff' : 'text.secondary',
                  background: abaAtiva === 'dashboard' ? 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)' : 'transparent',
                  boxShadow: abaAtiva === 'dashboard' ? '0 4px 12px rgba(99, 102, 241, 0.25)' : 'none',
                  '&:hover': {
                    background: abaAtiva === 'dashboard' ? 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)' : 'rgba(99, 102, 241, 0.08)',
                    color: abaAtiva === 'dashboard' ? '#ffffff' : 'primary.main'
                  }
                }}
              >
                {sidebarContraida ? <DashboardIcon /> : 'Dashboard'}
              </Button>
            </Tooltip>

            {(!usuarioLogado || isSuperMaster || usuarioLogado.role === 'master' || usuarioLogado.permissoes?.visualizarDashboardVendedores) && (
              <Tooltip title="Dashboard Vendedores" placement="right" disableHoverListener={!sidebarContraida}>
                <Button
                  variant={abaAtiva === 'dashboard_vendedores' ? 'contained' : 'text'}
                  startIcon={!sidebarContraida ? <GroupIcon /> : undefined}
                  onClick={() => setAbaAtiva('dashboard_vendedores')}
                  fullWidth
                  sx={{
                    justifyContent: sidebarContraida ? 'center' : 'flex-start',
                    py: 1.25,
                    px: sidebarContraida ? 0 : 2,
                    minWidth: sidebarContraida ? 48 : undefined,
                    borderRadius: 2,
                    fontWeight: 600,
                    fontFamily: 'Outfit, sans-serif',
                    fontSize: '0.9rem',
                    color: abaAtiva === 'dashboard_vendedores' ? '#ffffff' : 'text.secondary',
                    background: abaAtiva === 'dashboard_vendedores' ? 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)' : 'transparent',
                    boxShadow: abaAtiva === 'dashboard_vendedores' ? '0 4px 12px rgba(99, 102, 241, 0.25)' : 'none',
                    '&:hover': {
                      background: abaAtiva === 'dashboard_vendedores' ? 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)' : 'rgba(99, 102, 241, 0.08)',
                      color: abaAtiva === 'dashboard_vendedores' ? '#ffffff' : 'primary.main'
                    }
                  }}
                >
                  {sidebarContraida ? <GroupIcon /> : 'Dashboard Vendedores'}
                </Button>
              </Tooltip>
            )}

            <Tooltip title="Painel de Vendas" placement="right" disableHoverListener={!sidebarContraida}>
              <Button
                variant={abaAtiva === 'vendas' ? 'contained' : 'text'}
                startIcon={!sidebarContraida ? <ReceiptLongIcon /> : undefined}
                onClick={() => setAbaAtiva('vendas')}
                fullWidth
                sx={{
                  justifyContent: sidebarContraida ? 'center' : 'flex-start',
                  py: 1.25,
                  px: sidebarContraida ? 0 : 2,
                  minWidth: sidebarContraida ? 48 : undefined,
                  borderRadius: 2,
                  fontWeight: 600,
                  fontFamily: 'Outfit, sans-serif',
                  fontSize: '0.9rem',
                  color: abaAtiva === 'vendas' ? '#ffffff' : 'text.secondary',
                  background: abaAtiva === 'vendas' ? 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)' : 'transparent',
                  boxShadow: abaAtiva === 'vendas' ? '0 4px 12px rgba(99, 102, 241, 0.25)' : 'none',
                  '&:hover': {
                    background: abaAtiva === 'vendas' ? 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)' : 'rgba(99, 102, 241, 0.08)',
                    color: abaAtiva === 'vendas' ? '#ffffff' : 'primary.main'
                  }
                }}
              >
                {sidebarContraida ? <ReceiptLongIcon /> : 'Painel de Vendas'}
              </Button>
            </Tooltip>

            <Tooltip title="Comissões Vendedores" placement="right" disableHoverListener={!sidebarContraida}>
              <Button
                variant={abaAtiva === 'comissoes' ? 'contained' : 'text'}
                startIcon={!sidebarContraida ? <AccountBalanceWalletIcon /> : undefined}
                onClick={() => setAbaAtiva('comissoes')}
                fullWidth
                sx={{
                  justifyContent: sidebarContraida ? 'center' : 'flex-start',
                  py: 1.25,
                  px: sidebarContraida ? 0 : 2,
                  minWidth: sidebarContraida ? 48 : undefined,
                  borderRadius: 2,
                  fontWeight: 600,
                  fontFamily: 'Outfit, sans-serif',
                  fontSize: '0.9rem',
                  color: abaAtiva === 'comissoes' ? '#ffffff' : 'text.secondary',
                  background: abaAtiva === 'comissoes' ? 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)' : 'transparent',
                  boxShadow: abaAtiva === 'comissoes' ? '0 4px 12px rgba(99, 102, 241, 0.25)' : 'none',
                  '&:hover': {
                    background: abaAtiva === 'comissoes' ? 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)' : 'rgba(99, 102, 241, 0.08)',
                    color: abaAtiva === 'comissoes' ? '#ffffff' : 'primary.main'
                  }
                }}
              >
                {sidebarContraida ? <AccountBalanceWalletIcon /> : 'Comissões Vendedores'}
              </Button>
            </Tooltip>

            <Tooltip title="Previsão de Recebimentos" placement="right" disableHoverListener={!sidebarContraida}>
              <Button
                variant={abaAtiva === 'relatorio' ? 'contained' : 'text'}
                startIcon={!sidebarContraida ? <AssessmentIcon /> : undefined}
                onClick={() => setAbaAtiva('relatorio')}
                fullWidth
                sx={{
                  justifyContent: sidebarContraida ? 'center' : 'flex-start',
                  py: 1.25,
                  px: sidebarContraida ? 0 : 2,
                  minWidth: sidebarContraida ? 48 : undefined,
                  borderRadius: 2,
                  fontWeight: 600,
                  fontFamily: 'Outfit, sans-serif',
                  fontSize: '0.9rem',
                  color: abaAtiva === 'relatorio' ? '#ffffff' : 'text.secondary',
                  background: abaAtiva === 'relatorio' ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' : 'transparent',
                  boxShadow: abaAtiva === 'relatorio' ? '0 4px 12px rgba(16, 185, 129, 0.25)' : 'none',
                  '&:hover': {
                    background: abaAtiva === 'relatorio' ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' : 'rgba(16, 185, 129, 0.08)',
                    color: abaAtiva === 'relatorio' ? '#ffffff' : '#10b981'
                  }
                }}
              >
                {sidebarContraida ? <AssessmentIcon /> : 'Previsão de Recebimentos'}
              </Button>
            </Tooltip>

            <Tooltip title="Relatório de Comissões" placement="right" disableHoverListener={!sidebarContraida}>
              <Button
                variant={abaAtiva === 'relatorio_comissoes' ? 'contained' : 'text'}
                startIcon={!sidebarContraida ? <AccountBalanceWalletIcon /> : undefined}
                onClick={() => setAbaAtiva('relatorio_comissoes')}
                fullWidth
                sx={{
                  justifyContent: sidebarContraida ? 'center' : 'flex-start',
                  py: 1.25,
                  px: sidebarContraida ? 0 : 2,
                  minWidth: sidebarContraida ? 48 : undefined,
                  borderRadius: 2,
                  fontWeight: 600,
                  fontFamily: 'Outfit, sans-serif',
                  fontSize: '0.9rem',
                  color: abaAtiva === 'relatorio_comissoes' ? '#ffffff' : 'text.secondary',
                  background: abaAtiva === 'relatorio_comissoes' ? 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' : 'transparent',
                  boxShadow: abaAtiva === 'relatorio_comissoes' ? '0 4px 12px rgba(245, 158, 11, 0.25)' : 'none',
                  '&:hover': {
                    background: abaAtiva === 'relatorio_comissoes' ? 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' : 'rgba(245, 158, 11, 0.08)',
                    color: abaAtiva === 'relatorio_comissoes' ? '#ffffff' : '#f59e0b'
                  }
                }}
              >
                {sidebarContraida ? <AccountBalanceWalletIcon /> : 'Relatório de Comissões'}
              </Button>
            </Tooltip>

            {(isSuperMaster || usuarioLogado?.role === 'master' || usuarioLogado?.role === 'editor') && (
              <Tooltip title="Configurações" placement="right" disableHoverListener={!sidebarContraida}>
                <Button
                  variant={abaAtiva === 'configuracoes' ? 'contained' : 'text'}
                  startIcon={!sidebarContraida ? <SettingsIcon /> : undefined}
                  onClick={() => {
                    setAbaAtiva('configuracoes');
                    setSubAbaAtiva('regras');
                  }}
                  fullWidth
                  sx={{
                    justifyContent: sidebarContraida ? 'center' : 'flex-start',
                    py: 1.25,
                    px: sidebarContraida ? 0 : 2,
                    minWidth: sidebarContraida ? 48 : undefined,
                    borderRadius: 2,
                    fontWeight: 600,
                    fontFamily: 'Outfit, sans-serif',
                    fontSize: '0.9rem',
                    color: abaAtiva === 'configuracoes' ? '#ffffff' : 'text.secondary',
                    background: abaAtiva === 'configuracoes' ? 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)' : 'transparent',
                    boxShadow: abaAtiva === 'configuracoes' ? '0 4px 12px rgba(99, 102, 241, 0.25)' : 'none',
                    '&:hover': {
                      background: abaAtiva === 'configuracoes' ? 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)' : 'rgba(99, 102, 241, 0.08)',
                      color: abaAtiva === 'configuracoes' ? '#ffffff' : 'primary.main'
                    }
                  }}
                >
                  {sidebarContraida ? <SettingsIcon /> : 'Configurações'}
                </Button>
              </Tooltip>
            )}
          </Box>

          {/* Rodapé da Sidebar - Configurações e Perfil do Usuário */}
          <Box sx={{ p: sidebarContraida ? 1 : 2, borderTop: `1px solid ${theme.palette.mode === 'dark' ? '#1f2937' : '#e5e7eb'}`, transition: 'all 0.2s' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: sidebarContraida ? 'center' : 'space-between', mb: 2, px: sidebarContraida ? 0 : 1 }}>
              {!sidebarContraida && (
                <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, fontSize: '0.72rem' }}>
                  Modo {darkMode ? 'Escuro' : 'Claro'}
                </Typography>
              )}
              <Tooltip title={`Alternar para modo ${darkMode ? 'Claro' : 'Escuro'}`} placement="right" disableHoverListener={!sidebarContraida}>
                <IconButton onClick={() => setDarkMode(!darkMode)} size="small" sx={{ bgcolor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)' }}>
                  {darkMode ? <LightModeIcon sx={{ fontSize: 16 }} /> : <DarkModeIcon sx={{ fontSize: 16 }} />}
                </IconButton>
              </Tooltip>
            </Box>

            <Box
              sx={{
                display: 'flex',
                flexDirection: sidebarContraida ? 'column' : 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: sidebarContraida ? 1.5 : 1,
                bgcolor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)',
                p: sidebarContraida ? 1 : 1.5,
                borderRadius: 2.5,
                transition: 'all 0.2s'
              }}
            >
              {!sidebarContraida ? (
                <>
                  <Box sx={{ display: 'flex', flexDirection: 'column', flexGrow: 1, minWidth: 0 }}>
                    <Typography variant="body2" noWrap sx={{ fontWeight: 700, color: 'text.primary', fontSize: '0.82rem' }}>
                      {usuarioLogado.nome}
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.68rem', fontWeight: 600 }}>
                      {usuarioLogado.role.toUpperCase()}
                    </Typography>
                  </Box>
                  <Tooltip title="Sair do Sistema">
                    <IconButton
                      onClick={() => setUsuarioLogado(null)}
                      color="error"
                      size="small"
                      sx={{
                        bgcolor: 'rgba(239, 68, 68, 0.05)',
                        '&:hover': { bgcolor: 'rgba(239, 68, 68, 0.15)' }
                      }}
                    >
                      <LogoutIcon sx={{ fontSize: 16 }} />
                    </IconButton>
                  </Tooltip>
                </>
              ) : (
                <Tooltip title={`${usuarioLogado.nome} (${usuarioLogado.role.toUpperCase()}) - Sair`} placement="right">
                  <IconButton
                    onClick={() => setUsuarioLogado(null)}
                    color="error"
                    size="small"
                    sx={{
                      bgcolor: 'rgba(239, 68, 68, 0.05)',
                      p: 1,
                      '&:hover': { bgcolor: 'rgba(239, 68, 68, 0.15)' }
                    }}
                  >
                    <LogoutIcon sx={{ fontSize: 18 }} />
                  </IconButton>
                </Tooltip>
              )}
            </Box>
          </Box>
        </Box>

        {/* Área de Conteúdo Principal (Direita) */}
        <Box sx={{ 
          flexGrow: 1, 
          ml: sidebarContraida ? '80px' : '280px', 
          minWidth: 0, 
          display: 'flex', 
          flexDirection: 'column', 
          pb: 6,
          transition: 'margin-left 0.2s ease-in-out'
        }}>
          {/* Header Superior da Área de Conteúdo */}
          <Box
            sx={{
              height: 70,
              px: 4,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderBottom: `1px solid ${theme.palette.mode === 'dark' ? '#1f2937' : '#e5e7eb'}`,
              bgcolor: theme.palette.mode === 'dark' ? 'rgba(11, 15, 25, 0.8)' : 'rgba(255, 255, 255, 0.8)',
              backdropFilter: 'blur(12px)',
              position: 'sticky',
              top: 0,
              zIndex: 1100
            }}
          >
            <Typography variant="h6" sx={{ fontFamily: 'Outfit, sans-serif', fontWeight: 750, color: 'text.primary' }}>
              {abaAtiva === 'dashboard' && 'Dashboard de Performance'}
              {abaAtiva === 'dashboard_vendedores' && 'Dashboard de Vendedores'}
              {abaAtiva === 'vendas' && 'Painel de Vendas / Simulador'}
              {abaAtiva === 'comissoes' && 'Comissões de Corretores'}
              {abaAtiva === 'relatorio' && 'Relatório de Previsão de Recebimentos'}
              {abaAtiva === 'relatorio_comissoes' && 'Relatório de Comissões'}
              {abaAtiva === 'configuracoes' && 'Configurações Administrativas'}
            </Typography>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              {abaAtiva !== 'configuracoes' && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mr: 1 }}>
                  <TextField
                    label="De"
                    type="date"
                    size="small"
                    value={tempDataInicio}
                    onChange={(e: any) => setTempDataInicio(e.target.value)}
                    slotProps={{ inputLabel: { shrink: true } }}
                    sx={{ width: 135 }}
                  />
                  <TextField
                    label="Até"
                    type="date"
                    size="small"
                    value={tempDataFim}
                    onChange={(e: any) => setTempDataFim(e.target.value)}
                    slotProps={{ inputLabel: { shrink: true } }}
                    sx={{ width: 135 }}
                  />
                  <Button
                    variant="contained"
                    size="small"
                    startIcon={<FilterAltIcon />}
                    onClick={handleFiltrar}
                    sx={{
                      borderRadius: 2,
                      textTransform: 'none',
                      fontWeight: 600,
                      fontFamily: 'Outfit, sans-serif',
                      py: 1,
                      px: 2,
                      height: 40,
                      background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
                      boxShadow: '0 4px 12px rgba(99, 102, 241, 0.15)',
                    }}
                  >
                    Filtrar
                  </Button>
                </Box>
              )}

              {/* Filtro de Empresa — visível apenas para super_master */}
              {isSuperMaster && empresas.length > 0 && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mr: 1 }}>
                  <BusinessIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                  <select
                    value={empresaFiltroMaster}
                    onChange={(e) => setEmpresaFiltroMaster(e.target.value)}
                    style={{
                      background: theme.palette.mode === 'dark' ? '#1f2937' : '#f8fafc',
                      color: theme.palette.mode === 'dark' ? '#f9fafb' : '#0f172a',
                      border: `1px solid ${theme.palette.mode === 'dark' ? '#374151' : '#d1d5db'}`,
                      borderRadius: 8,
                      padding: '7px 12px',
                      fontSize: '0.82rem',
                      fontWeight: 600,
                      fontFamily: 'Inter, sans-serif',
                      outline: 'none',
                      cursor: 'pointer',
                      minWidth: 130
                    }}
                  >
                    <option value="">Todas as empresas</option>
                    {empresas.map(emp => (
                      <option key={emp.id} value={emp.id}>{emp.nome}</option>
                    ))}
                  </select>
                </Box>
              )}

              {/* Indicador de Sincronização Supabase */}
              <Tooltip
                title={
                  statusSincronizacao === 'sincronizado'
                    ? 'Conectado ao Supabase (Banco na Nuvem)'
                    : statusSincronizacao === 'sincronizando'
                    ? 'Sincronizando dados com a nuvem...'
                    : 'Modo Offline (Usando Local Storage)'
                }
              >
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 0.5,
                    bgcolor:
                      statusSincronizacao === 'sincronizado'
                        ? 'rgba(16, 185, 129, 0.1)'
                        : statusSincronizacao === 'sincronizando'
                        ? 'rgba(99, 102, 241, 0.1)'
                        : 'rgba(239, 68, 68, 0.1)',
                    color:
                      statusSincronizacao === 'sincronizado'
                        ? '#10b981'
                        : statusSincronizacao === 'sincronizando'
                        ? '#6366f1'
                        : '#ef4444',
                    borderRadius: 2,
                    py: 0.5,
                    px: 1.2,
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px'
                  }}
                >
                  {statusSincronizacao === 'sincronizado' ? (
                    <>
                      <CloudDoneIcon sx={{ fontSize: 14 }} />
                      <span>Supabase</span>
                    </>
                  ) : statusSincronizacao === 'sincronizando' ? (
                    <>
                      <CloudQueueIcon sx={{ fontSize: 14 }} />
                      <span>Conectando...</span>
                    </>
                  ) : (
                    <>
                      <CloudOffIcon sx={{ fontSize: 14 }} />
                      <span>Offline</span>
                    </>
                  )}
                </Box>
              </Tooltip>

              <Button
                variant="outlined"
                size="small"
                startIcon={<FileDownloadIcon />}
                onClick={handleExportarDados}
                sx={{
                  borderColor: theme.palette.mode === 'dark' ? '#374151' : '#d1d5db',
                  color: theme.palette.mode === 'dark' ? '#cbd5e1' : '#475569',
                  borderRadius: 2,
                  textTransform: 'none',
                  fontWeight: 600,
                  fontSize: '0.8rem',
                  py: 0.6,
                  px: 1.5,
                  '&:hover': {
                    borderColor: theme.palette.primary.main,
                    color: theme.palette.primary.main
                  }
                }}
              >
                Backup dos Dados
              </Button>
            </Box>
          </Box>

          {/* Container de Informações e Views */}
          <Container maxWidth={false} sx={{ mt: 4, px: { xs: 2, md: 4 } }}>
               {abaAtiva === 'dashboard' && (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {/* KPI Section */}
                <KPISection vendas={vendasFiltradas} dataInicio={dataInicio} dataFim={dataFim} />
                
                {/* Gráficos Analíticos */}
                <AnalyticsCharts vendas={vendasFiltradas} dataInicio={dataInicio} dataFim={dataFim} />
              </Box>
            )}

            {abaAtiva === 'dashboard_vendedores' && (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <DashboardVendedores vendas={vendasFiltradas} vendedores={vendedoresFiltrados} dataInicio={dataInicio} dataFim={dataFim} />
              </Box>
            )}

             {abaAtiva === 'vendas' && (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {/* Tabela Timeline Principal */}
                <SimuladorVendas
                  vendas={vendasFiltradas}
                  regras={regrasParaExibicao}
                  vendedores={vendedoresFiltrados}
                  onAdicionarVenda={handleAdicionarVenda}
                  onAtualizarVenda={handleAtualizarVenda}
                  onExcluirVenda={handleExcluirVenda}
                  permissoes={usuarioLogado?.permissoes || { visualizar: true, editarVendas: false, cadastrarVendedores: false, cadastrarRegras: false }}
                  dataInicio={dataInicio}
                  dataFim={dataFim}
                  ciclos={ciclos}
                />
              </Box>
            )}

            {abaAtiva === 'comissoes' && (
              <ComissoesVendedores vendas={vendasFiltradas} vendedores={vendedoresFiltrados} dataInicio={dataInicio} dataFim={dataFim} />
            )}

            {abaAtiva === 'relatorio' && (
              <RelatorioRecebimentos
                vendas={vendasFiltradas}
                vendedores={vendedoresFiltrados}
                regras={regras}
                dataInicio={dataInicio}
                dataFim={dataFim}
                ciclos={ciclos}
                onAtualizarVenda={handleAtualizarVenda}
                permissoes={usuarioLogado?.permissoes}
              />
            )}

            {abaAtiva === 'relatorio_comissoes' && (
              <RelatorioComissoes
                vendas={vendasFiltradas}
                vendedores={vendedoresFiltrados}
                dataInicio={dataInicio}
                dataFim={dataFim}
                ciclos={ciclos}
                onAlterarStatusComissao={handleAlterarStatusComissao}
                podeEditarComissao={isSuperMaster || usuarioLogado?.role === 'master' || usuarioLogado?.role === 'financeiro'}
              />
            )}

            {abaAtiva === 'configuracoes' && (isSuperMaster || usuarioLogado?.role === 'master' || usuarioLogado?.role === 'editor') && (
              <ErrorBoundary>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {/* Header das Configurações */}
                  <Box>
                    <Typography
                      variant="h5"
                      sx={{
                        fontWeight: 800,
                        fontFamily: 'Outfit, sans-serif',
                        color: theme.palette.mode === 'dark' ? '#f8fafc' : '#0f172a'
                      }}
                    >
                      Configurações do Sistema
                    </Typography>
                    <Typography variant="body2" sx={{ color: theme.palette.mode === 'dark' ? '#94a3b8' : '#64748b', mt: 0.5 }}>
                      Gerencie tabelas de comissões, corretores de vendas e privilégios de acesso.
                    </Typography>
                  </Box>

                  {/* Barra de Sub-Abas */}
                  <Box
                    sx={{
                      borderBottom: 1,
                      borderColor: theme.palette.mode === 'dark' ? '#1f2937' : '#e5e7eb',
                      mb: 1
                    }}
                  >
                    <Tabs
                      value={subAbaAtiva}
                      onChange={(_, val) => setSubAbaAtiva(val)}
                      textColor="secondary"
                      indicatorColor="secondary"
                      sx={{
                        '& .MuiTab-root': {
                          fontFamily: 'Outfit, sans-serif',
                          fontWeight: 600,
                          fontSize: '0.9rem',
                          textTransform: 'none',
                          minWidth: 120,
                          pb: 1
                        }
                      }}
                    >
                      <Tab value="regras" icon={<StorageIcon sx={{ fontSize: 18 }} />} iconPosition="start" label="Banco de Regras (BD Master)" />
                      {/* Tab de Tabelas das Filhas — visível para super_master e masters de empresa mãe */}
                      {(isSuperMaster || (usuarioLogado?.role === 'master' && !empresaAtualEhFilha)) && empresas.some(e => !!e.empresaMaeId) && (
                        <Tab value="regras_filha" icon={<AccountTreeIcon sx={{ fontSize: 18 }} />} iconPosition="start" label="Tabelas das Filhas" />
                      )}
                      {(isSuperMaster || usuarioLogado?.role === 'master') && (
                        <Tab value="acessos" icon={<AdminPanelSettingsIcon sx={{ fontSize: 18 }} />} iconPosition="start" label="Gestão de Acessos e Vendedores" />
                      )}
                      {isSuperMaster && (
                        <Tab value="empresas" icon={<BusinessIcon sx={{ fontSize: 18 }} />} iconPosition="start" label="Empresas" />
                      )}
                    </Tabs>
                  </Box>

                  {/* Renderização das Sub-Abas */}
                  {subAbaAtiva === 'regras' && (
                    <RegrasMaster
                      regras={regras}
                      onAdicionarRegra={handleAdicionarRegra}
                      onEditarRegra={handleEditarRegra}
                      onExcluirRegra={handleExcluirRegra}
                      permissoes={usuarioLogado?.permissoes || { visualizar: true, editarVendas: false, cadastrarVendedores: false, cadastrarRegras: false }}
                      empresas={empresas}
                      empresaAtualId={usuarioLogado?.empresaId}
                      isSuperMaster={isSuperMaster}
                    />
                  )}

                  {/* Tabelas das Filhas */}
                  {subAbaAtiva === 'regras_filha' && (isSuperMaster || (usuarioLogado?.role === 'master' && !empresaAtualEhFilha)) && (
                    <RegrasFilha
                      empresas={empresas}
                      regrasMaster={regras}
                    />
                  )}

                  {(isSuperMaster || usuarioLogado?.role === 'master') && subAbaAtiva === 'acessos' && (
                    <UsuariosCadastro
                      usuarioLogado={usuarioLogado}
                      vendedores={vendedoresFiltrados}
                      onSalvarVendedor={handleAdicionarVendedor}
                    />
                  )}

                  {subAbaAtiva === 'empresas' && isSuperMaster && (
                    <EmpresasCadastro />
                  )}

                  {/* Ciclos de Faturamento — oculto visualmente, lógica preservada */}
                  {false && <Box
                    sx={{
                      mt: 4,
                      p: 3,
                      borderRadius: 3,
                      border: `1px solid ${theme.palette.mode === 'dark' ? '#1f2937' : '#e5e7eb'}`,
                      background: theme.palette.mode === 'dark' ? '#111827' : '#ffffff'
                    }}
                  >
                    <Typography
                      variant="subtitle1"
                      sx={{ fontWeight: 700, fontFamily: 'Outfit, sans-serif', mb: 0.5 }}
                    >
                      💰 Financeiro — Ciclos de Faturamento
                    </Typography>
                    <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2.5 }}>
                      Configure os ciclos de fechamento. O Padrão será usado caso um mês específico não tenha sido alterado manualmente.
                    </Typography>
                    
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                      {/* Configuração Padrão */}
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, p: 2, border: `2px solid ${theme.palette.primary.main}`, borderRadius: 2, bgcolor: theme.palette.mode === 'dark' ? 'rgba(99,102,241,0.05)' : 'rgba(99,102,241,0.02)' }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 700, color: theme.palette.primary.main }}>
                          Cortes Padrão (Usado em meses não configurados)
                        </Typography>
                        <Box sx={{ display: 'flex', gap: 2 }}>
                          <TextField
                            label="1º Ciclo (Início do mês)"
                            type="number"
                            size="small"
                            value={(ciclos['padrao'] || [10,25])[0]}
                            onChange={(e) => {
                              const v = Math.max(1, Math.min(28, Number(e.target.value)));
                              setCiclos(prev => ({ ...prev, 'padrao': [v, (prev['padrao'] || [10,25])[1]] }));
                            }}
                            slotProps={{ htmlInput: { min: 1, max: 28 } }}
                            sx={{ width: 180 }}
                          />
                          <TextField
                            label="2º Ciclo (Fim do mês)"
                            type="number"
                            size="small"
                            value={(ciclos['padrao'] || [10,25])[1]}
                            onChange={(e) => {
                              const v = Math.max(1, Math.min(28, Number(e.target.value)));
                              setCiclos(prev => ({ ...prev, 'padrao': [(prev['padrao'] || [10,25])[0], v] }));
                            }}
                            slotProps={{ htmlInput: { min: 1, max: 28 } }}
                            sx={{ width: 180 }}
                          />
                        </Box>
                      </Box>

                      <Divider sx={{ my: 1 }} />

                      <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                        Exceções Específicas por Mês
                      </Typography>
                      
                      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: '1fr 1fr 1fr' }, gap: 2 }}>
                        {['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'].map((mesStr, index) => {
                          const ano = new Date().getFullYear();
                          const mesKey = `${ano}-${mesStr}`;
                          const mesesNomes = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
                          
                          // Pega o valor específico do mês, ou o padrão apenas para exibir no placeholder
                          const valorEspecifico = ciclos[mesKey];
                          const valorPadrao = ciclos['padrao'] || [10, 25];
                          
                          return (
                            <Box key={mesKey} sx={{ p: 2, border: `1px solid ${theme.palette.divider}`, borderRadius: 2 }}>
                              <Typography variant="caption" sx={{ fontWeight: 700, display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                                <span>{mesesNomes[index]} {ano}</span>
                                {valorEspecifico && <span style={{ color: theme.palette.warning.main }}>Personalizado</span>}
                              </Typography>
                              <Box sx={{ display: 'flex', gap: 1 }}>
                                <TextField
                                  label="1º Ciclo"
                                  type="number"
                                  size="small"
                                  placeholder={String(valorPadrao[0])}
                                  value={valorEspecifico ? valorEspecifico[0] : ''}
                                  onChange={(e) => {
                                    const valStr = e.target.value;
                                    if (!valStr) {
                                      // Se apagar, volta pro padrão e remove a chave (opcional, ou apenas reseta se apagar ambos)
                                      setCiclos(prev => {
                                        const novo = { ...prev };
                                        const cur = novo[mesKey];
                                        if (cur) {
                                          novo[mesKey] = [Number(valStr), cur[1]];
                                        }
                                        return novo;
                                      });
                                    } else {
                                      const v = Math.max(1, Math.min(28, Number(valStr)));
                                      setCiclos(prev => {
                                        const cur = prev[mesKey] || [...valorPadrao];
                                        return { ...prev, [mesKey]: [v, cur[1]] };
                                      });
                                    }
                                  }}
                                  slotProps={{ htmlInput: { min: 1, max: 28 } }}
                                />
                                <TextField
                                  label="2º Ciclo"
                                  type="number"
                                  size="small"
                                  placeholder={String(valorPadrao[1])}
                                  value={valorEspecifico ? valorEspecifico[1] : ''}
                                  onChange={(e) => {
                                    const valStr = e.target.value;
                                    if (!valStr) {
                                      setCiclos(prev => {
                                        const novo = { ...prev };
                                        const cur = novo[mesKey];
                                        if (cur) {
                                          novo[mesKey] = [cur[0], Number(valStr)];
                                        }
                                        return novo;
                                      });
                                    } else {
                                      const v = Math.max(1, Math.min(28, Number(valStr)));
                                      setCiclos(prev => {
                                        const cur = prev[mesKey] || [...valorPadrao];
                                        return { ...prev, [mesKey]: [cur[0], v] };
                                      });
                                    }
                                  }}
                                  slotProps={{ htmlInput: { min: 1, max: 28 } }}
                                />
                              </Box>
                              {valorEspecifico && (
                                <Button 
                                  size="small" 
                                  color="error" 
                                  sx={{ mt: 1, textTransform: 'none', fontSize: '0.7rem' }}
                                  onClick={() => {
                                    setCiclos(prev => {
                                      const novo = { ...prev };
                                      delete novo[mesKey];
                                      return novo;
                                    });
                                  }}
                                >
                                  Remover Exceção
                                </Button>
                              )}
                            </Box>
                          );
                        })}
                      </Box>
                    </Box>
                  </Box>}

                </Box>
              </ErrorBoundary>
            )}
          </Container>
        </Box>
      </Box>
    </ThemeProvider>
  );
}

export default App;
