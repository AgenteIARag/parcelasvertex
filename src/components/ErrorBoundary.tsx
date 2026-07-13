import { Component, type ReactNode, type ErrorInfo } from 'react';
import { Box, Typography, Button } from '@mui/material';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  errorMessage: string;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, errorMessage: error.message };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('ErrorBoundary capturou um erro:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: 300,
            gap: 2,
            p: 4,
            borderRadius: 3,
            border: '1px solid rgba(239,68,68,0.2)',
            bgcolor: 'rgba(239,68,68,0.05)'
          }}
        >
          <WarningAmberIcon sx={{ fontSize: 48, color: '#ef4444' }} />
          <Typography variant="h6" sx={{ fontWeight: 700, color: '#ef4444', fontFamily: 'Outfit, sans-serif' }}>
            Erro ao carregar esta seção
          </Typography>
          <Typography variant="body2" sx={{ color: '#94a3b8', textAlign: 'center', maxWidth: 400 }}>
            {this.state.errorMessage || 'Ocorreu um erro inesperado. Tente recarregar a página.'}
          </Typography>
          <Button
            variant="outlined"
            color="error"
            onClick={() => this.setState({ hasError: false, errorMessage: '' })}
            sx={{ mt: 1, borderRadius: 2, textTransform: 'none', fontWeight: 600 }}
          >
            Tentar novamente
          </Button>
        </Box>
      );
    }

    return this.props.children;
  }
}
