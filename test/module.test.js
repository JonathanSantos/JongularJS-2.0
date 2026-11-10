import assert from 'node:assert/strict'
import { afterEach, beforeEach, test } from 'node:test'
import { JSDOM } from 'jsdom'
import { directive, flush, Module } from '../src/index.js'

let dom
let warnings
let errors
const originalConsole = { warn: console.warn, error: console.error }

function mount(html) {
  dom = new JSDOM(`<!DOCTYPE html><html><body><div jo-app="myApp">${html}</div></body></html>`)
  return dom.window.document.querySelector('[jo-app]')
}

function fire(element, type) {
  element.dispatchEvent(new dom.window.Event(type, { bubbles: true }))
}

function type(element, text) {
  element.value = text
  fire(element, 'input')
}

beforeEach(() => {
  warnings = []
  errors = []
  console.warn = (message) => warnings.push(message)
  console.error = (message) => errors.push(message)
})

afterEach(() => {
  Object.assign(console, originalConsole)
})

test('jo-model mostra o valor do $scope e acompanha as mudanças', () => {
  const root = mount('<div jo-controller="testController"><span jo-model="user"></span></div>')
  const app = new Module('myApp').controller('testController', function ($scope) {
    $scope.user = 'Jonathan'
  })

  app.bootstrap(root)
  const span = root.querySelector('span')
  assert.equal(span.textContent, 'Jonathan')

  app.scope('testController').user = 'Rafael'
  flush()
  assert.equal(span.textContent, 'Rafael')
})

test('jo-model em caminho aninhado atualiza sozinho', () => {
  const root = mount('<div jo-controller="c"><span jo-model="user.name"></span></div>')
  const app = new Module('myApp').controller('c', ($scope) => {
    $scope.user = { name: 'Jo' }
  })
  app.bootstrap(root)

  app.scope('c').user.name = 'Jonathan'
  flush()

  assert.equal(root.querySelector('span').textContent, 'Jonathan')
})

test('jo-model em input é de mão dupla, e o input acompanha o $scope', () => {
  // No original a linha `els[i].value = val` estava comentada: o input não voltava.
  const root = mount(`
    <div jo-controller="c">
      <input type="text" jo-model="name">
      <input jo-model="name" id="untyped">
      <h1 jo-model="name"></h1>
    </div>`)
  const app = new Module('myApp').controller('c', ($scope) => {
    $scope.name = 'Jo'
  })
  app.bootstrap(root)
  const [first, untyped] = root.querySelectorAll('input')
  assert.equal(first.value, 'Jo')
  assert.equal(untyped.value, 'Jo')

  type(first, 'Jonathan')
  flush()

  assert.equal(app.scope('c').name, 'Jonathan')
  assert.equal(root.querySelector('h1').textContent, 'Jonathan')
  assert.equal(untyped.value, 'Jonathan')
})

test('input sem valor no $scope fica vazio em vez de mostrar "undefined"', () => {
  const root = mount('<div jo-controller="c"><input type="text" jo-model="joao"></div>')
  const app = new Module('myApp').controller('c', () => {})

  app.bootstrap(root)

  assert.equal(root.querySelector('input').value, '')
})

test('jo-model entende checkbox, number, select, radio e textarea', () => {
  const root = mount(`
    <div jo-controller="c">
      <input type="checkbox" jo-model="active">
      <input type="number" jo-model="age">
      <select jo-model="color"><option value="red">r</option><option value="blue">b</option></select>
      <input type="radio" name="size" value="s" jo-model="size">
      <input type="radio" name="size" value="m" jo-model="size">
      <textarea jo-model="bio"></textarea>
    </div>`)
  const app = new Module('myApp').controller('c', ($scope) => {
    Object.assign($scope, { active: true, age: 30, color: 'blue', size: 'm', bio: 'oi' })
  })
  app.bootstrap(root)
  const scope = app.scope('c')
  const [checkbox, number, small, medium] = root.querySelectorAll('input')
  const select = root.querySelector('select')
  const textarea = root.querySelector('textarea')

  assert.deepEqual(
    [checkbox.checked, number.value, select.value, small.checked, medium.checked, textarea.value],
    [true, '30', 'blue', false, true, 'oi'],
  )

  checkbox.checked = false
  fire(checkbox, 'change')
  type(number, '31')
  select.value = 'red'
  fire(select, 'change')
  small.checked = true
  fire(small, 'change')
  type(textarea, 'olá')

  assert.deepEqual({ ...scope }, { active: false, age: 31, color: 'red', size: 's', bio: 'olá' })
})

