import sinthLogo from '@/assets/sinth-logo.png'

// File type icons from Material Icon Theme (MIT, see assets/file-icons/LICENSE.material-icon-theme.txt).
const svgs = import.meta.glob('../assets/file-icons/*.svg', { eager: true, query: '?url', import: 'default' }) as Record<string, string>

const icons: Record<string, string> = {}
for (const [path, url] of Object.entries(svgs)) icons[path.slice(path.lastIndexOf('/') + 1, -4)] = url

const SINTH = 'sinth'

const BY_NAME: Record<string, string> = {
  'package.json': 'npm', 'package-lock.json': 'npm', '.npmrc': 'npm',
  'pnpm-lock.yaml': 'pnpm', 'pnpm-workspace.yaml': 'pnpm', 'yarn.lock': 'yarn',
  'cargo.lock': 'lock', 'cargo.toml': 'rust',
  '.gitignore': 'git', '.gitattributes': 'git', '.gitmodules': 'git',
  'dockerfile': 'docker', '.dockerignore': 'docker',
  'tauri.conf.json': 'tauri', 'sinth.config.json': SINTH,
  'wrangler.toml': 'settings', '.editorconfig': 'settings',
}

const BY_PREFIX: Array<[RegExp, string]> = [
  [/^tsconfig.*\.json$/, 'tsconfig'],
  [/^readme(\.|$)/, 'readme'],
  [/^(license|licence|copying)(\.|$)/, 'certificate'],
  [/^vite\.config\./, 'vite'],
  [/^(\.eslintrc|eslint\.config\.)/, 'eslint'],
  [/^(\.prettierrc|prettier\.config\.)/, 'prettier'],
  [/^\.env(\.|$)/, 'tune'],
]

const BY_EXT: Record<string, string> = {
  sinth: SINTH,
  ts: 'typescript', mts: 'typescript', cts: 'typescript', tsx: 'react_ts', jsx: 'react',
  js: 'javascript', mjs: 'javascript', cjs: 'javascript', vue: 'vue',
  json: 'json', jsonc: 'json', json5: 'json', map: 'json',
  css: 'css', scss: 'sass', sass: 'sass', less: 'css',
  html: 'html', htm: 'html', md: 'markdown', mdx: 'markdown',
  rs: 'rust', toml: 'toml', yml: 'yaml', yaml: 'yaml', xml: 'xml', plist: 'xml',
  png: 'image', jpg: 'image', jpeg: 'image', gif: 'image', webp: 'image', avif: 'image', ico: 'image', bmp: 'image', icns: 'image',
  svg: 'svg', pdf: 'pdf', woff: 'font', woff2: 'font', ttf: 'font', otf: 'font', eot: 'font',
  zip: 'zip', gz: 'zip', tgz: 'zip', tar: 'zip', '7z': 'zip', rar: 'zip', vsix: 'zip',
  py: 'python', go: 'go', java: 'java', c: 'c', h: 'c', cpp: 'cpp', cc: 'cpp', hpp: 'cpp', cs: 'csharp',
  php: 'php', rb: 'ruby', kt: 'kotlin', kts: 'kotlin', swift: 'swift', lua: 'lua',
  sh: 'console', bash: 'console', zsh: 'console', bat: 'console', cmd: 'console', ps1: 'powershell', psm1: 'powershell',
  sql: 'database', db: 'database', sqlite: 'database', log: 'log', lock: 'lock',
  txt: 'document', ini: 'settings', cfg: 'settings', conf: 'settings',
}

const FOLDERS: Record<string, string> = {
  src: 'folder-src', source: 'folder-src',
  components: 'folder-components', widgets: 'folder-components',
  public: 'folder-public', static: 'folder-public',
  node_modules: 'folder-node', '.git': 'folder-git', '.github': 'folder-github', '.vscode': 'folder-vscode',
  dist: 'folder-dist', build: 'folder-dist', out: 'folder-dist', target: 'folder-dist', '.sinth': 'folder-dist',
  assets: 'folder-images', images: 'folder-images', img: 'folder-images', icons: 'folder-images',
  styles: 'folder-css', css: 'folder-css', scss: 'folder-css',
  lib: 'folder-lib', libs: 'folder-lib', libraries: 'folder-lib', utils: 'folder-lib',
  test: 'folder-test', tests: 'folder-test', __tests__: 'folder-test', spec: 'folder-test',
  content: 'folder-content', posts: 'folder-content', data: 'folder-content',
  pages: 'folder-views', views: 'folder-views', routes: 'folder-views',
  layouts: 'folder-layout', layout: 'folder-layout', resources: 'folder-resource',
}

function resolve(key: string): string {
  return key === SINTH ? sinthLogo : icons[key] ?? icons.file
}

export function fileIconUrl(name: string): string {
  const lower = name.toLowerCase()
  if (BY_NAME[lower]) return resolve(BY_NAME[lower])
  for (const [re, key] of BY_PREFIX) if (re.test(lower)) return resolve(key)
  const dot = lower.lastIndexOf('.')
  if (dot > 0 && BY_EXT[lower.slice(dot + 1)]) return resolve(BY_EXT[lower.slice(dot + 1)])
  return icons.file
}

export function folderIconUrl(name: string, open: boolean): string {
  const key = FOLDERS[name.toLowerCase()] ?? 'folder'
  return icons[open ? `${key}-open` : key] ?? icons[key] ?? icons.folder
}
