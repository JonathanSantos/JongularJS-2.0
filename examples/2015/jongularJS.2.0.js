(() => {
  // src/directives.js
  var registry = /* @__PURE__ */ new Map();
  function directive(name, setup) {
    if (typeof setup !== "function") throw new TypeError(`A diretiva "${name}" precisa ser uma fun\xE7\xE3o`);
    registry.set(name, setup);
  }
  function findDirective(name) {
    return registry.get(name);
  }
  var textAdapter = {
    event: "input",
    read: (element) => element.value,
    write(element, value) {
      const text = value == null ? "" : String(value);
      if (element.value !== text) element.value = text;
    }
  };
  var numberAdapter = {
    event: "input",
    read: (element) => element.value === "" ? null : Number(element.value),
    write: textAdapter.write
  };
  var checkboxAdapter = {
    event: "change",
    read: (element) => element.checked,
    write(element, value) {
      element.checked = Boolean(value);
    }
  };
  var radioAdapter = {
    event: "change",
    read: (element) => element.value,
    write(element, value) {
      element.checked = String(value) === element.value;
    }
  };
  var selectAdapter = { ...textAdapter, event: "change" };
  var INPUT_ADAPTERS = {
    checkbox: checkboxAdapter,
    radio: radioAdapter,
    number: numberAdapter,
    range: numberAdapter
  };
  function pickFieldAdapter(element) {
    if (element.localName === "textarea") return textAdapter;
    if (element.localName === "select") return selectAdapter;
    if (element.localName === "input") return INPUT_ADAPTERS[element.type] ?? textAdapter;
    return null;
  }
  function model({ element, expression, evaluate: evaluate2, assign, effect: effect2, listen }) {
    const field = pickFieldAdapter(element);
    if (!field) {
      effect2(() => {
        const value = evaluate2();
        element.textContent = value == null ? "" : String(value);
      });
      return;
    }
    effect2(() => field.write(element, evaluate2()));
    if (expression.isAssignable) listen(field.event, () => assign(field.read(element)));
  }
  function click({ listen, run }) {
    listen("click", (event) => run({ $event: event }));
  }
  function init({ run }) {
    run();
  }
  directive("model", model);
  directive("click", click);
  directive("init", init);

  // src/expression.js
  var FORBIDDEN_KEYS = /* @__PURE__ */ new Set(["__proto__", "constructor", "prototype"]);
  var LITERALS = /* @__PURE__ */ new Map([
    ["true", true],
    ["false", false],
    ["null", null],
    ["undefined", void 0]
  ]);
  var TOKEN = /\s*(?:(\d+(?:\.\d+)?)|([A-Za-z_$][\w$]*)|'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)"|([.()[\],!=]))/y;
  var ExpressionError = class extends Error {
    constructor(message, source) {
      super(`${message} em "${source}"`);
      this.name = "ExpressionError";
      this.source = source;
    }
  };
  function tokenize(source) {
    const tokens = [];
    TOKEN.lastIndex = 0;
    while (TOKEN.lastIndex < source.length) {
      const start = TOKEN.lastIndex;
      const match = TOKEN.exec(source);
      if (!match) {
        if (source.slice(start).trim() === "") break;
        throw new ExpressionError(`Caractere inesperado na posi\xE7\xE3o ${start}`, source);
      }
      const [, number, identifier, single, double, punctuation] = match;
      if (number !== void 0) tokens.push({ type: "literal", value: Number(number) });
      else if (identifier !== void 0) tokens.push({ type: "identifier", value: identifier });
      else if (punctuation !== void 0) tokens.push({ type: punctuation });
      else tokens.push({ type: "literal", value: unescape(single ?? double) });
    }
    return tokens;
  }
  function unescape(text) {
    return text.replace(/\\(.)/g, "$1");
  }
  function parse(source) {
    const tokens = tokenize(source);
    let position = 0;
    const peek = () => tokens[position];
    const accept = (type) => peek()?.type === type ? tokens[position++] : null;
    const expect = (type) => {
      const token = accept(type);
      if (!token) throw new ExpressionError(`Esperava "${type}"`, source);
      return token;
    };
    function parseAssignment() {
      const left = parseUnary();
      if (!accept("=")) return left;
      if (left.type !== "identifier" && left.type !== "member") {
        throw new ExpressionError("S\xF3 \xE9 poss\xEDvel atribuir a uma propriedade", source);
      }
      return { type: "assignment", target: left, value: parseAssignment() };
    }
    function parseUnary() {
      if (accept("!")) return { type: "not", argument: parseUnary() };
      return parseAccess();
    }
    function parseAccess() {
      let node = parsePrimary();
      for (; ; ) {
        if (accept(".")) {
          const property = expect("identifier").value;
          node = { type: "member", object: node, property: { type: "literal", value: property } };
        } else if (accept("[")) {
          const property = parseAssignment();
          expect("]");
          node = { type: "member", object: node, property };
        } else if (accept("(")) {
          node = { type: "call", callee: node, arguments: parseArguments() };
        } else {
          return node;
        }
      }
    }
    function parseArguments() {
      const list = [];
      if (accept(")")) return list;
      do
        list.push(parseAssignment());
      while (accept(","));
      expect(")");
      return list;
    }
    function parsePrimary() {
      const token = tokens[position++];
      if (!token) throw new ExpressionError("Express\xE3o incompleta", source);
      if (token.type === "literal") return token;
      if (token.type === "identifier") {
        if (LITERALS.has(token.value)) return { type: "literal", value: LITERALS.get(token.value) };
        return { type: "identifier", name: token.value };
      }
      if (token.type === "(") {
        const inner = parseAssignment();
        expect(")");
        return inner;
      }
      throw new ExpressionError(`S\xEDmbolo inesperado "${token.type}"`, source);
    }
    if (tokens.length === 0) throw new ExpressionError("Express\xE3o vazia", source);
    const tree = parseAssignment();
    if (position < tokens.length) throw new ExpressionError("Sobrou texto depois da express\xE3o", source);
    return tree;
  }
  function findOwner(name, scopes, locals) {
    if (locals && name in locals) return locals;
    return scopes.find((scope) => name in scope);
  }
  function safeKey(key, source) {
    if (FORBIDDEN_KEYS.has(String(key))) {
      throw new ExpressionError(`Acesso a "${key}" n\xE3o \xE9 permitido`, source);
    }
    return key;
  }
  function evaluate(node, context) {
    switch (node.type) {
      case "literal":
        return node.value;
      case "identifier":
        return findOwner(safeKey(node.name, context.source), context.scopes, context.locals)?.[node.name];
      case "member": {
        const object = evaluate(node.object, context);
        if (object == null) return void 0;
        return object[safeKey(evaluate(node.property, context), context.source)];
      }
      case "not":
        return !evaluate(node.argument, context);
      case "call":
        return call(node, context);
      case "assignment": {
        const value = evaluate(node.value, context);
        write(node.target, value, context);
        return value;
      }
    }
  }
  function call(node, context) {
    const { callee } = node;
    let receiver;
    let fn;
    if (callee.type === "member") {
      receiver = evaluate(callee.object, context);
      fn = receiver?.[safeKey(evaluate(callee.property, context), context.source)];
    } else {
      receiver = callee.type === "identifier" ? findOwner(callee.name, context.scopes, context.locals) : void 0;
      fn = evaluate(callee, context);
    }
    if (typeof fn !== "function") {
      throw new ExpressionError("Tentou chamar algo que n\xE3o \xE9 fun\xE7\xE3o", context.source);
    }
    return fn.apply(receiver, node.arguments.map((argument) => evaluate(argument, context)));
  }
  function write(target, value, context) {
    if (target.type === "identifier") {
      const owner = context.scopes.find((scope) => target.name in scope) ?? context.scopes[0];
      owner[safeKey(target.name, context.source)] = value;
      return;
    }
    const key = safeKey(evaluate(target.property, context), context.source);
    let object = evaluate(target.object, context);
    if (object == null) {
      object = {};
      write(target.object, object, context);
      object = evaluate(target.object, context);
    }
    object[key] = value;
  }
  var cache = /* @__PURE__ */ new Map();
  function compile(source) {
    const cached = cache.get(source);
    if (cached) return cached;
    const tree = parse(source);
    const isAssignable = tree.type === "identifier" || tree.type === "member";
    const compiled = {
      source,
      /** `add` ou `user.save`: um caminho sem chamada, como o jo-click de 2015 usava. */
      isReference: isAssignable,
      isAssignable,
      evaluate: (scopes, locals) => evaluate(tree, { scopes, locals, source }),
      assign(scopes, value) {
        if (!isAssignable) throw new ExpressionError("N\xE3o d\xE1 para escrever nesta express\xE3o", source);
        write(tree, value, { scopes, source });
      }
    };
    cache.set(source, compiled);
    return compiled;
  }

  // src/http.js
  var HttpError = class extends Error {
    constructor(response) {
      super(`HTTP ${response.status} em ${response.url}`);
      this.name = "HttpError";
      this.response = response;
      this.status = response.status;
    }
  };
  function parseJson(text) {
    try {
      return JSON.parse(text);
    } catch {
      return void 0;
    }
  }
  function encodeBody(data, headers) {
    if (data === void 0 || data === null) return void 0;
    const isPlainData = Array.isArray(data) || Object.getPrototypeOf(data) === Object.prototype;
    if (!isPlainData) return data;
    if (!headers.has("content-type")) headers.set("content-type", "application/json");
    return JSON.stringify(data);
  }
  function createHttp(fetchImplementation) {
    async function send(method, url, options) {
      const doFetch = fetchImplementation ?? globalThis.fetch;
      const headers = new Headers(options.headers);
      const body = encodeBody(options.data, headers);
      const raw = await doFetch(url, { method, headers, body, signal: options.signal });
      const responseText = await raw.text();
      const response = {
        url,
        status: raw.status,
        ok: raw.ok,
        headers: raw.headers,
        responseText,
        data: parseJson(responseText)
      };
      if (!raw.ok) throw new HttpError(response);
      return response;
    }
    function request(method, url, options = {}) {
      const onSuccess = options.onSuccess ?? options.onSucess;
      const { onError } = options;
      const promise = send(method, url, options);
      if (!onSuccess && !onError) return promise;
      promise.then(onSuccess, onError ?? (() => {
      }));
      return promise;
    }
    return {
      request,
      get: (url, options) => request("GET", url, options),
      post: (url, options) => request("POST", url, options),
      put: (url, options) => request("PUT", url, options),
      delete: (url, options) => request("DELETE", url, options)
    };
  }

  // src/injector.js
  var COMMENTS = /\/\*[\s\S]*?\*\/|\/\/.*$/gm;
  var CLASS_CONSTRUCTOR = /\bconstructor\s*\(([^)]*)\)/;
  var PARENTHESIZED_PARAMETERS = /^[^(=]*\(([^)]*)\)/;
  var SINGLE_ARROW_PARAMETER = /^(?:async\s+)?([\w$]+)\s*=>/;
  var InjectionError = class extends Error {
    constructor(message) {
      super(message);
      this.name = "InjectionError";
    }
  };
  function isClass(fn) {
    return /^class\b/.test(Function.prototype.toString.call(fn));
  }
  function parameterNames(fn) {
    const source = Function.prototype.toString.call(fn).replace(COMMENTS, "").trim();
    if (isClass(fn)) return splitParameters(CLASS_CONSTRUCTOR.exec(source)?.[1] ?? "");
    const single = SINGLE_ARROW_PARAMETER.exec(source);
    if (single) return [single[1]];
    return splitParameters(PARENTHESIZED_PARAMETERS.exec(source)?.[1] ?? "");
  }
  function splitParameters(list) {
    return list.split(",").map((parameter) => parameter.split("=")[0].trim()).filter(Boolean);
  }
  function annotate(target) {
    if (Array.isArray(target)) {
      const fn = target.at(-1);
      if (typeof fn !== "function") {
        throw new InjectionError("Na nota\xE7\xE3o em array, o \xFAltimo item precisa ser a fun\xE7\xE3o");
      }
      return { fn, dependencies: target.slice(0, -1) };
    }
    if (typeof target !== "function") {
      throw new InjectionError("Esperava uma fun\xE7\xE3o ou um array [depend\xEAncias..., fun\xE7\xE3o]");
    }
    return { fn: target, dependencies: target.$inject ?? parameterNames(target) };
  }
  function createInjector() {
    const providers = /* @__PURE__ */ new Map();
    const instances = /* @__PURE__ */ new Map();
    const resolving = [];
    function get(name, locals, requester) {
      if (locals && Object.hasOwn(locals, name)) return locals[name];
      if (instances.has(name)) return instances.get(name);
      const provider = providers.get(name);
      if (!provider) {
        throw new InjectionError(`Depend\xEAncia desconhecida: "${name}"${requester ? `, pedida por "${requester}"` : ""}`);
      }
      if (resolving.includes(name)) {
        throw new InjectionError(`Depend\xEAncia circular: ${[...resolving, name].join(" -> ")}`);
      }
      resolving.push(name);
      try {
        const instance = provider();
        instances.set(name, instance);
        return instance;
      } finally {
        resolving.pop();
      }
    }
    function instantiate(target, locals, requester) {
      const { fn, dependencies } = annotate(target);
      const values = dependencies.map((name) => get(name, locals, requester));
      if (isClass(fn)) return new fn(...values);
      const self = Object.create(fn.prototype ?? Object.prototype);
      const returned = fn.apply(self, values);
      const isInstance = returned !== null && (typeof returned === "object" || typeof returned === "function");
      return isInstance ? returned : self;
    }
    return {
      has: (name) => providers.has(name),
      get,
      instantiate,
      /** Registra um valor pronto. */
      value(name, instance) {
        providers.set(name, () => instance);
        instances.delete(name);
      },
      /** Registra um serviço: `target` é injetado e instanciado uma única vez. */
      service(name, target) {
        providers.set(name, () => instantiate(target, void 0, name));
        instances.delete(name);
      }
    };
  }

  // src/reactivity.js
  var ITERATE = /* @__PURE__ */ Symbol("iterate");
  var proxies = /* @__PURE__ */ new WeakMap();
  var originals = /* @__PURE__ */ new WeakMap();
  var subscriptions = /* @__PURE__ */ new WeakMap();
  var activeEffect = null;
  var pendingEffects = /* @__PURE__ */ new Set();
  var flushPromise = null;
  function isObservable(value) {
    if (value === null || typeof value !== "object") return false;
    if (Array.isArray(value)) return true;
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
  }
  function toRaw(value) {
    return originals.get(value) ?? value;
  }
  function track(target, key) {
    if (!activeEffect) return;
    let keys = subscriptions.get(target);
    if (!keys) subscriptions.set(target, keys = /* @__PURE__ */ new Map());
    let effects = keys.get(key);
    if (!effects) keys.set(key, effects = /* @__PURE__ */ new Set());
    effects.add(activeEffect);
    activeEffect.dependencies.add(effects);
  }
  function trigger(target, key) {
    const effects = subscriptions.get(target)?.get(key);
    if (!effects) return;
    for (const runner of effects) {
      if (runner !== activeEffect) schedule(runner);
    }
  }
  function schedule(runner) {
    pendingEffects.add(runner);
    flushPromise ??= Promise.resolve().then(flush);
  }
  function flush() {
    flushPromise = null;
    const batch = [...pendingEffects];
    pendingEffects.clear();
    for (const runner of batch) runner.run();
  }
  var handlers = {
    get(target, key, receiver) {
      const value = Reflect.get(target, key, receiver);
      if (typeof key === "symbol") return value;
      track(target, key);
      return reactive(value);
    },
    has(target, key) {
      track(target, key);
      return Reflect.has(target, key);
    },
    ownKeys(target) {
      track(target, ITERATE);
      return Reflect.ownKeys(target);
    },
    set(target, key, value, receiver) {
      const existed = Object.hasOwn(target, key);
      const previous = target[key];
      const next = toRaw(value);
      const succeeded = Reflect.set(target, key, next, receiver);
      if (!existed) {
        trigger(target, ITERATE);
        if (Array.isArray(target)) trigger(target, "length");
      }
      if (!existed || !Object.is(previous, next)) trigger(target, key);
      return succeeded;
    },
    deleteProperty(target, key) {
      const existed = Object.hasOwn(target, key);
      const succeeded = Reflect.deleteProperty(target, key);
      if (existed && succeeded) {
        trigger(target, key);
        trigger(target, ITERATE);
      }
      return succeeded;
    }
  };
  function reactive(target) {
    if (!isObservable(target)) return target;
    if (originals.has(target)) return target;
    let proxy = proxies.get(target);
    if (!proxy) {
      proxy = new Proxy(target, handlers);
      proxies.set(target, proxy);
      originals.set(proxy, target);
    }
    return proxy;
  }
  function effect(fn, options = {}) {
    const runner = {
      active: true,
      dependencies: /* @__PURE__ */ new Set(),
      run() {
        if (!runner.active) return;
        unsubscribe(runner);
        const outerEffect = activeEffect;
        activeEffect = runner;
        try {
          fn();
        } catch (error) {
          if (!options.onError) throw error;
          options.onError(error);
        } finally {
          activeEffect = outerEffect;
        }
      }
    };
    runner.run();
    return () => {
      runner.active = false;
      unsubscribe(runner);
      pendingEffects.delete(runner);
    };
  }
  function unsubscribe(runner) {
    for (const effects of runner.dependencies) effects.delete(runner);
    runner.dependencies.clear();
  }

  // src/module.js
  var PREFIX = "jo-";
  var STRUCTURAL_ATTRIBUTES = /* @__PURE__ */ new Set(["jo-app", "jo-controller"]);
  function report(error, context) {
    console.error(`[jongular] ${context}: ${error?.message ?? error}`);
  }
  function createScope() {
    return reactive(/* @__PURE__ */ Object.create(null));
  }
  function selfAndDescendants(root, selector) {
    const found = [...root.querySelectorAll(selector)];
    if (root.matches?.(selector)) found.unshift(root);
    return found;
  }
  var Module = class {
    #injector = createInjector();
    #state = "idle";
    #stops = [];
    /** @param {string} name o mesmo nome usado em `jo-app="..."` */
    constructor(name) {
      if (!name) throw new TypeError("jongular.module(name): informe o nome usado em jo-app");
      this.name = name;
      this.controllers = /* @__PURE__ */ new Map();
      this.$rootScope = createScope();
      this.#injector.value("$rootScope", this.$rootScope);
      this.#injector.value("$http", createHttp());
    }
    get state() {
      return this.#state;
    }
    /**
     * Registra um controller. Ele roda no bootstrap, uma vez, e o `$scope` dele
     * é compartilhado por todos os elementos `jo-controller` com esse nome.
     */
    controller(name, target) {
      annotate(target);
      this.controllers.set(name, { name, target, $scope: null });
      return this;
    }
    /** Registra um serviço injetável pelo nome. É criado só quando alguém pede. */
    service(name, target) {
      annotate(target);
      this.#injector.service(name, target);
      return this;
    }
    /** O `$scope` de um controller já iniciado (útil no console e nos testes). */
    scope(controllerName) {
      return this.controllers.get(controllerName)?.$scope ?? void 0;
    }
    /**
     * Liga o módulo ao DOM. É chamado sozinho quando a página termina de
     * carregar; chame à mão para escolher a raiz ou em testes.
     * @param {Element} [root] padrão: o elemento com `jo-app="<name>"`
     */
    bootstrap(root = globalThis.document?.querySelector(`[jo-app="${this.name}"]`)) {
      if (this.#state === "running") return this;
      if (!root) {
        console.warn(`[jongular] Nenhum elemento com jo-app="${this.name}" foi encontrado`);
        return this;
      }
      this.#state = "running";
      for (const element of selfAndDescendants(root, "[jo-controller]")) {
        this.#startController(element.getAttribute("jo-controller"));
      }
      for (const element of selfAndDescendants(root, "*")) {
        this.#bindElement(element, root);
      }
      return this;
    }
    /** Desliga efeitos e eventos e descarta os escopos. */
    destroy() {
      for (const stop of this.#stops) stop();
      this.#stops = [];
      for (const definition of this.controllers.values()) definition.$scope = null;
      this.#state = "destroyed";
    }
    #startController(name) {
      const definition = this.controllers.get(name);
      if (!definition) {
        console.warn(`[jongular] Controller "${name}" est\xE1 no HTML mas n\xE3o foi registrado`);
        return;
      }
      if (definition.$scope) return;
      definition.$scope = createScope();
      try {
        this.#injector.instantiate(definition.target, { $scope: definition.$scope }, name);
      } catch (error) {
        report(error, `controller "${name}"`);
      }
    }
    #bindElement(element, root) {
      for (const { name: attributeName, value } of [...element.attributes]) {
        if (!attributeName.startsWith(PREFIX) || STRUCTURAL_ATTRIBUTES.has(attributeName)) continue;
        const directiveName = attributeName.slice(PREFIX.length);
        const setup = findDirective(directiveName);
        if (!setup) {
          console.warn(`[jongular] Diretiva desconhecida: ${attributeName}`);
          continue;
        }
        const owner = element.closest("[jo-controller]");
        const controllerName = owner && root.contains(owner) ? owner.getAttribute("jo-controller") : null;
        const $scope = controllerName ? this.scope(controllerName) : this.$rootScope;
        if (!$scope) continue;
        const context = `${attributeName}="${value}"${controllerName ? ` em ${controllerName}` : ""}`;
        try {
          setup(this.#createBinding({ element, value, directiveName, controllerName, $scope, context }));
        } catch (error) {
          report(error, context);
        }
      }
    }
    #createBinding({ element, value, directiveName, controllerName, $scope, context }) {
      const expression = compile(value);
      const scopes = $scope === this.$rootScope ? [$scope] : [$scope, this.$rootScope];
      const stops = this.#stops;
      const onError = (error) => report(error, context);
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
          const result = expression.evaluate(scopes, locals);
          const isFunctionReference = expression.isReference && typeof result === "function";
          return isFunctionReference ? result.call($scope, locals?.$event) : result;
        },
        effect(fn) {
          stops.push(effect(fn, { onError }));
        },
        listen(type, handler) {
          const guarded = (event) => {
            try {
              handler(event);
            } catch (error) {
              onError(error);
            }
          };
          element.addEventListener(type, guarded);
          stops.push(() => element.removeEventListener(type, guarded));
        }
      };
    }
  };

  // src/index.js
  var VERSION = "2.0.0";
  function whenDocumentIsReady(callback) {
    const { document } = globalThis;
    if (!document) return;
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", callback, { once: true });
      return;
    }
    setTimeout(callback);
  }
  var jongular = {
    version: VERSION,
    /** Todos os módulos criados, como no original. */
    app: [],
    /**
     * Cria um módulo e agenda o bootstrap dele para quando o DOM estiver pronto.
     * @param {string} name o valor de `jo-app` no HTML
     */
    module(name) {
      const app = new Module(name);
      this.app.push(app);
      whenDocumentIsReady(() => {
        if (app.state === "idle") app.bootstrap();
      });
      return app;
    },
    /** Registra uma diretiva `jo-<name>` para todos os módulos. */
    directive
  };

  // src/global.js
  globalThis.jongular = jongular;
})();
