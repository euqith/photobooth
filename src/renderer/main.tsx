import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; errorMessage: string }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, errorMessage: error?.message || 'Unknown UI error' };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[UI ErrorBoundary]', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="w-screen h-screen bg-gray-950 text-white flex flex-col items-center justify-center p-8 text-center">
          <h1 className="text-3xl font-bold text-rose-500 mb-3">UI Terkendala</h1>
          <p className="text-gray-300 font-mono text-sm mb-6 max-w-lg">{this.state.errorMessage}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-3 bg-pink-600 rounded-xl font-bold text-white"
          >
            Muat Ulang Layar
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
