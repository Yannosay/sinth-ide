import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { invoke } from '@tauri-apps/api/core'
import { useWorkspaceStore, type FileNode } from './workspace'
import { useSettingsStore } from './settings'

export type ActionKind = 'run' | 'build' | 'preview' | 'check' | 'deploy' | 'test' | 'clean'

export interface ProjectAction {
  id: string
  label: string
  kind: ActionKind
  /** Arguments after the program, e.g. ['dev']. */
  args: string[]
  /** 'sinth' runs the resolved Sinth compiler; anything else is a program on PATH. */
  program: string
}

export interface ResolvedCompiler {
  source: 'project' | 'managed' | 'global' | null
  entry: string | null
  version: string | null
  node: string | null
}

type ProjectKind = 'sinth' | 'node' | 'rust' | 'python' | 'go' | null

const isWindows = navigator.userAgent.includes('Windows')

function joinPath(base: string, name: string): string {
  const sep = base.includes('\\') ? '\\' : '/'
  return base.replace(/[\\/]+$/, '') + sep + name
}

async function readText(path: string): Promise<string | null> {
  try { return await invoke<string>('read_text_file', { path }) } catch { return null }
}

async function listDir(path: string): Promise<FileNode[]> {
  try { return await invoke<FileNode[]>('read_directory', { path }) } catch { return [] }
}

/** Quotes one argument for the shell the integrated terminal runs. */
export function quoteArg(arg: string, shell: string): string {
  if (/^[\w+:./\\-]+$/.test(arg)) return arg
  const s = shell.toLowerCase()
  if (isWindows && (s.includes('cmd') || s.endsWith('.bat'))) return `"${arg.replace(/"/g, '""')}"`
  if (isWindows && !s.includes('bash') && !s.includes('sh.exe')) return `'${arg.replace(/'/g, "''")}'`
  return `'${arg.replace(/'/g, `'\\''`)}'`
}

export const useProjectStore = defineStore('project', () => {
  const workspace = useWorkspaceStore()
  const settings = useSettingsStore()

  const kind = ref<ProjectKind>(null)
  const actions = ref<ProjectAction[]>([])
  const compiler = ref<ResolvedCompiler | null>(null)
  const detecting = ref(false)
  let generation = 0

  const isSinth = computed(() => kind.value === 'sinth')
  const nodeMissing = computed(() => !!compiler.value && !compiler.value.node && (kind.value === 'sinth' || kind.value === 'node'))

  async function refreshCompiler(): Promise<void> {
    const root = workspace.rootPath
    if (!root) { compiler.value = null; return }
    try { compiler.value = await invoke<ResolvedCompiler>('resolve_sinth', { root }) } catch { compiler.value = null }
  }

  async function detect(): Promise<void> {
    const root = workspace.rootPath
    const gen = ++generation
    if (!root) { kind.value = null; actions.value = []; compiler.value = null; return }
    detecting.value = true
    try {
      const [pkgRaw, configRaw, top] = await Promise.all([readText(joinPath(root, 'package.json')), readText(joinPath(root, 'sinth.config.json')), listDir(root)])
      let pkg: { scripts?: Record<string, string>; packageManager?: string; dependencies?: Record<string, string>; devDependencies?: Record<string, string> } | null = null
      if (pkgRaw) { try { pkg = JSON.parse(pkgRaw) } catch { pkg = null } }
      const hasSinthFiles = top.some(n => !n.isDirectory && n.name.endsWith('.sinth')) ||
        (top.some(n => n.isDirectory && n.name === 'pages') && (await listDir(joinPath(root, 'pages'))).some(n => n.name.endsWith('.sinth') || n.isDirectory))
      const usesSinth = configRaw !== null || hasSinthFiles || !!pkg?.dependencies?.['@yannosay/sinth'] || !!pkg?.devDependencies?.['@yannosay/sinth']
      const next: ProjectAction[] = []
      let nextKind: ProjectKind = null
      if (usesSinth) {
        nextKind = 'sinth'
        next.push(
          { id: 'dev', label: 'Run', kind: 'run', program: 'sinth', args: ['dev'] },
          { id: 'build', label: 'Build', kind: 'build', program: 'sinth', args: ['build'] },
          { id: 'preview', label: 'Preview', kind: 'preview', program: 'sinth', args: ['preview'] },
          { id: 'check', label: 'Check', kind: 'check', program: 'sinth', args: ['check'] },
          { id: 'deploy', label: 'Deploy', kind: 'deploy', program: 'sinth', args: ['deploy'] },
        )
      } else if (pkg) {
        nextKind = 'node'
        let pm = (pkg.packageManager ?? '').split('@')[0]
        if (!pm) pm = top.some(n => n.name === 'pnpm-lock.yaml') ? 'pnpm' : top.some(n => n.name === 'yarn.lock') ? 'yarn' : 'npm'
        const scripts = pkg.scripts ?? {}
        const map: Array<[string, string, ActionKind]> = [['dev', 'Run', 'run'], ['start', 'Start', 'run'], ['build', 'Build', 'build'], ['preview', 'Preview', 'preview'], ['test', 'Test', 'test']]
        for (const [key, label, k] of map) if (scripts[key]) next.push({ id: key, label, kind: k, program: pm, args: pm === 'npm' ? ['run', key] : [key] })
      } else if (top.some(n => n.name === 'Cargo.toml')) {
        nextKind = 'rust'
        next.push({ id: 'run', label: 'Run', kind: 'run', program: 'cargo', args: ['run'] }, { id: 'build', label: 'Build', kind: 'build', program: 'cargo', args: ['build'] }, { id: 'test', label: 'Test', kind: 'test', program: 'cargo', args: ['test'] })
      } else if (top.some(n => n.name === 'go.mod')) {
        nextKind = 'go'
        next.push({ id: 'run', label: 'Run', kind: 'run', program: 'go', args: ['run', '.'] }, { id: 'test', label: 'Test', kind: 'test', program: 'go', args: ['test', './...'] })
      } else if (top.some(n => n.name === 'pyproject.toml' || n.name === 'requirements.txt')) {
        nextKind = 'python'
        next.push({ id: 'test', label: 'Test', kind: 'test', program: 'python', args: ['-m', 'pytest'] })
      }
      if (gen !== generation) return
      kind.value = nextKind
      actions.value = next
      await refreshCompiler()
    } finally {
      if (gen === generation) detecting.value = false
    }
  }

  /** The command line typed into the terminal for an action. Sinth commands always pass --root, so they work from any directory. */
  function commandLine(action: ProjectAction): string {
    const root = workspace.rootPath ?? ''
    const shell = settings.terminalShell || (isWindows ? 'powershell' : 'sh')
    const q = (a: string): string => quoteArg(a, shell)
    if (action.program === 'sinth') {
      const args = [...action.args, '--root', root].map(q).join(' ')
      const entry = compiler.value?.entry
      if (entry) return `node ${q(entry)} ${args}`
      return `npx --yes ${q('@yannosay/sinth@latest')} ${args}`
    }
    const cd = isWindows && !shell.toLowerCase().includes('cmd') ? `Set-Location -LiteralPath ${q(root)}; ` : isWindows ? `cd /d ${q(root)} && ` : `cd ${q(root)} && `
    return cd + [action.program, ...action.args].map(q).join(' ')
  }

  return { kind, actions, compiler, detecting, isSinth, nodeMissing, detect, refreshCompiler, commandLine }
})
