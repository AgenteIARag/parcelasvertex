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
  Tooltip
} from '@mui/material';
import StorageIcon from '@mui/icons-material/Storage';
import LightModeIcon from '@mui/icons-material/LightMode';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import AssessmentIcon from '@mui/icons-material/Assessment';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import PeopleIcon from '@mui/icons-material/People';
import DashboardIcon from '@mui/icons-material/Dashboard';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';

import { type RegraMaster, type LancamentoVenda, type Vendedor, type Usuario } from './types';
import { INITIAL_REGRAS, INITIAL_VENDAS, INITIAL_VENDEDORES, calcularTotaisLinha } from './data/initialData';
import { KPISection } from './components/KPISection';
import { SimuladorVendas } from './components/SimuladorVendas';
import { RegrasMaster } from './components/RegrasMaster';
import { AnalyticsCharts } from './components/AnalyticsCharts';
import { VendedoresCadastro } from './components/VendedoresCadastro';
import { Login } from './components/Login';
import { UsuariosCadastro } from './components/UsuariosCadastro';
import { ErrorBoundary } from './components/ErrorBoundary';
import {
  obterVendedoresSupabase,
  obterRegrasSupabase,
  obterVendasSupabase,
  salvarVendedorSupabase,
  excluirVendedorSupabase,
  salvarRegraSupabase,
  excluirRegraSupabase,
  salvarVendaSupabase,
  excluirVendaSupabase,
  inicializarUsuarioMaster
} from './utils/supabase';
import CloudQueueIcon from '@mui/icons-material/CloudQueue';
import CloudDoneIcon from '@mui/icons-material/CloudDone';
import CloudOffIcon from '@mui/icons-material/CloudOff';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import LogoutIcon from '@mui/icons-material/Logout';
import SettingsIcon from '@mui/icons-material/Settings';

