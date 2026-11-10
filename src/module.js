/**
 * Módulo do Jongular: o objeto devolvido por `jongular.module('myApp')`.
 *
 * Guarda os controllers e serviços registrados e, no `bootstrap`, liga tudo ao
 * pedaço do DOM marcado com `jo-app`. É a única parte da biblioteca, junto
 * com as diretivas, que encosta no DOM.
 */

import { compile } from './expression.js'
import { findDirective } from './directives.js'
import { createHttp } from './http.js'
import { annotate, createInjector } from './injector.js'
import { effect, reactive } from './reactivity.js'

const PREFIX = 'jo-'
const STRUCTURAL_ATTRIBUTES = new Set(['jo-app', 'jo-controller'])

function report(error, context) {
  console.error(`[jongular] ${context}: ${error?.message ?? error}`)
}

function createScope() {
  // Sem protótipo: `toString` ou `constructor` num atributo não acham nada herdado.
  return reactive(Object.create(null))
}

function selfAndDescendants(root, selector) {
  const found = [...root.querySelectorAll(selector)]
  if (root.matches?.(selector)) found.unshift(root)
  return found
}

export class Module {
  #injector = createInjector()
  #state = 'idle'
  #stops = []

  /** @param {string} name o mesmo nome usado em `jo-app="..."` */
  constructor(name) {
    if (!name) throw new TypeError('jongular.module(name): informe o nome usado em jo-app')
    this.name = name
    this.controllers = new Map()
    this.$rootScope = createScope()
    this.#injector.value('$rootScope', this.$rootScope)
    this.#injector.value('$http', createHttp())
  }

  get state() {
    return this.#state
  }

  /**
   * Registra um controller. Ele roda no bootstrap, uma vez, e o `$scope` dele
   * é compartilhado por todos os elementos `jo-controller` com esse nome.
   */
  controller(name, target) {
    annotate(target)
    this.controllers.set(name, { name, target, $scope: null })
    return this
  }

  /** Registra um serviço injetável pelo nome. É criado só quando alguém pede. */
  service(name, target) {
    annotate(target)
    this.#injector.service(name, target)
    return this
  }

  /** O `$scope` de um controller já iniciado (útil no console e nos testes). */
  scope(controllerName) {
    return this.controllers.get(controllerName)?.$scope ?? undefined
  }

  /**
   * Liga o módulo ao DOM. É chamado sozinho quando a página termina de
   * carregar; chame à mão para escolher a raiz ou em testes.
   * @param {Element} [root] padrão: o elemento com `jo-app="<name>"`
   */
  bootstrap(root = globalThis.document?.querySelector(`[jo-app="${this.name}"]`)) {
    if (this.#state === 'running') return this
    if (!root) {
      console.warn(`[jongular] Nenhum elemento com jo-app="${this.name}" foi encontrado`)
      return this
    }
    this.#state = 'running'

    for (const element of selfAndDescendants(root, '[jo-controller]')) {
      this.#startController(element.getAttribute('jo-controller'))
    }
    for (const element of selfAndDescendants(root, '*')) {
      this.#bindElement(element, root)
    }
    return this
  }

  /** Desliga efeitos e eventos e descarta os escopos. */
  destroy() {
    for (const stop of this.#stops) stop()
    this.#stops = []
    for (const definition of this.controllers.values()) definition.$scope = null
    this.#state = 'destroyed'
  }

  #startController(name) {
    const definition = this.controllers.get(name)
    if (!definition) {
      console.warn(`[jongular] Controller "${name}" está no HTML mas não foi registrado`)
      return
    }
    if (definition.$scope) return

    definition.$scope = createScope()
    try {
      this.#injector.instantiate(definition.target, { $scope: definition.$scope }, name)
    } catch (error) {
      report(error, `controller "${name}"`)
    }
  }

  #bindElement(element, root) {
    for (const { name: attributeName, value } of [...element.attributes]) {
      if (!attributeName.startsWith(PREFIX) || STRUCTURAL_ATTRIBUTES.has(attributeName)) continue

      const directiveName = attributeName.slice(PREFIX.length)
      const setup = findDirective(directiveName)
      if (!setup) {
        console.warn(`[jongular] Diretiva desconhecida: ${attributeName}`)
        continue
      }

      // O dono é o controller mais próximo; fora de qualquer controller, o $rootScope.
      const owner = element.closest('[jo-controller]')
      const controllerName = owner && root.contains(owner) ? owner.getAttribute('jo-controller') : null
      const $scope = controllerName ? this.scope(controllerName) : this.$rootScope
      if (!$scope) continue

      const context = `${attributeName}="${value}"${controllerName ? ` em ${controllerName}` : ''}`
      try {
        setup(this.#createBinding({ element, value, directiveName, controllerName, $scope, context }))
      } catch (error) {
        report(error, context)
      }
    }
  }

  #createBinding({ element, value, directiveName, controllerName, $scope, context }) {
    const expression = compile(value)
    const scopes = $scope === this.$rootScope ? [$scope] : [$scope, this.$rootScope]
    const stops = this.#stops
    const onError = (error) => report(error, context)

    return {
      attribute: value,
      element,
      name: directiveName,
      controller: controllerName,
      $scope,
      expression,
      evaluate: (locals) => expression.evaluate(scopes, locals),
      assign: (newValue) => expression.assign(scopes, newValue),
      run(locals) {
        const result = expression.evaluate(scopes, locals)
        // `jo-click="add"` (sem parênteses) chama a função, como em 2015.
        const isFunctionReference = expression.isReference && typeof result === 'function'
        return isFunctionReference ? result.call($scope, locals?.$event) : result
      },
      effect(fn) {
        stops.push(effect(fn, { onError }))
      },
      listen(type, handler) {
        const guarded = (event) => {
          try {
            handler(event)
          } catch (error) {
            onError(error)
          }
        }
        element.addEventListener(type, guarded)
        stops.push(() => element.removeEventListener(type, guarded))
      },
    }
  }
}
