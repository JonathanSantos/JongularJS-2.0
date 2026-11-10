/**
 * JongularJS 2.0
 *
 * A fachada pública continua a de 2015:
 *
 *   var app = jongular.module('myApp')
 *   app.controller('testController', function ($scope) { $scope.user = 'Jonathan' })
 *
 * com `jo-app`, `jo-controller`, `jo-model`, `jo-click` e `jo-init` no HTML.
 */

import { directive } from './directives.js'
import { Module } from './module.js'

export const VERSION = '2.0.0'

function whenDocumentIsReady(callback) {
  const { document } = globalThis
  if (!document) return
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', callback, { once: true })
    return
  }
  // A página já carregou: espera o script atual terminar de registrar controllers.
  setTimeout(callback)
}

export const jongular = {
  version: VERSION,

  /** Todos os módulos criados, como no original. */
  app: [],

  /**
   * Cria um módulo e agenda o bootstrap dele para quando o DOM estiver pronto.
   * @param {string} name o valor de `jo-app` no HTML
   */
  module(name) {
    const app = new Module(name)
    this.app.push(app)
    whenDocumentIsReady(() => {
      if (app.state === 'idle') app.bootstrap()
    })
    return app
  },

  /** Registra uma diretiva `jo-<name>` para todos os módulos. */
  directive,
}

export default jongular

export { Module } from './module.js'
export { directive } from './directives.js'
export { effect, flush, nextTick, reactive, toRaw } from './reactivity.js'
export { compile, ExpressionError } from './expression.js'
export { annotate, createInjector, InjectionError, parameterNames } from './injector.js'
export { createHttp, HttpError } from './http.js'
