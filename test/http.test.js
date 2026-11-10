import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createHttp, HttpError } from '../src/http.js'

function fakeFetch(status, body) {
  const calls = []
  const fetchImplementation = async (url, init) => {
    calls.push({ url, init })
    return new Response(body, { status })
  }
  return { calls, fetchImplementation }
}

test('get devolve Promise com status, texto e JSON já lido', async () => {
  const { calls, fetchImplementation } = fakeFetch(200, '{"name":"Jonathan"}')
  const $http = createHttp(fetchImplementation)

  const response = await $http.get('/api/user')

  assert.equal(calls[0].url, '/api/user')
  assert.equal(calls[0].init.method, 'GET')
  assert.equal(response.status, 200)
  assert.equal(response.responseText, '{"name":"Jonathan"}')
  assert.deepEqual(response.data, { name: 'Jonathan' })
})

test('aceita o callback com a grafia de 2015 (onSucess) e a corrigida', async () => {
  const $http = createHttp(fakeFetch(200, 'ok').fetchImplementation)
  const received = []

  await $http.get('/a', { onSucess: (response) => received.push(`2015:${response.responseText}`) })
  await $http.get('/b', { onSuccess: (response) => received.push(`2026:${response.responseText}`) })

  assert.deepEqual(received, ['2015:ok', '2026:ok'])
})

test('callback de sucesso roda uma vez, não a cada readystatechange', async () => {
  const $http = createHttp(fakeFetch(200, 'ok').fetchImplementation)
  let calls = 0

  await $http.get('/a', { onSucess: () => calls++ })

  assert.equal(calls, 1)
})

test('post envia o corpo como JSON, o que o original não fazia', async () => {
  const { calls, fetchImplementation } = fakeFetch(201, '{"id":1}')
  const $http = createHttp(fetchImplementation)

  const response = await $http.post('/api/users', { data: { name: 'Rafael' } })

  assert.equal(calls[0].init.method, 'POST')
  assert.equal(calls[0].init.body, '{"name":"Rafael"}')
  assert.equal(calls[0].init.headers.get('content-type'), 'application/json')
  assert.equal(response.data.id, 1)
})

test('status de erro rejeita com HttpError e chama onError', async () => {
  const $http = createHttp(fakeFetch(404, 'não achei').fetchImplementation)
  const errors = []

  await assert.rejects($http.get('/x'), (error) => error instanceof HttpError && error.status === 404)
  await $http.get('/x', { onError: (error) => errors.push(error.response.responseText) }).catch(() => {})

  assert.deepEqual(errors, ['não achei'])
})

test('resposta que não é JSON fica com data indefinido', async () => {
  const $http = createHttp(fakeFetch(200, '<html>').fetchImplementation)

  const response = await $http.get('/page')

  assert.equal(response.data, undefined)
})
