/**
 * `$http` do Jongular.
 *
 * O original abria um `XMLHttpRequest` (com `ActiveXObject` de reserva para o
 * IE6) e avisava por `onSucess`, com esse nome mesmo. Aqui o transporte é o
 * `fetch`, toda chamada devolve uma Promise, e os callbacks antigos continuam
 * aceitos: `onSucess` (grafia de 2015) e `onSuccess`. Padrão Adapter: a
 * interface de 2015 por cima da API de hoje.
 */

export class HttpError extends Error {
  constructor(response) {
    super(`HTTP ${response.status} em ${response.url}`)
    this.name = 'HttpError'
    this.response = response
    this.status = response.status
  }
}

function parseJson(text) {
  try {
    return JSON.parse(text)
  } catch {
    return undefined
  }
}

function encodeBody(data, headers) {
  if (data === undefined || data === null) return undefined
  const isPlainData = Array.isArray(data) || Object.getPrototypeOf(data) === Object.prototype
  if (!isPlainData) return data
  if (!headers.has('content-type')) headers.set('content-type', 'application/json')
  return JSON.stringify(data)
}

/**
 * @param {typeof fetch} [fetchImplementation] trocável nos testes
 */
export function createHttp(fetchImplementation) {
  async function send(method, url, options) {
    const doFetch = fetchImplementation ?? globalThis.fetch
    const headers = new Headers(options.headers)
    const body = encodeBody(options.data, headers)
    const raw = await doFetch(url, { method, headers, body, signal: options.signal })
    const responseText = await raw.text()
    const response = {
      url,
      status: raw.status,
      ok: raw.ok,
      headers: raw.headers,
      responseText,
      data: parseJson(responseText),
    }
    if (!raw.ok) throw new HttpError(response)
    return response
  }

  function request(method, url, options = {}) {
    const onSuccess = options.onSuccess ?? options.onSucess
    const { onError } = options
    const promise = send(method, url, options)
    if (!onSuccess && !onError) return promise

    // Estilo de 2015: quem passou callback não precisa tratar a Promise.
    promise.then(onSuccess, onError ?? (() => {}))
    return promise
  }

  return {
    request,
    get: (url, options) => request('GET', url, options),
    post: (url, options) => request('POST', url, options),
    put: (url, options) => request('PUT', url, options),
    delete: (url, options) => request('DELETE', url, options),
  }
}
