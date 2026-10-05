import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
        proxy: {
          '/api': {
            target: 'http://localhost:3001',
            changeOrigin: true,
            secure: false,
          },
          '/socket.io': {
            target: 'http://localhost:3001',
            ws: true,
            changeOrigin: true,
            secure: false,
          },
        },
      },
      plugins: [react()],
      define: {
        'process.env.DB_PATH': JSON.stringify(env.DB_PATH || './kawayan.db'),
        'process.env.NODE_ENV': JSON.stringify(env.NODE_ENV || 'development'),
        'process.env.JWT_SECRET': JSON.stringify(env.JWT_SECRET || 'default-secret-change-in-production'),
        'process.env.SESSION_TIMEOUT': JSON.stringify(env.SESSION_TIMEOUT || '24h'),
        'process.env.LOG_LEVEL': JSON.stringify(env.LOG_LEVEL || 'info'),
        'process.env.LOG_FILE': JSON.stringify(env.LOG_FILE || './logs/app.log')
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
