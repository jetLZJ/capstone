import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ToastContainer } from 'react-toastify';
import App from './App.jsx';

// Import styles
import './index.css';
import './App.css';
import 'react-toastify/dist/ReactToastify.css';

// Import the tailwind utility to ensure dynamic classes are included
import './utils/tailwindUtils';

// Create a client for React Query
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 5 * 60 * 1000, // 5 minutes
    },
  },
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
      <ToastContainer position="bottom-right" />
    </QueryClientProvider>
  </React.StrictMode>,
);