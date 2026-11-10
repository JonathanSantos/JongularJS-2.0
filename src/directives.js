/**
 * Diretivas `jo-*`.
 *
 * O original guardava as diretivas num objeto (`modules['model']`,
 * `modules['click']`, `modules['init']`) e o laço principal procurava
 * `jo-` + nome no DOM. Essa ideia é um Registry de Strategies e segue igual:
 * a diferença é que o registro agora é público (`jongular.directive`), então
 * uma diretiva nova não exige mexer no núcleo.
 *
 * Cada diretiva recebe um `binding`. Os cinco primeiros campos são os mesmos
 * do objeto que o original montava em `__refreshAll__`:
 *
 *   attribute, element, name, controller, $scope
 *
 * e os demais são as ferramentas novas:
 *
 *   evaluate(locals?)   lê a expressão do atributo
 *   assign(value)       escreve no caminho da expressão
 *   run(locals?)        executa a expressão como ação (clique, init)
 *   effect(fn)          repete `fn` quando o que ela leu mudar
 *   listen(type, fn)    addEventListener, removido no destroy()
 */

const registry = new Map()

/** Registra (ou substitui) a diretiva `jo-<name>`. */
export function directive(name, setup) {
  if (typeof setup !== 'function') throw new TypeError(`A diretiva "${name}" precisa ser uma função`)
  registry.set(name, setup)
}

export function findDirective(name) {
  return registry.get(name)
}

// --- jo-model ---------------------------------------------------------------

const textAdapter = {
  event: 'input',
  read: (element) => element.value,
  write(element, value) {
    const text = value == null ? '' : String(value)
    // Só toca no campo se o valor mudou de verdade: preserva o cursor de quem digita.
    if (element.value !== text) element.value = text
  },
}

const numberAdapter = {
  event: 'input',
  read: (element) => (element.value === '' ? null : Number(element.value)),
  write: textAdapter.write,
}

const checkboxAdapter = {
  event: 'change',
  read: (element) => element.checked,
  write(element, value) {
    element.checked = Boolean(value)
  },
}

const radioAdapter = {
  event: 'change',
  read: (element) => element.value,
  write(element, value) {
    element.checked = String(value) === element.value
  },
}

const selectAdapter = { ...textAdapter, event: 'change' }

const INPUT_ADAPTERS = {
  checkbox: checkboxAdapter,
  radio: radioAdapter,
  number: numberAdapter,
  range: numberAdapter,
}

/** Escolhe como ler e escrever num campo de formulário; `null` para os demais elementos. */
function pickFieldAdapter(element) {
  if (element.localName === 'textarea') return textAdapter
  if (element.localName === 'select') return selectAdapter
  if (element.localName === 'input') return INPUT_ADAPTERS[element.type] ?? textAdapter
  return null
}

function model({ element, expression, evaluate, assign, effect, listen }) {
  const field = pickFieldAdapter(element)
  if (!field) {
    effect(() => {
      const value = evaluate()
      element.textContent = value == null ? '' : String(value)
    })
    return
  }

  effect(() => field.write(element, evaluate()))
  if (expression.isAssignable) listen(field.event, () => assign(field.read(element)))
}

// --- jo-click e jo-init -----------------------------------------------------

function click({ listen, run }) {
  listen('click', (event) => run({ $event: event }))
}

function init({ run }) {
  run()
}

directive('model', model)
directive('click', click)
directive('init', init)
