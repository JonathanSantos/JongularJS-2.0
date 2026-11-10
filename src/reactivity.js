/**
 * Reatividade do Jongular.
 *
 * Em 2015 o `$scope` era vigiado com `Object.observe`, que o Chrome entregava
 * em lote, num microtask. A API foi removida dos navegadores em 2016. Aqui o
 * mesmo contrato ("atribua no $scope e a tela acompanha") é cumprido com
 * `Proxy`: cada leitura feita dentro de um `effect` vira uma assinatura, e cada
 * escrita reagenda só os efeitos que leram aquela chave.
 *
 * Este módulo não conhece o DOM.
 */

const ITERATE = Symbol('iterate')

/** objeto original -> proxy reativo */
const proxies = new WeakMap()
/** proxy reativo -> objeto original */
const originals = new WeakMap()
/** objeto original -> (chave -> efeitos que leram a chave) */
const subscriptions = new WeakMap()

let activeEffect = null
const pendingEffects = new Set()
let flushPromise = null

function isObservable(value) {
  if (value === null || typeof value !== 'object') return false
  if (Array.isArray(value)) return true
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

/** Devolve o objeto original por trás de um proxy reativo. */
export function toRaw(value) {
  return originals.get(value) ?? value
}

function track(target, key) {
  if (!activeEffect) return
  let keys = subscriptions.get(target)
  if (!keys) subscriptions.set(target, (keys = new Map()))
  let effects = keys.get(key)
  if (!effects) keys.set(key, (effects = new Set()))
  effects.add(activeEffect)
  activeEffect.dependencies.add(effects)
}

function trigger(target, key) {
  const effects = subscriptions.get(target)?.get(key)
  if (!effects) return
  for (const runner of effects) {
    if (runner !== activeEffect) schedule(runner)
  }
}

function schedule(runner) {
  pendingEffects.add(runner)
  flushPromise ??= Promise.resolve().then(flush)
}

/** Roda agora todos os efeitos pendentes, sem esperar o microtask. */
export function flush() {
  flushPromise = null
  const batch = [...pendingEffects]
  pendingEffects.clear()
  for (const runner of batch) runner.run()
}

/** Promessa que resolve depois que a tela refletiu as últimas mudanças. */
export function nextTick() {
  return flushPromise ?? Promise.resolve()
}

const handlers = {
  get(target, key, receiver) {
    const value = Reflect.get(target, key, receiver)
    if (typeof key === 'symbol') return value
    track(target, key)
    return reactive(value)
  },
  has(target, key) {
    track(target, key)
    return Reflect.has(target, key)
  },
  ownKeys(target) {
    track(target, ITERATE)
    return Reflect.ownKeys(target)
  },
  set(target, key, value, receiver) {
    const existed = Object.hasOwn(target, key)
    const previous = target[key]
    const next = toRaw(value)
    const succeeded = Reflect.set(target, key, next, receiver)
    if (!existed) {
      trigger(target, ITERATE)
      // Num array, criar um índice já muda o `length` por baixo dos panos.
      if (Array.isArray(target)) trigger(target, 'length')
    }
    if (!existed || !Object.is(previous, next)) trigger(target, key)
    return succeeded
  },
  deleteProperty(target, key) {
    const existed = Object.hasOwn(target, key)
    const succeeded = Reflect.deleteProperty(target, key)
    if (existed && succeeded) {
      trigger(target, key)
      trigger(target, ITERATE)
    }
    return succeeded
  },
}

/**
 * Torna um objeto (ou array) observável, em profundidade e sob demanda.
 * Valores que não são objetos simples (Date, Map, nós do DOM) passam intactos.
 * @template T
 * @param {T} target
 * @returns {T}
 */
export function reactive(target) {
  if (!isObservable(target)) return target
  if (originals.has(target)) return target
  let proxy = proxies.get(target)
  if (!proxy) {
    proxy = new Proxy(target, handlers)
    proxies.set(target, proxy)
    originals.set(proxy, target)
  }
  return proxy
}

/**
 * Executa `fn` e a repete sempre que algo que ela leu mudar.
 * @param {() => void} fn
 * @param {{ onError?: (error: unknown) => void }} [options]
 * @returns {() => void} função que encerra o efeito
 */
export function effect(fn, options = {}) {
  const runner = {
    active: true,
    dependencies: new Set(),
    run() {
      if (!runner.active) return
      unsubscribe(runner)
      const outerEffect = activeEffect
      activeEffect = runner
      try {
        fn()
      } catch (error) {
        if (!options.onError) throw error
        options.onError(error)
      } finally {
        activeEffect = outerEffect
      }
    },
  }
  runner.run()
  return () => {
    runner.active = false
    unsubscribe(runner)
    pendingEffects.delete(runner)
  }
}

function unsubscribe(runner) {
  for (const effects of runner.dependencies) effects.delete(runner)
  runner.dependencies.clear()
}
