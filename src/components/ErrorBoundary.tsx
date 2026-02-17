import { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallbackType?: 'global' | 'page';
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary] Erro capturado:', error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.href = '/dashboard';
  };

  render() {
    if (this.state.hasError) {
      const isPage = this.props.fallbackType === 'page';

      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: isPage ? '60vh' : '100vh',
          padding: '2rem',
          background: isPage ? 'transparent' : '#0a0a0a',
          color: '#e5e5e5',
          textAlign: 'center',
          fontFamily: 'system-ui, sans-serif',
        }}>
          <div style={{
            fontSize: '3rem',
            marginBottom: '1rem',
          }}>
            ⚠️
          </div>
          <h2 style={{
            fontSize: '1.25rem',
            fontWeight: 600,
            marginBottom: '0.5rem',
            color: '#f5f5f5',
          }}>
            Algo deu errado
          </h2>
          <p style={{
            fontSize: '0.875rem',
            color: '#a3a3a3',
            marginBottom: '1.5rem',
            maxWidth: '400px',
          }}>
            Ocorreu um erro inesperado. Tente recarregar a página.
          </p>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button
              onClick={this.handleReload}
              style={{
                padding: '0.625rem 1.25rem',
                fontSize: '0.875rem',
                fontWeight: 500,
                backgroundColor: '#22c55e',
                color: '#fff',
                border: 'none',
                borderRadius: '0.5rem',
                cursor: 'pointer',
              }}
            >
              Recarregar
            </button>
            {isPage && (
              <button
                onClick={this.handleGoHome}
                style={{
                  padding: '0.625rem 1.25rem',
                  fontSize: '0.875rem',
                  fontWeight: 500,
                  backgroundColor: 'transparent',
                  color: '#a3a3a3',
                  border: '1px solid #333',
                  borderRadius: '0.5rem',
                  cursor: 'pointer',
                }}
              >
                Voltar ao Dashboard
              </button>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
