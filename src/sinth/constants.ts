export const SINTH_LANGUAGE_ID = 'sinth'

export interface ElementDoc {
  name: string
  tag: string
  note?: string
}

const el = (name: string, tag: string, note?: string): ElementDoc => ({ name, tag, note })

export const SINTH_ELEMENTS: readonly ElementDoc[] = [
  el('Main', 'main'), el('Header', 'header'), el('Footer', 'footer'), el('Nav', 'nav'), el('Section', 'section'),
  el('Article', 'article'), el('Aside', 'aside'), el('Div', 'div'), el('Span', 'span'),
  el('Hero', 'section', 'class "hero"'), el('Container', 'div', 'class "container"'), el('Grid', 'div', 'class "grid"'),
  el('Flex', 'div', 'class "flex"'), el('Stack', 'div', 'class "stack"'), el('Row', 'div', 'class "row"'),
  el('Column', 'div', 'class "col"'), el('CardGrid', 'div', 'class "card-grid"'),
  el('Heading', 'h1-h6', 'set level: 1..6'), el('H1', 'h1'), el('H2', 'h2'), el('H3', 'h3'), el('H4', 'h4'), el('H5', 'h5'), el('H6', 'h6'),
  el('Paragraph', 'p'), el('Lead', 'p', 'class "lead"'), el('SubHeading', 'p', 'class "subheading"'), el('Small', 'small'),
  el('Strong', 'strong'), el('Em', 'em'), el('Code', 'code'), el('Pre', 'pre'), el('Blockquote', 'blockquote'),
  el('Quote', 'q'), el('Mark', 'mark'), el('Label', 'label'), el('Abbr', 'abbr'), el('Time', 'time'), el('Kbd', 'kbd'),
  el('Sub', 'sub'), el('Sup', 'sup'), el('Address', 'address'),
  el('Button', 'button', 'type="button" by default'), el('SubmitButton', 'button', 'type="submit"'), el('Link', 'a'),
  el('NavLink', 'a', 'class "nav-link"'), el('Form', 'form'), el('Input', 'input'), el('Textarea', 'textarea'),
  el('Select', 'select'), el('Option', 'option'), el('Optgroup', 'optgroup'), el('Checkbox', 'input', 'type="checkbox"'),
  el('Radio', 'input', 'type="radio"'), el('Fieldset', 'fieldset'), el('Legend', 'legend'), el('Datalist', 'datalist'),
  el('Details', 'details'), el('Summary', 'summary'), el('Dialog', 'dialog'), el('Progress', 'progress'), el('Meter', 'meter'),
  el('Output', 'output'),
  el('Img', 'img'), el('Image', 'img'), el('Picture', 'picture'), el('Source', 'source'), el('Video', 'video'),
  el('Audio', 'audio'), el('Figure', 'figure'), el('Figcaption', 'figcaption'), el('Canvas', 'canvas'), el('IFrame', 'iframe'),
  el('Svg', 'svg'), el('Path', 'path'), el('Circle', 'circle'), el('Rect', 'rect'),
  el('Ul', 'ul'), el('Ol', 'ol'), el('Li', 'li'), el('List', 'ul'), el('ListItem', 'li'), el('Dl', 'dl'), el('Dt', 'dt'), el('Dd', 'dd'),
  el('Table', 'table'), el('Thead', 'thead'), el('Tbody', 'tbody'), el('Tfoot', 'tfoot'), el('Tr', 'tr'), el('Th', 'th'), el('Td', 'td'),
  el('Caption', 'caption'), el('Hr', 'hr'), el('Br', 'br'), el('Template', 'template'), el('NoScript', 'noscript'),
  el('Fragment', '(none)', 'groups children without a wrapper'), el('RawHTML', '(raw)', 'renders trusted HTML from content:'),
]

