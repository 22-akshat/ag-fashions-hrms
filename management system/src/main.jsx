import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.jsx'
import { EmployeesProvider } from '@/module1/employees/context/EmployeesContext.jsx'
import { ToastProvider } from '@/components/ui/toast.jsx'
import { Toaster } from '@/components/ui/toaster.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ToastProvider>
      <EmployeesProvider>
        <BrowserRouter>
          <App />
          <Toaster />
        </BrowserRouter>
      </EmployeesProvider>
    </ToastProvider>
  </StrictMode>,
)
