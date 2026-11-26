import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/plus-jakarta-sans'
import './index.css'
import { IconContext } from '@phosphor-icons/react'
import App from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* Filled icons by default, everywhere. */}
    <IconContext.Provider value={{ weight: 'fill', size: '1em', color: 'currentColor', mirrored: false }}>
      <App />
    </IconContext.Provider>
  </StrictMode>,
)