export const SINTH_UI_COMPONENTS: Readonly<Record<string, string>> = {
  Button: 'Button(variant: "primary" | "secondary" | "ghost" | "danger", size: "sm" | "md" | "lg", href?, disabled, block)',
  Card: 'Card(title?, subtitle?, interactive) with slot(name: "footer")',
  Badge: 'Badge(tone: "neutral" | "accent" | "success" | "warning" | "danger")',
  Alert: 'Alert(tone: "info" | "success" | "warning" | "danger", title?)',
  Content: 'Content(width: "sm" | "md" | "lg" | "full")',
  Columns: 'Columns(min: "16rem", gap: "1rem")',
  Inline: 'Inline(gap, align, justify, wrap)',
  VStack: 'VStack(gap, align)',
  Field: 'Field(label, value (bind), type, placeholder, hint?, error?, required)',
  Toggle: 'Toggle(checked (bind), label?)',
  Modal: 'Modal(open (bind), title?, width)',
  Avatar: 'Avatar(name, src?, size)',
  Spinner: 'Spinner(size, label)',
  Navbar: 'Navbar(brand?, brandHref) with links as children',
  Divider: 'Divider(label?)',
}

export const SINTH_TYPES: readonly string[] = ['str', 'num', 'bool', 'obj', 'ui', 'any', 'void', 'fn', 'int']

export const SINTH_KEYWORDS: readonly string[] = [
  'import', 'from', 'as', 'extern', 'export', 'private', 'component', 'function', 'async', 'await', 'var', 'const',
  'computed', 'persist', 'bind', 'if', 'elif', 'else', 'for', 'in', 'key', 'while', 'return', 'break', 'continue', 'watch',
  'onMount', 'onDestroy', 'style', 'script', 'global', 'lang', 'and', 'or', 'not', 'new', 'typeof', 'custom-element',
]

export const SINTH_CONSTANTS: readonly string[] = ['true', 'false', 'null', 'undefined']

export const SINTH_META_KEYS: Readonly<Record<string, string>> = {
  title: 'Page title (<title> and og:title)',
  descr: 'Meta description (also og:description)',
  fav: 'Favicon path, resolved from public/ or assets/',
  lang: 'Document language, default "en"',
  author: 'Meta author', keywords: 'Meta keywords', robots: 'Meta robots, e.g. "noindex"',
  themeColor: 'Browser theme color', canonical: 'Canonical URL', ogImage: 'Social preview image',
  bodyClass: 'Class added to <body>', viewport: 'Viewport meta, has a sensible default',
  paths: 'Dynamic routes only (pages/blog/[slug].sinth): the values to generate, e.g. paths = posts.map((p) => p.slug)',
}

export const SINTH_DIRECTIVES: Readonly<Record<string, string>> = {
  model: 'Two-way binding to a variable',
  bind: 'Two-way binding (alias of model)',
  value: 'One-way value',
  ref: 'Stores the DOM element in a variable',
  hide: 'Hides the element while the expression is true',
  show: 'Shows the element only while the expression is true',
  html: 'Renders trusted HTML (unescaped)',
  delay: 'Shows the element after N milliseconds',
  class: 'String, list or { name: condition } object',
  style: 'CSS string or { camelCaseProperty: value } object',
  level: 'Heading level 1-6',
}

export const SINTH_EVENTS: readonly string[] = [
  'onClick', 'onDoubleClick', 'onInput', 'onChange', 'onSubmit', 'onKeyDown', 'onKeyUp', 'onFocus', 'onBlur',
  'onMouseEnter', 'onMouseLeave', 'onMouseMove', 'onScroll', 'onPointerDown', 'onPointerUp', 'onWheel', 'onLoad', 'onError',
]

export const SINTH_EVENT_MODIFIERS: readonly string[] = [
  'prevent', 'stop', 'once', 'self', 'capture', 'passive', 'enter', 'esc', 'space', 'tab', 'up', 'down', 'left', 'right', 'ctrl', 'shift', 'alt', 'meta',
]
