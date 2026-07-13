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
  AppBar,
  Toolbar,
  Button,
  IconButton,
  Tooltip
} from '@mui/material';
import DashboardCustomizeIcon from '@mui/icons-material/DashboardCustomize';
import StorageIcon from '@mui/icons-material/Storage';
import LightModeIcon from '@mui/icons-material/LightMode';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import AssessmentIcon from '@mui/icons-material/Assessment';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import PeopleIcon from '@mui/icons-material/People';

import { type RegraMaster, type LancamentoVenda, type Vendedor, type Usuario } from './types';
import { INITIAL_REGRAS, INITIAL_VENDAS, INITIAL_VENDEDORES, calcularTotaisLinha } from './data/initialData';
import { KPISection } from './components/KPISection';
import { SimuladorVendas } from './components/SimuladorVendas';
import { RegrasMaster } from './components/RegrasMaster';
import { AnalyticsCharts } from './components/AnalyticsCharts';
import { VendedoresCadastro } from './components/VendedoresCadastro';
import { Login } from './components/Login';
import { UsuariosCadastro } from './components/UsuariosCadastro';
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
  const [abaAtiva, setAbaAtiva] = useState(0);
  const [subAbaAtiva, setSubAbaAtiva] = useState(0);

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
      
      {/* Top Header / AppBar */}
      <AppBar
        position="sticky"
        elevation={0}
        sx={{
          background: theme.palette.mode === 'dark' ? 'rgba(17, 24, 39, 0.8)' : 'rgba(255, 255, 255, 0.8)',
          backdropFilter: 'blur(12px)',
          borderBottom: `1px solid ${theme.palette.mode === 'dark' ? '#1f2937' : '#e5e7eb'}`,
          zIndex: 1100
        }}
      >
        <Container maxWidth="xl">
          <Toolbar disableGutters sx={{ display: 'flex', justifyContent: 'space-between' }}>
            {/* Logo */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Box
                sx={{
                  p: 1,
                  borderRadius: 2.5,
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

            {/* Controles de Ação de Topo */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
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
                  py: 0.75,
                  px: 1.5,
                  '&:hover': {
                    borderColor: theme.palette.primary.main,
                    color: theme.palette.primary.main
                  }
                }}
              >
                Backup dos Dados
              </Button>
              
              <Tooltip title={darkMode ? 'Modo Claro' : 'Modo Escuro'}>
                <IconButton
                  onClick={() => setDarkMode(!darkMode)}
                  sx={{
                    bgcolor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)',
                    color: theme.palette.mode === 'dark' ? '#f3f4f6' : '#0f172a',
                    '&:hover': {
                      bgcolor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'
                    }
                  }}
                >
                  {darkMode ? <LightModeIcon /> : <DarkModeIcon />}
                </IconButton>
              </Tooltip>
              {/* Informações do Usuário Logado */}
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                  borderLeft: `1px solid ${theme.palette.mode === 'dark' ? '#374151' : '#d1d5db'}`,
                  pl: 2,
                  ml: 0.5
                }}
              >
                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                  <Typography variant="body2" sx={{ fontWeight: 700, color: 'text.primary', fontSize: '0.85rem' }}>
                    {usuarioLogado.nome}
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.7rem', fontWeight: 600 }}>
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
                      '&:hover': {
                        bgcolor: 'rgba(239, 68, 68, 0.15)'
                      }
                    }}
                  >
                    <LogoutIcon sx={{ fontSize: 16 }} />
                  </IconButton>
                </Tooltip>
              </Box>
            </Box>
          </Toolbar>
        </Container>
      </AppBar>

      {/* Main Container */}
      <Container maxWidth="xl" sx={{ mt: 4, pb: 6 }}>
        {/* KPI Section */}
        <KPISection vendas={vendas} />

        {/* Navegação por Abas */}
        <Box
          sx={{
            borderBottom: 1,
            borderColor: theme.palette.mode === 'dark' ? '#1f2937' : '#e5e7eb',
            mb: 4,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}
        >
          <Tabs
            value={abaAtiva}
            onChange={(_, val) => {
              setAbaAtiva(val);
              // Ao mudar a aba principal, reseta para a primeira sub-aba
              if (val === 1) setSubAbaAtiva(0);
            }}
            textColor="primary"
            indicatorColor="primary"
            sx={{
              '& .MuiTab-root': {
                fontFamily: 'Outfit, sans-serif',
                fontWeight: 600,
                fontSize: '1rem',
                textTransform: 'none',
                minWidth: 160,
                pb: 1.5
              }
            }}
          >
            <Tab icon={<DashboardCustomizeIcon />} iconPosition="start" label="Simulador & Timeline" />
            {(usuarioLogado.role === 'master' || usuarioLogado.role === 'editor') && (
              <Tab icon={<SettingsIcon />} iconPosition="start" label="Configurações" />
            )}
          </Tabs>
        </Box>

        {/* Aba 0: Simulador, Timeline e Gráficos */}
        {abaAtiva === 0 && (
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

            {/* Gráficos Analíticos */}
            <AnalyticsCharts vendas={vendas} />
          </Box>
        )}

        {/* Aba 1: Painel de Configurações Administrativas */}
        {abaAtiva === 1 && (usuarioLogado.role === 'master' || usuarioLogado.role === 'editor') && (
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
                <Tab icon={<StorageIcon sx={{ fontSize: 18 }} />} iconPosition="start" label="Banco de Regras (BD Master)" />
                <Tab icon={<PeopleIcon sx={{ fontSize: 18 }} />} iconPosition="start" label="Vendedores" />
                {usuarioLogado.role === 'master' && (
                  <Tab icon={<AdminPanelSettingsIcon sx={{ fontSize: 18 }} />} iconPosition="start" label="Gestão de Acessos" />
                )}
              </Tabs>
            </Box>

            {/* Renderização das Sub-Abas */}
            {subAbaAtiva === 0 && (
              <RegrasMaster
                regras={regras}
                onAdicionarRegra={handleAdicionarRegra}
                onEditarRegra={handleEditarRegra}
                onExcluirRegra={handleExcluirRegra}
                permissoes={usuarioLogado?.permissoes || { visualizar: true, editarVendas: false, cadastrarVendedores: false, cadastrarRegras: false }}
              />
            )}

            {subAbaAtiva === 1 && (
              <VendedoresCadastro
                vendedores={vendedores}
                onAdicionarVendedor={handleAdicionarVendedor}
                onExcluirVendedor={handleExcluirVendedor}
                permissoes={usuarioLogado?.permissoes || { visualizar: true, editarVendas: false, cadastrarVendedores: false, cadastrarRegras: false }}
              />
            )}

            {subAbaAtiva === 2 && usuarioLogado?.role === 'master' && (
              <UsuariosCadastro />
            )}
          </Box>
        )}
      </Container>
    </ThemeProvider>
  );
}

export default App;