function App() {
  // Estado do tema (Claro/Escuro) - Padrão escuro por ser premium e financeiro
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    const saved = localStorage.getItem('apex_dark_mode');
    return saved ? saved === 'true' : true;
  });

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
    return saved ? JSON.parse(saved) : INITIAL_VENDAS;
  });

  const [vendedores, setVendedores] = useState<Vendedor[]>(() => {
    const saved = localStorage.getItem('apex_vendedores');
    return saved ? JSON.parse(saved) : INITIAL_VENDEDORES;
  });

  // Estado da Navegação (Aba ativa)
  const [abaAtiva, setAbaAtiva] = useState<'dashboard' | 'vendas' | 'configuracoes'>('dashboard');
  const [subAbaAtiva, setSubAbaAtiva] = useState<'regras' | 'vendedores' | 'acessos'>('regras');

  // Estado de sincronização com o Supabase
  const [statusSincronizacao, setStatusSincronizacao] = useState<'sincronizando' | 'sincronizado' | 'erro'>('sincronizando');

  // Carga inicial do Supabase
  useEffect(() => {
    const carregarDadosSupabase = async () => {
      setStatusSincronizacao('sincronizando');
      try {
        // Inicializa o Master padrão se a tabela de usuários estiver vazia
        await inicializarUsuarioMaster();

        const [vend, reg, vendasData] = await Promise.all([
          obterVendedoresSupabase(),
          obterRegrasSupabase(),
          obterVendasSupabase()
        ]);
        
        if (vend.length > 0) setVendedores(vend);
        if (reg.length > 0) setRegras(reg);
        if (vendasData.length > 0) setVendas(vendasData);
        
        setStatusSincronizacao('sincronizado');
      } catch (err) {
        console.error('Erro ao conectar ao Supabase, mantendo dados locais:', err);
        setStatusSincronizacao('erro');
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
  }, [darkMode]);

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
    setVendas((prev) => [...prev, novaVenda]);
    salvarVendaSupabase(novaVenda).catch((err) => console.error('Erro Supabase Vendas:', err));
  };

  const handleAtualizarVenda = (vendaAtualizada: LancamentoVenda) => {
    setVendas((prev) =>
      prev.map((v) => (v.id === vendaAtualizada.id ? vendaAtualizada : v))
    );
    salvarVendaSupabase(vendaAtualizada).catch((err) => console.error('Erro Supabase Vendas (Edição):', err));
  };

  const handleExcluirVenda = (id: string) => {
    setVendas((prev) => prev.filter((v) => v.id !== id));
    excluirVendaSupabase(id).catch((err) => console.error('Erro Supabase Vendas (Exclusão):', err));
  };

  // Ações de Vendedores
  const handleAdicionarVendedor = (novoVendedor: Vendedor) => {
    setVendedores((prev) => [...prev, novoVendedor]);
    salvarVendedorSupabase(novoVendedor).catch((err) => console.error('Erro Supabase Vendedores:', err));
  };

  const handleEditarVendedor = (vendedorAtualizado: Vendedor) => {
    setVendedores((prev) =>
      prev.map((v) => (v.id === vendedorAtualizado.id ? vendedorAtualizado : v))
    );
    salvarVendedorSupabase(vendedorAtualizado).catch((err) => console.error('Erro Supabase Vendedores (Edição):', err));
  };

  const handleExcluirVendedor = (id: string) => {
    setVendedores((prev) => prev.filter((v) => v.id !== id));
    excluirVendedorSupabase(id).catch((err) => console.error('Erro Supabase Vendedores (Exclusão):', err));
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
            width: 280,
            flexShrink: 0,
            borderRight: `1px solid ${theme.palette.mode === 'dark' ? '#1f2937' : '#e5e7eb'}`,
            bgcolor: theme.palette.mode === 'dark' ? '#111827' : '#ffffff',
            display: 'flex',
            flexDirection: 'column',
            position: 'fixed',
            top: 0,
            bottom: 0,
            left: 0,
            zIndex: 1200
          }}
        >
          {/* Logo */}
          <Box sx={{ p: 3, display: 'flex', alignItems: 'center', gap: 1.5, borderBottom: `1px solid ${theme.palette.mode === 'dark' ? '#1f2937' : '#e5e7eb'}` }}>
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
          </Box>

          {/* Menu de Navegação da Sidebar */}
          <Box sx={{ flexGrow: 1, px: 2, py: 3, display: 'flex', flexDirection: 'column', gap: 1 }}>
            <Button
              variant={abaAtiva === 'dashboard' ? 'contained' : 'text'}
              startIcon={<DashboardIcon />}
              onClick={() => setAbaAtiva('dashboard')}
              fullWidth
              sx={{
                justifyContent: 'flex-start',
                py: 1.25,
                px: 2,
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
              Dashboard
            </Button>

            <Button
              variant={abaAtiva === 'vendas' ? 'contained' : 'text'}
              startIcon={<ReceiptLongIcon />}
              onClick={() => setAbaAtiva('vendas')}
              fullWidth
              sx={{
                justifyContent: 'flex-start',
                py: 1.25,
                px: 2,
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
              Painel de Vendas
            </Button>

            {(usuarioLogado?.role === 'master' || usuarioLogado?.role === 'editor') && (
              <Button
                variant={abaAtiva === 'configuracoes' ? 'contained' : 'text'}
                startIcon={<SettingsIcon />}
                onClick={() => {
                  setAbaAtiva('configuracoes');
                  setSubAbaAtiva('regras');
                }}
                fullWidth
                sx={{
                  justifyContent: 'flex-start',
                  py: 1.25,
                  px: 2,
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
                Configurações
              </Button>
            )}
          </Box>

          {/* Rodapé da Sidebar - Configurações e Perfil do Usuário */}
          <Box sx={{ p: 2, borderTop: `1px solid ${theme.palette.mode === 'dark' ? '#1f2937' : '#e5e7eb'}` }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2, px: 1 }}>
              <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, fontSize: '0.72rem' }}>
                Modo {darkMode ? 'Escuro' : 'Claro'}
              </Typography>
              <IconButton onClick={() => setDarkMode(!darkMode)} size="small" sx={{ bgcolor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)' }}>
                {darkMode ? <LightModeIcon sx={{ fontSize: 16 }} /> : <DarkModeIcon sx={{ fontSize: 16 }} />}
              </IconButton>
            </Box>

            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                bgcolor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)',
                p: 1.5,
                borderRadius: 2.5
              }}
            >
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
            </Box>
          </Box>
        </Box>

        {/* Área de Conteúdo Principal (Direita) */}
        <Box sx={{ flexGrow: 1, ml: '280px', minWidth: 0, display: 'flex', flexDirection: 'column', pb: 6 }}>
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
              {abaAtiva === 'vendas' && 'Painel de Vendas / Simulador'}
              {abaAtiva === 'configuracoes' && 'Configurações Administrativas'}
            </Typography>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
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
          <Container maxWidth="xl" sx={{ mt: 4 }}>
            {/* Renderização Condicional de Conteúdo */}
            {abaAtiva === 'dashboard' && (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {/* KPI Section */}
                <KPISection vendas={vendas} />
                
                {/* Gráficos Analíticos */}
                <AnalyticsCharts vendas={vendas} />
              </Box>
            )}

            {abaAtiva === 'vendas' && (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {/* Tabela Timeline Principal */}
                <SimuladorVendas
                  vendas={vendas}
                  regras={regras}
                  vendedores={vendedores}
                  onAdicionarVenda={handleAdicionarVenda}
                  onAtualizarVenda={handleAtualizarVenda}
                  onExcluirVenda={handleExcluirVenda}
                  permissoes={usuarioLogado?.permissoes || { visualizar: true, editarVendas: false, cadastrarVendedores: false, cadastrarRegras: false }}
                />
              </Box>
            )}

            {abaAtiva === 'configuracoes' && (usuarioLogado?.role === 'master' || usuarioLogado?.role === 'editor') && (
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
                      <Tab value="vendedores" icon={<PeopleIcon sx={{ fontSize: 18 }} />} iconPosition="start" label="Vendedores" />
                      {usuarioLogado?.role === 'master' && (
                        <Tab value="acessos" icon={<AdminPanelSettingsIcon sx={{ fontSize: 18 }} />} iconPosition="start" label="Gestão de Acessos" />
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
                    />
                  )}

                  {subAbaAtiva === 'vendedores' && (
                    <VendedoresCadastro
                      vendedores={vendedores}
                      onAdicionarVendedor={handleAdicionarVendedor}
                      onEditarVendedor={handleEditarVendedor}
                      onExcluirVendedor={handleExcluirVendedor}
                      permissoes={usuarioLogado?.permissoes || { visualizar: true, editarVendas: false, cadastrarVendedores: false, cadastrarRegras: false }}
                    />
                  )}

                  {subAbaAtiva === 'acessos' && usuarioLogado?.role === 'master' && (
                    <UsuariosCadastro />
                  )}
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
