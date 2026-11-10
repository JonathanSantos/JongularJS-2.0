import assert from 'node:assert/strict'
import { test } from 'node:test'
import { annotate, createInjector, InjectionError, parameterNames } from '../src/injector.js'

test('lê os nomes dos parâmetros como em 2015', () => {
  assert.deepEqual(parameterNames(function ($scope, $http) {}), ['$scope', '$http'])
  assert.deepEqual(parameterNames(function named($scope) {}), ['$scope'])
  assert.deepEqual(parameterNames(function () {}), [])
})

test('entende as formas de função que vieram depois de 2015', () => {
  assert.deepEqual(parameterNames(($scope, $http) => {}), ['$scope', '$http'])
  assert.deepEqual(parameterNames(($scope) => $scope), ['$scope'])
  assert.deepEqual(parameterNames(async ($scope) => {}), ['$scope'])
  assert.deepEqual(parameterNames(async function ($scope, clock) {}), ['$scope', 'clock'])
  assert.deepEqual(parameterNames(function ($scope /* estado */, $http = null) {}), ['$scope', '$http'])
  assert.deepEqual(
    parameterNames(
      class {
        constructor($http, clock) {}
      },
    ),
    ['$http', 'clock'],
  )
  assert.deepEqual(parameterNames(class {}), [])
})

test('arrow de um parâmetro sem parênteses', () => {
  // eslint-disable-next-line arrow-parens
  const fn = $scope => $scope
  assert.deepEqual(parameterNames(fn), ['$scope'])
})

test('notação em array e $inject sobrevivem à minificação', () => {
  const minified = function (a, b) {}
  const withInject = function (a) {}
  withInject.$inject = ['$scope']

  assert.deepEqual(annotate(['$scope', '$http', minified]).dependencies, ['$scope', '$http'])
  assert.deepEqual(annotate(withInject).dependencies, ['$scope'])
  assert.throws(() => annotate(['$scope']), InjectionError)
  assert.throws(() => annotate('nada'), InjectionError)
})

test('serviço é criado só quando pedido e uma única vez', () => {
  const injector = createInjector()
  let created = 0
  injector.service('counter', function () {
    created++
    this.value = 0
  })

  assert.equal(created, 0)
  const first = injector.get('counter')
  const second = injector.get('counter')

  assert.equal(created, 1)
  assert.equal(first, second)
  assert.equal(first.value, 0)
})

test('serviço pode ser função construtora, fábrica, arrow ou classe', () => {
  const injector = createInjector()
  injector.value('base', 10)
  injector.service('viaThis', function (base) {
    this.total = base + 1
  })
  injector.service('viaReturn', function (base) {
    return { total: base + 2 }
  })
  injector.service('viaArrow', (base) => ({ total: base + 3 }))
  injector.service(
    'viaClass',
    class {
      constructor(base) {
        this.total = base + 4
      }
    },
  )

  const totals = ['viaThis', 'viaReturn', 'viaArrow', 'viaClass'].map((name) => injector.get(name).total)

  assert.deepEqual(totals, [11, 12, 13, 14])
})

test('serviços dependem de serviços, na ordem que for', () => {
  const injector = createInjector()
  injector.service('greeter', (names) => ({ greet: () => `Olá, ${names.first}` }))
  injector.service('names', () => ({ first: 'Jonathan' }))

  assert.equal(injector.get('greeter').greet(), 'Olá, Jonathan')
})

test('valores locais têm prioridade e não ficam guardados', () => {
  const injector = createInjector()
  const received = []

  injector.instantiate(function ($scope) {
    received.push($scope)
  }, { $scope: 'a' })
  injector.instantiate(function ($scope) {
    received.push($scope)
  }, { $scope: 'b' })

  assert.deepEqual(received, ['a', 'b'])
})

test('dependência desconhecida falha com o nome de quem pediu', () => {
  // No original, um nome desconhecido deslocava os argumentos em silêncio.
  const injector = createInjector()

  assert.throws(
    () => injector.instantiate(function ($scope, $missing) {}, { $scope: {} }, 'testController'),
    /Dependência desconhecida: "\$missing", pedida por "testController"/,
  )
})

test('dependência circular é detectada', () => {
  const injector = createInjector()
  injector.service('a', (b) => ({ b }))
  injector.service('b', (a) => ({ a }))

  assert.throws(() => injector.get('a'), /Dependência circular: a -> b -> a/)
})
