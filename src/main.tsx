import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { defineCustomElements } from '@esri/calcite-components/loader'

import '@esri/calcite-components/main.css'
import '@arcgis/core/assets/esri/themes/dark/main.css'
import './index.css'

import { App } from './App'

defineCustomElements()

const rootElement = document.querySelector<HTMLElement>('#root')
if (!rootElement) throw new Error('#root element is missing from index.html')

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
