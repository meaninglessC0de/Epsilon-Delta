import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import 'katex/dist/katex.min.css'
import './index.css'
import { DevelopmentProgressProvider } from './lib/developmentProgressToast'
import { ThemeProvider } from './lib/theme'
import App from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <DevelopmentProgressProvider>
        <App />
      </DevelopmentProgressProvider>
    </ThemeProvider>
  </StrictMode>,
)
