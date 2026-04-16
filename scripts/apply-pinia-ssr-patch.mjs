/**
 * Pinia 3.0.x: shouldHydrate() uses obj.hasOwnProperty(), which throws on
 * Object.create(null) (still treated as plain object). Nuxt SSR payload then crashes.
 * Upstream-safe fix: Object.prototype.hasOwnProperty.call(obj, …).
 * Runs after npm install (see package.json postinstall).
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const distDir = path.join(__dirname, '..', 'node_modules', 'pinia', 'dist')

const READABLE =
  'return !isPlainObject(obj) || !obj.hasOwnProperty(skipHydrateSymbol);'
const READABLE_FIX =
  'return !isPlainObject(obj) || !Object.prototype.hasOwnProperty.call(obj, skipHydrateSymbol);'

const IIFE_LINE =
  '      return !isPlainObject(obj) || !obj.hasOwnProperty(skipHydrateSymbol);'
const IIFE_LINE_FIX =
  '      return !isPlainObject(obj) || !Object.prototype.hasOwnProperty.call(obj, skipHydrateSymbol);'

/** pinia.iife.prod.js — minified shouldHydrate */
const IIFE_PROD = 'function d(t){return!c(t)||!t.hasOwnProperty(y)}'
const IIFE_PROD_FIX = 'function d(t){return!c(t)||!Object.prototype.hasOwnProperty.call(t,y)}'

const patches = [
  { names: ['pinia.mjs', 'pinia.cjs', 'pinia.prod.cjs', 'pinia.esm-browser.js'], from: READABLE, to: READABLE_FIX },
  { names: ['pinia.iife.js'], from: IIFE_LINE, to: IIFE_LINE_FIX },
  { names: ['pinia.iife.prod.js'], from: IIFE_PROD, to: IIFE_PROD_FIX },
]

if (!fs.existsSync(distDir)) {
  process.exit(0)
}

let changed = 0
for (const { names, from, to } of patches) {
  for (const name of names) {
    const filePath = path.join(distDir, name)
    if (!fs.existsSync(filePath)) continue
    let src = fs.readFileSync(filePath, 'utf8')
    if (src.includes(to)) continue
    if (!src.includes(from)) continue
    src = src.split(from).join(to)
    fs.writeFileSync(filePath, src, 'utf8')
    changed += 1
    console.log(`[apply-pinia-ssr-patch] ${name}`)
  }
}

if (changed === 0) {
  console.log('[apply-pinia-ssr-patch] nothing to change (already patched or pinia missing)')
}
