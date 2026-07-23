import { cpSync, existsSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), '..')
const sourceRoot = join(projectRoot, 'node_modules', 'cesium', 'Build', 'Cesium')
const destinationRoot = join(projectRoot, 'public', 'cesium')
const runtimeDirectories = ['Assets', 'ThirdParty', 'Widgets', 'Workers']

if (!existsSync(sourceRoot)) {
  throw new Error(`Cesium runtime не найден: ${sourceRoot}. Выполните npm install.`)
}

mkdirSync(destinationRoot, { recursive: true })
for (const directory of runtimeDirectories) {
  cpSync(join(sourceRoot, directory), join(destinationRoot, directory), {
    recursive: true,
    force: true
  })
}

console.log(`Cesium runtime скопирован в ${destinationRoot}`)