test('jo-click aceita referência (2015) e chamada com argumentos', () => {
  const root = mount(`
    <div jo-controller="c">
      <button id="reference" jo-click="add">+</button>
      <button id="call" jo-click="addMany(10)">+10</button>
      <button id="event" jo-click="remember($event)">e</button>
      <span jo-model="count"></span>
    </div>`)
  let receivedEvent
  const app = new Module('myApp').controller('c', ($scope) => {
    $scope.count = 0
    $scope.add = () => $scope.count++
    $scope.addMany = (amount) => {
      $scope.count += amount
    }
    $scope.remember = (event) => {
      receivedEvent = event
    }
  })
  app.bootstrap(root)

  // No original, `jo-click="addMany(10)"` executava já no bootstrap.
  assert.equal(app.scope('c').count, 0)

  fire(root.querySelector('#reference'), 'click')
  fire(root.querySelector('#call'), 'click')
  fire(root.querySelector('#event'), 'click')
  flush()

  assert.equal(root.querySelector('span').textContent, '11')
  assert.equal(receivedEvent.type, 'click')
})

test('jo-init roda atribuição, chamada e referência de função', () => {
  const root = mount(`
    <div jo-controller="c">
      <h1 jo-init="jo = 'Jonathan Reis dos Santos'" jo-model="jo"></h1>
      <i jo-init="load()"></i>
      <b jo-init="boot"></b>
    </div>`)
  const called = []
  const app = new Module('myApp').controller('c', ($scope) => {
    $scope.load = () => called.push('load')
    $scope.boot = () => called.push('boot')
  })

  app.bootstrap(root)

  assert.equal(root.querySelector('h1').textContent, 'Jonathan Reis dos Santos')
  assert.deepEqual(called, ['load', 'boot'])
})

test('controller sem $scope nos parâmetros ainda tem escopo no HTML', () => {
  const root = mount(`
    <div jo-controller="semController">
      <h1 jo-init="jo = 'x'" jo-model="jo"></h1>
      <input type="text" jo-model="jo">
    </div>`)
  let http
  const app = new Module('myApp').controller('semController', function ($http) {
    http = $http
  })

  app.bootstrap(root)
  type(root.querySelector('input'), 'y')
  flush()

  assert.equal(typeof http.get, 'function')
  assert.equal(root.querySelector('h1').textContent, 'y')
})

test('controllers recebem serviços e $rootScope, em qualquer ordem de registro', () => {
  const root = mount('<div jo-controller="c"><span jo-model="message"></span></div>')
  const app = new Module('myApp')
    .controller('c', function ($rootScope, $scope, greeter) {
      $rootScope.company = 'ACME'
      $scope.message = greeter.greet('Jo')
    })
    .service('greeter', function () {
      this.greet = (name) => `Olá, ${name}`
    })

  app.bootstrap(root)

  assert.equal(root.querySelector('span').textContent, 'Olá, Jo')
  assert.equal(app.$rootScope.company, 'ACME')
})

test('$rootScope aparece dentro dos controllers e fora deles', () => {
  const root = mount(`
    <header jo-model="company"></header>
    <div jo-controller="c"><span jo-model="company"></span></div>`)
  const app = new Module('myApp').controller('c', () => {})
  app.bootstrap(root)

  app.$rootScope.company = 'ACME'
  flush()

  assert.equal(root.querySelector('header').textContent, 'ACME')
  assert.equal(root.querySelector('span').textContent, 'ACME')
})

test('elementos com o mesmo jo-controller dividem um $scope, como no original', () => {
  const root = mount(`
    <div jo-controller="c"><span jo-model="user"></span></div>
    <div jo-controller="c"><span jo-model="user"></span></div>`)
  let runs = 0
  const app = new Module('myApp').controller('c', ($scope) => {
    runs++
    $scope.user = 'Jonathan'
  })

  app.bootstrap(root)

  assert.equal(runs, 1)
  assert.deepEqual([...root.querySelectorAll('span')].map((span) => span.textContent), ['Jonathan', 'Jonathan'])
})

