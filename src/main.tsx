import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { MockDatabase } from './services/mockData.ts'

// Migrar/resetear caché de datos mock si la versión es obsoleta (borra permisos desactualizados)
MockDatabase.checkAndMigrateCache();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
