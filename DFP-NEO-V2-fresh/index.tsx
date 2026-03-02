console.log('Starting app initialization...');

import React from 'react';
console.log('React imported');

import ReactDOM from 'react-dom/client';
console.log('ReactDOM imported');

// FIX: Use default import for App component as it is exported as a default.
import App from './App';
console.log('App imported');

const rootElement = document.getElementById('root');
console.log('Root element:', rootElement);

if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);

// Add error boundary
class ErrorBoundary extends React.Component<{children: React.ReactNode}, {hasError: boolean, error: any}> {
  constructor(props: {children: React.ReactNode}) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error('Error caught by boundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{padding: '20px', color: 'white', backgroundColor: '#1f2937'}}>
          <h1>Something went wrong.</h1>
          <pre style={{color: '#ef4444', whiteSpace: 'pre-wrap'}}>
            {this.state.error?.toString()}
          </pre>
          <button onClick={() => window.location.reload()} style={{marginTop: '10px', padding: '10px', cursor: 'pointer'}}>
            Reload Page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);