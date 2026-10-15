import '@fontsource/inter/400.css'
import '@fontsource/inter/600.css'
import '@fontsource/courier-prime/400.css'
import '@fontsource/courier-prime/700.css'
import './tokens.css'
import './styles.css'
import './features.css'
import './storyboard.css'
import './lightmap.css'
import { createRoot } from 'react-dom/client'
import { App } from './App'

createRoot(document.getElementById('root') as HTMLElement).render(<App />)
