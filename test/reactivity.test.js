import assert from 'node:assert/strict'
import { test } from 'node:test'
import { effect, flush, nextTick, reactive, toRaw } from '../src/reactivity.js'

test('efeito roda na criação e de novo quando a chave lida muda', async () => {
  const scope = reactive({ user: 'Jonathan' })
  const seen = []
  effect(() => seen.push(scope.user))

  scope.user = 'Rafael'
  await nextTick()

  assert.deepEqual(seen, ['Jonathan', 'Rafael'])
})

test('várias escritas no mesmo tick viram uma única execução com o último valor', async () => {
  // O original lia só `changes[0]` do Object.observe e perdia as demais mudanças do lote.
  const scope = reactive({ user: 'a', senha: 'b' })
  const seen = []
  effect(() => seen.push(`${scope.user}/${scope.senha}`))

  scope.user = 'x'
  scope.senha = 'y'
  scope.user = 'z'
  await nextTick()

  assert.deepEqual(seen, ['a/b', 'z/y'])
})

test('observa objetos aninhados, o que o Object.observe não fazia', () => {
  const scope = reactive({ user: { name: 'Jonathan' } })
  const seen = []
  effect(() => seen.push(scope.user.name))

  scope.user.name = 'Rafael'
  flush()

  assert.deepEqual(seen, ['Jonathan', 'Rafael'])
})

test('não reexecuta quando o valor escrito é igual ao anterior', () => {
  const scope = reactive({ count: 1 })
  let runs = 0
  effect(() => {
    runs += scope.count
  })

  scope.count = 1
  flush()

  assert.equal(runs, 1)
})

test('efeito que leu chave ausente roda quando ela é criada', () => {
  const scope = reactive({})
  const seen = []
  effect(() => seen.push('jo' in scope ? scope.jo : 'vazio'))

  scope.jo = 'Jonathan Reis dos Santos'
  flush()

  assert.deepEqual(seen, ['vazio', 'Jonathan Reis dos Santos'])
})

test('arrays: push e remoção disparam quem leu o tamanho', () => {
  const scope = reactive({ items: ['a'] })
  const seen = []
  effect(() => seen.push(scope.items.length))

  scope.items.push('b')
  flush()
  delete scope.items[0]
  scope.items.length = 0
  flush()

  assert.deepEqual(seen, [1, 2, 0])
})

test('efeito encerrado não roda mais', () => {
  const scope = reactive({ count: 0 })
  let runs = 0
  const stop = effect(() => {
    void scope.count
    runs++
  })

  scope.count = 1
  stop()
  flush()

  assert.equal(runs, 1)
})

test('dependências são refeitas a cada execução', () => {
  const scope = reactive({ showName: true, name: 'Jo', nickname: 'J' })
  const seen = []
  effect(() => seen.push(scope.showName ? scope.name : scope.nickname))

  scope.showName = false
  flush()
  scope.name = 'ignorado'
  flush()

  assert.deepEqual(seen, ['Jo', 'J'])
})

test('erro em um efeito vai para onError e não derruba os outros', () => {
  const scope = reactive({ count: 0 })
  const errors = []
  const seen = []
  effect(
    () => {
      if (scope.count > 0) throw new Error('quebrou')
    },
    { onError: (error) => errors.push(error.message) },
  )
  effect(() => seen.push(scope.count))

  scope.count = 1
  flush()

  assert.deepEqual(errors, ['quebrou'])
  assert.deepEqual(seen, [0, 1])
})

test('reactive devolve o mesmo proxy para o mesmo objeto e deixa Date em paz', () => {
  const raw = { when: new Date(0) }
  const scope = reactive(raw)

  assert.equal(reactive(raw), scope)
  assert.equal(reactive(scope), scope)
  assert.equal(toRaw(scope), raw)
  assert.equal(scope.when.getTime(), 0)
})