test('em controllers aninhados, cada elemento pertence ao controller mais próximo', () => {
  const root = mount(`
    <div jo-controller="outer">
      <span id="outer" jo-model="name"></span>
      <div jo-controller="inner"><span id="inner" jo-model="name"></span></div>
    </div>`)
  const app = new Module('myApp')
    .controller('outer', ($scope) => {
      $scope.name = 'fora'
    })
    .controller('inner', ($scope) => {
      $scope.name = 'dentro'
    })

  app.bootstrap(root)

  assert.equal(root.querySelector('#outer').textContent, 'fora')
  assert.equal(root.querySelector('#inner').textContent, 'dentro')
})

test('diretiva nova entra pelo registro, sem tocar no núcleo', () => {
  directive('show', ({ element, evaluate, effect }) => {
    effect(() => {
      element.hidden = !evaluate()
    })
  })
  const root = mount('<div jo-controller="c"><p jo-show="visible">oi</p></div>')
  const app = new Module('myApp').controller('c', ($scope) => {
    $scope.visible = false
  })
  app.bootstrap(root)
  const paragraph = root.querySelector('p')
  assert.equal(paragraph.hidden, true)

  app.scope('c').visible = true
  flush()

  assert.equal(paragraph.hidden, false)
})

test('binding mantém os campos que as diretivas de 2015 recebiam', () => {
  let received
  directive('probe', (binding) => {
    received = binding
  })
  const root = mount('<div jo-controller="c"><p jo-probe="user.name"></p></div>')
  const app = new Module('myApp').controller('c', () => {})

  app.bootstrap(root)

  assert.equal(received.attribute, 'user.name')
  assert.equal(received.element, root.querySelector('p'))
  assert.equal(received.name, 'probe')
  assert.equal(received.controller, 'c')
  assert.equal(received.$scope, app.scope('c'))
})

test('destroy desliga efeitos e eventos', () => {
  const root = mount(`
    <div jo-controller="c">
      <span jo-model="count"></span>
      <button jo-click="add">+</button>
    </div>`)
  let clicks = 0
  const app = new Module('myApp').controller('c', ($scope) => {
    $scope.count = 0
    $scope.add = () => clicks++
  })
  app.bootstrap(root)
  const scope = app.scope('c')

  app.destroy()
  scope.count = 5
  flush()
  fire(root.querySelector('button'), 'click')

  assert.equal(root.querySelector('span').textContent, '0')
  assert.equal(clicks, 0)
  assert.equal(app.state, 'destroyed')
})

test('problemas viram avisos legíveis e não param o resto da página', () => {
  const root = mount(`
    <div jo-controller="ghost"><span jo-model="x"></span></div>
    <div jo-controller="broken"></div>
    <div jo-controller="ok">
      <span jo-typo="x"></span>
      <button jo-click="missing()">x</button>
      <em jo-model="user."></em>
      <strong jo-model="name"></strong>
    </div>`)
  const app = new Module('myApp')
    .controller('broken', function ($nope) {})
    .controller('ok', ($scope) => {
      $scope.name = 'segue funcionando'
    })

  app.bootstrap(root)
  fire(root.querySelector('button'), 'click')

  assert.equal(root.querySelector('strong').textContent, 'segue funcionando')
  assert.match(warnings.join('\n'), /Controller "ghost" está no HTML mas não foi registrado/)
  assert.match(warnings.join('\n'), /Diretiva desconhecida: jo-typo/)
  assert.match(errors.join('\n'), /controller "broken": Dependência desconhecida: "\$nope"/)
  assert.match(errors.join('\n'), /jo-click="missing\(\)" em ok: Tentou chamar algo que não é função/)
  assert.match(errors.join('\n'), /jo-model="user\." em ok/)
})

test('bootstrap sem elemento jo-app avisa em vez de quebrar', () => {
  const app = new Module('semElemento')

  app.bootstrap(null)

  assert.match(warnings[0], /Nenhum elemento com jo-app="semElemento"/)
  assert.equal(app.state, 'idle')
})

test('módulo exige nome', () => {
  assert.throws(() => new Module(), /informe o nome/)
})
