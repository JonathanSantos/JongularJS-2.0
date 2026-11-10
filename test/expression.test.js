import assert from 'node:assert/strict'
import { test } from 'node:test'
import { compile, ExpressionError } from '../src/expression.js'

const read = (source, scope, locals) => compile(source).evaluate([scope], locals)

test('lê nomes, caminhos e índices', () => {
  const scope = { user: 'Jonathan', profile: { name: 'Jo' }, items: [{ title: 'a' }, { title: 'b' }], index: 1 }

  assert.equal(read('user', scope), 'Jonathan')
  assert.equal(read('profile.name', scope), 'Jo')
  assert.equal(read('items[1].title', scope), 'b')
  assert.equal(read('items[index].title', scope), 'b')
})

test('caminho que passa por valor indefinido devolve undefined em vez de quebrar', () => {
  assert.equal(read('profile.address.city', {}), undefined)
})

test('literais e negação', () => {
  assert.equal(read("'oi'", {}), 'oi')
  assert.equal(read('"it\\"s"', {}), 'it"s')
  assert.equal(read('42.5', {}), 42.5)
  assert.equal(read('true', {}), true)
  assert.equal(read('null', {}), null)
  assert.equal(read('!visible', { visible: false }), true)
  assert.equal(read('!!visible', { visible: 1 }), true)
})

test('chama funções com argumentos e preserva o this', () => {
  const scope = {
    prefix: 'Olá, ',
    greet(name) {
      return this.prefix + name
    },
    user: {
      name: 'Jo',
      shout() {
        return this.name.toUpperCase()
      },
    },
  }

  assert.equal(read('greet(user.name)', scope), 'Olá, Jo')
  assert.equal(read("greet('mundo')", scope), 'Olá, mundo')
  assert.equal(read('user.shout()', scope), 'JO')
})

test("atribuição do demo de 2015: jo = 'Jonathan Reis dos Santos'", () => {
  const scope = {}

  read("jo = 'Jonathan Reis dos Santos'", scope)

  assert.equal(scope.jo, 'Jonathan Reis dos Santos')
})

test('assign escreve no caminho e cria objetos intermediários', () => {
  const scope = {}

  compile('user.address.city').assign([scope], 'São Paulo')

  assert.deepEqual(scope, { user: { address: { city: 'São Paulo' } } })
})

test('nome é procurado nos locais, depois no $scope, depois no $rootScope', () => {
  const scope = { title: 'do controller' }
  const rootScope = { title: 'da raiz', company: 'ACME' }
  const expression = compile('title')

  assert.equal(expression.evaluate([scope, rootScope]), 'do controller')
  assert.equal(compile('company').evaluate([scope, rootScope]), 'ACME')
  assert.equal(expression.evaluate([scope, rootScope], { title: 'local' }), 'local')
})

test('escrita em nome novo cai no primeiro escopo; em nome da raiz, na raiz', () => {
  const scope = {}
  const rootScope = { theme: 'claro' }

  compile('count').assign([scope, rootScope], 1)
  compile('theme').assign([scope, rootScope], 'escuro')

  assert.deepEqual(scope, { count: 1 })
  assert.deepEqual(rootScope, { theme: 'escuro' })
})

test('isReference distingue `add` de `add()`', () => {
  assert.equal(compile('add').isReference, true)
  assert.equal(compile('user.save').isReference, true)
  assert.equal(compile('add()').isReference, false)
  assert.equal(compile('!add').isAssignable, false)
})

test('bloqueia as portas de saída que o eval deixava abertas', () => {
  const scope = { user: {} }

  assert.throws(() => read('user.constructor', scope), ExpressionError)
  assert.throws(() => read('user.__proto__', scope), ExpressionError)
  assert.throws(() => read("user['constructor']", scope), ExpressionError)
  assert.throws(() => read('constructor', scope), ExpressionError)
  assert.throws(() => compile('user.__proto__.polluted').assign([scope], true), ExpressionError)
  assert.equal({}.polluted, undefined)
})

test('erros de sintaxe dizem qual expressão falhou', () => {
  assert.throws(() => compile(''), /Expressão vazia/)
  assert.throws(() => compile('user.'), /em "user\."/)
  assert.throws(() => compile('a b'), /Sobrou texto/)
  assert.throws(() => compile('alert(1); x'), /Caractere inesperado/)
  assert.throws(() => compile("'a' = 1"), /Só é possível atribuir/)
})

test('chamar o que não é função gera erro claro', () => {
  assert.throws(() => read('missing()', {}), /não é função em "missing\(\)"/)
})
