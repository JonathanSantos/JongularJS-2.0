/**
 * Injeção de dependências do Jongular.
 *
 * A ideia de 2015 continua: o controller declara o que quer pelo NOME dos
 * parâmetros (`function($scope, $http)`) e o framework entrega. O original
 * lia `fn.toString()` com uma regex e resolvia os nomes com `eval`. Aqui a
 * leitura dos nomes entende arrow functions, async e classes, a resolução é um
 * contêiner com provedores registrados, e existe a notação em array para
 * código minificado, igual à do AngularJS.
 *
 * Este módulo não conhece o DOM.
 */

const COMMENTS = /\/\*[\s\S]*?\*\/|\/\/.*$/gm
const CLASS_CONSTRUCTOR = /\bconstructor\s*\(([^)]*)\)/
const PARENTHESIZED_PARAMETERS = /^[^(=]*\(([^)]*)\)/
const SINGLE_ARROW_PARAMETER = /^(?:async\s+)?([\w$]+)\s*=>/

export class InjectionError extends Error {
  constructor(message) {
    super(message)
    this.name = 'InjectionError'
  }
}

export function isClass(fn) {
  return /^class\b/.test(Function.prototype.toString.call(fn))
}

/** Lê os nomes dos parâmetros de uma função a partir do código-fonte dela. */
export function parameterNames(fn) {
  const source = Function.prototype.toString.call(fn).replace(COMMENTS, '').trim()
  if (isClass(fn)) return splitParameters(CLASS_CONSTRUCTOR.exec(source)?.[1] ?? '')
  const single = SINGLE_ARROW_PARAMETER.exec(source)
  if (single) return [single[1]]
  return splitParameters(PARENTHESIZED_PARAMETERS.exec(source)?.[1] ?? '')
}

function splitParameters(list) {
  return list
    .split(',')
    .map((parameter) => parameter.split('=')[0].trim())
    .filter(Boolean)
}

/**
 * Descobre a função e as dependências de um alvo injetável. Aceita:
 *   function ($scope, $http) {}                 nomes dos parâmetros (2015)
 *   ['$scope', '$http', function (a, b) {}]     array, resiste à minificação
 *   fn.$inject = ['$scope', '$http']            propriedade explícita
 * @returns {{ fn: Function, dependencies: string[] }}
 */
export function annotate(target) {
  if (Array.isArray(target)) {
    const fn = target.at(-1)
    if (typeof fn !== 'function') {
      throw new InjectionError('Na notação em array, o último item precisa ser a função')
    }
    return { fn, dependencies: target.slice(0, -1) }
  }
  if (typeof target !== 'function') {
    throw new InjectionError('Esperava uma função ou um array [dependências..., função]')
  }
  return { fn: target, dependencies: target.$inject ?? parameterNames(target) }
}

/**
 * Contêiner de dependências. Cada provedor é criado na primeira vez em que é
 * pedido e reaproveitado depois (singleton preguiçoso).
 */
export function createInjector() {
  const providers = new Map()
  const instances = new Map()
  const resolving = []

  function get(name, locals, requester) {
    if (locals && Object.hasOwn(locals, name)) return locals[name]
    if (instances.has(name)) return instances.get(name)

    const provider = providers.get(name)
    if (!provider) {
      throw new InjectionError(`Dependência desconhecida: "${name}"${requester ? `, pedida por "${requester}"` : ''}`)
    }
    if (resolving.includes(name)) {
      throw new InjectionError(`Dependência circular: ${[...resolving, name].join(' -> ')}`)
    }

    resolving.push(name)
    try {
      const instance = provider()
      instances.set(name, instance)
      return instance
    } finally {
      resolving.pop()
    }
  }

  /**
   * Chama `target` com as dependências resolvidas. O retorno segue a regra do
   * `new`: se a função devolver um objeto ou função, é ele; senão, é o `this`.
   */
  function instantiate(target, locals, requester) {
    const { fn, dependencies } = annotate(target)
    const values = dependencies.map((name) => get(name, locals, requester))
    if (isClass(fn)) return new fn(...values)
    const self = Object.create(fn.prototype ?? Object.prototype)
    const returned = fn.apply(self, values)
    const isInstance = returned !== null && (typeof returned === 'object' || typeof returned === 'function')
    return isInstance ? returned : self
  }

  return {
    has: (name) => providers.has(name),
    get,
    instantiate,
    /** Registra um valor pronto. */
    value(name, instance) {
      providers.set(name, () => instance)
      instances.delete(name)
    },
    /** Registra um serviço: `target` é injetado e instanciado uma única vez. */
    service(name, target) {
      providers.set(name, () => instantiate(target, undefined, name))
      instances.delete(name)
    },
  }
}
