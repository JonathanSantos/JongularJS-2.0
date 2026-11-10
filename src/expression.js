/**
 * Expressões dos atributos `jo-*`.
 *
 * O original montava `eval('$scope.' + attr)`. Funcionava, mas executava
 * qualquer coisa que estivesse no HTML e quebra em páginas com CSP. Este
 * módulo troca o `eval` por um interpretador pequeno, que entende só o que os
 * exemplos de 2015 usavam:
 *
 *   user            user.name          items[0].title
 *   add             add()              greet(user.name, 'oi')
 *   !visible        jo = 'Jonathan'    count = 0
 *
 * Padrão Interpreter: texto -> tokens -> árvore -> avaliação sobre o escopo.
 * Não conhece o DOM nem a reatividade (o escopo é só um objeto).
 */

const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype'])
const LITERALS = new Map([
  ['true', true],
  ['false', false],
  ['null', null],
  ['undefined', undefined],
])
const TOKEN = /\s*(?:(\d+(?:\.\d+)?)|([A-Za-z_$][\w$]*)|'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)"|([.()[\],!=]))/y

export class ExpressionError extends Error {
  constructor(message, source) {
    super(`${message} em "${source}"`)
    this.name = 'ExpressionError'
    this.source = source
  }
}

function tokenize(source) {
  const tokens = []
  TOKEN.lastIndex = 0
  while (TOKEN.lastIndex < source.length) {
    const start = TOKEN.lastIndex
    const match = TOKEN.exec(source)
    if (!match) {
      if (source.slice(start).trim() === '') break
      throw new ExpressionError(`Caractere inesperado na posição ${start}`, source)
    }
    const [, number, identifier, single, double, punctuation] = match
    if (number !== undefined) tokens.push({ type: 'literal', value: Number(number) })
    else if (identifier !== undefined) tokens.push({ type: 'identifier', value: identifier })
    else if (punctuation !== undefined) tokens.push({ type: punctuation })
    else tokens.push({ type: 'literal', value: unescape(single ?? double) })
  }
  return tokens
}

function unescape(text) {
  return text.replace(/\\(.)/g, '$1')
}

function parse(source) {
  const tokens = tokenize(source)
  let position = 0

  const peek = () => tokens[position]
  const accept = (type) => (peek()?.type === type ? tokens[position++] : null)
  const expect = (type) => {
    const token = accept(type)
    if (!token) throw new ExpressionError(`Esperava "${type}"`, source)
    return token
  }

  function parseAssignment() {
    const left = parseUnary()
    if (!accept('=')) return left
    if (left.type !== 'identifier' && left.type !== 'member') {
      throw new ExpressionError('Só é possível atribuir a uma propriedade', source)
    }
    return { type: 'assignment', target: left, value: parseAssignment() }
  }

  function parseUnary() {
    if (accept('!')) return { type: 'not', argument: parseUnary() }
    return parseAccess()
  }

  function parseAccess() {
    let node = parsePrimary()
    for (;;) {
      if (accept('.')) {
        const property = expect('identifier').value
        node = { type: 'member', object: node, property: { type: 'literal', value: property } }
      } else if (accept('[')) {
        const property = parseAssignment()
        expect(']')
        node = { type: 'member', object: node, property }
      } else if (accept('(')) {
        node = { type: 'call', callee: node, arguments: parseArguments() }
      } else {
        return node
      }
    }
  }

  function parseArguments() {
    const list = []
    if (accept(')')) return list
    do list.push(parseAssignment())
    while (accept(','))
    expect(')')
    return list
  }

  function parsePrimary() {
    const token = tokens[position++]
    if (!token) throw new ExpressionError('Expressão incompleta', source)
    if (token.type === 'literal') return token
    if (token.type === 'identifier') {
      if (LITERALS.has(token.value)) return { type: 'literal', value: LITERALS.get(token.value) }
      return { type: 'identifier', name: token.value }
    }
    if (token.type === '(') {
      const inner = parseAssignment()
      expect(')')
      return inner
    }
    throw new ExpressionError(`Símbolo inesperado "${token.type}"`, source)
  }

  if (tokens.length === 0) throw new ExpressionError('Expressão vazia', source)
  const tree = parseAssignment()
  if (position < tokens.length) throw new ExpressionError('Sobrou texto depois da expressão', source)
  return tree
}

/**
 * Onde um nome é procurado: primeiro nos valores locais (`$event`), depois em
 * cada escopo da lista (`$scope`, `$rootScope`), na ordem.
 */
function findOwner(name, scopes, locals) {
  if (locals && name in locals) return locals
  return scopes.find((scope) => name in scope)
}

function safeKey(key, source) {
  if (FORBIDDEN_KEYS.has(String(key))) {
    throw new ExpressionError(`Acesso a "${key}" não é permitido`, source)
  }
  return key
}

function evaluate(node, context) {
  switch (node.type) {
    case 'literal':
      return node.value
    case 'identifier':
      return findOwner(safeKey(node.name, context.source), context.scopes, context.locals)?.[node.name]
    case 'member': {
      const object = evaluate(node.object, context)
      if (object == null) return undefined
      return object[safeKey(evaluate(node.property, context), context.source)]
    }
    case 'not':
      return !evaluate(node.argument, context)
    case 'call':
      return call(node, context)
    case 'assignment': {
      const value = evaluate(node.value, context)
      write(node.target, value, context)
      return value
    }
  }
}

function call(node, context) {
  const { callee } = node
  let receiver
  let fn
  if (callee.type === 'member') {
    receiver = evaluate(callee.object, context)
    fn = receiver?.[safeKey(evaluate(callee.property, context), context.source)]
  } else {
    receiver = callee.type === 'identifier' ? findOwner(callee.name, context.scopes, context.locals) : undefined
    fn = evaluate(callee, context)
  }
  if (typeof fn !== 'function') {
    throw new ExpressionError('Tentou chamar algo que não é função', context.source)
  }
  return fn.apply(receiver, node.arguments.map((argument) => evaluate(argument, context)))
}

function write(target, value, context) {
  if (target.type === 'identifier') {
    const owner = context.scopes.find((scope) => target.name in scope) ?? context.scopes[0]
    owner[safeKey(target.name, context.source)] = value
    return
  }
  const key = safeKey(evaluate(target.property, context), context.source)
  let object = evaluate(target.object, context)
  if (object == null) {
    // `user.name = 'x'` com `user` ainda indefinido cria o objeto no caminho.
    object = {}
    write(target.object, object, context)
    object = evaluate(target.object, context)
  }
  object[key] = value
}

const cache = new Map()

/**
 * Compila o texto de um atributo `jo-*`.
 * @param {string} source
 * @returns {{
 *   source: string,
 *   isReference: boolean,
 *   isAssignable: boolean,
 *   evaluate: (scopes: object[], locals?: object) => unknown,
 *   assign: (scopes: object[], value: unknown) => void,
 * }}
 */
export function compile(source) {
  const cached = cache.get(source)
  if (cached) return cached

  const tree = parse(source)
  const isAssignable = tree.type === 'identifier' || tree.type === 'member'
  const compiled = {
    source,
    /** `add` ou `user.save`: um caminho sem chamada, como o jo-click de 2015 usava. */
    isReference: isAssignable,
    isAssignable,
    evaluate: (scopes, locals) => evaluate(tree, { scopes, locals, source }),
    assign(scopes, value) {
      if (!isAssignable) throw new ExpressionError('Não dá para escrever nesta expressão', source)
      write(tree, value, { scopes, source })
    },
  }
  cache.set(source, compiled)
  return compiled
}
