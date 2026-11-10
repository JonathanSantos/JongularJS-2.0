/**
 * Teste de ponta a ponta da promessa principal da reescrita: as páginas de
 * demonstração de 2015 rodam SEM ALTERAÇÃO em cima do bundle novo.
 *
 * Os HTMLs em `original/` são carregados byte a byte. A única troca acontece
 * na rede: qualquer `<script src>` recebe `dist/jongularJS.2.0.js` (a demo do
 * branch já pedia um `jongularJS.2.0.js` que nunca foi commitado).
 */

import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import { JSDOM, ResourceLoader } from 'jsdom'

const bundle = await readFile(new URL('../dist/jongularJS.2.0.js', import.meta.url))
const TIME_SCALE = 100

class BundleLoader extends ResourceLoader {
  requested = []

  fetch(url) {
    this.requested.push(url.split('/').at(-1))
    return Promise.resolve(bundle)
  }
}

async function openDemo(path) {
  const html = await readFile(new URL(path, import.meta.url), 'utf8')
  const loader = new BundleLoader()
  const alerts = []
  const dom = new JSDOM(html, {
    url: 'http://localhost/',
    runScripts: 'dangerously',
    resources: loader,
    beforeParse(window) {
      const realSetTimeout = window.setTimeout.bind(window)
      window.setTimeout = (callback, delay = 0) => realSetTimeout(callback, delay / TIME_SCALE)
      window.alert = (message) => alerts.push(message)
    },
  })
  await new Promise((resolve) => dom.window.addEventListener('load', resolve))
  const { document } = dom.window
  return {
    dom,
    document,
    alerts,
    requested: loader.requested,
    wait: (demoMilliseconds) => new Promise((resolve) => setTimeout(resolve, demoMilliseconds / TIME_SCALE + 20)),
    text: (selector) => document.querySelector(selector).textContent,
    click: (element) => element.dispatchEvent(new dom.window.Event('click', { bubbles: true })),
    type(element, value) {
      element.value = value
      element.dispatchEvent(new dom.window.Event('input', { bubbles: true }))
    },
  }
}

test('demo do master (original/index.html) roda como em 2015', async () => {
  const demo = await openDemo('../original/index.html')

  assert.deepEqual(demo.requested, ['jongularJS.js'])
  assert.equal(demo.text('[jo-model="user"]'), 'Jonathan')
  assert.equal(demo.text('[jo-model="senha"]'), 'teste')

  await demo.wait(3000)
  assert.equal(demo.text('[jo-model="user"]'), 'Rafael')

  await demo.wait(3000)
  assert.equal(demo.text('[jo-model="user"]'), 'Marcão')

  // A demo guardava o $scope numa global `test` para brincar no console.
  demo.dom.window.test.senha = 'trocada pelo console'
  await demo.wait(0)
  assert.equal(demo.text('[jo-model="senha"]'), 'trocada pelo console')
  demo.dom.window.close()
})

test('demo do branch JongularJS.js recebe o jongularJS.2.0.js que pedia', async () => {
  const demo = await openDemo('../original/branch-JongularJS.js/index.html')
  const controller = (name) => demo.document.querySelector(`[jo-controller="${name}"]`)

  assert.deepEqual(demo.requested, ['jongularJS.2.0.js'])

  // testController: spans, input de mão dupla e jo-click="mostrar" com alert
  const testController = controller('testController')
  assert.equal(testController.querySelector('[jo-model="user"]').textContent, 'Jonathan')
  demo.type(testController.querySelector('input'), 'João')
  demo.click(testController.querySelector('[jo-click="mostrar"]'))
  assert.deepEqual(demo.alerts, ['João'])

  // novoController: contador com $scope.clique++
  const novoController = controller('novoController')
  assert.equal(novoController.querySelector('[jo-model="clique"]').textContent, '0')
  demo.click(novoController.querySelector('[jo-click="add"]'))
  demo.click(novoController.querySelector('[jo-click="add"]'))
  await demo.wait(0)
  assert.equal(novoController.querySelector('[jo-model="clique"]').textContent, '2')
  assert.equal(novoController.querySelector('h1').textContent, 'Jonathan Reis dos Santos')

  // semController: só pede $http, e o jo-init + input ainda funcionam
  const semController = controller('semController')
  assert.equal(semController.querySelector('h1').textContent, 'Jonathan Reis dos Santos')
  assert.equal(semController.querySelector('input').value, 'Jonathan Reis dos Santos')
  demo.type(semController.querySelector('input'), 'Jonathan')
  await demo.wait(0)
  assert.equal(semController.querySelector('h1').textContent, 'Jonathan')

  await demo.wait(6000)
  assert.equal(testController.querySelector('[jo-model="user"]').textContent, 'Marcão')
  demo.dom.window.close()
})
