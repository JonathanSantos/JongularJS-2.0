# JongularJS

> “Minha criação baseado o conceito do angular”
> (o README inteiro do projeto em 7 de agosto de 2015)

**JongularJS** é um mini framework no espírito do AngularJS 1.x: você marca o HTML com atributos `jo-*`, registra controllers que recebem um `$scope`, e a tela acompanha o que você atribui nele. Foi escrito em quatro dias de agosto de 2015, em 293 linhas, sem dependências.

Este repositório guarda duas coisas lado a lado:

- **o código original de 2015**, intocado, em [`original/`](original/);
- **a versão 2.0**, de 2026, em [`src/`](src/): a mesma API e os mesmos atributos, com o motor refeito para os navegadores de hoje.

> [!NOTE]
> O projeto nasceu no meu perfil antigo do GitHub, [**@JonathanSantos-zz**](https://github.com/JonathanSantos-zz), em [JonathanSantos-zz/JongularJS](https://github.com/JonathanSantos-zz/JongularJS). Este repositório, [JonathanSantos/JongularJS-2.0](https://github.com/JonathanSantos/JongularJS-2.0), é a continuação dele no meu perfil atual, [@JonathanSantos](https://github.com/JonathanSantos). O histórico de commits de 2015 foi preservado: os primeiros commits daqui são os de lá.

O relatório completo, com o código de 2015 rodando ao vivo sobre o motor novo, está em [`index.html`](index.html). Abra o arquivo direto no navegador (não precisa de servidor). Uma versão em texto dele fecha este README.

## Uso

Do jeito de 2015, com um `<script>`:

```html
<html jo-app="myApp">
<body>
  <div jo-controller="testController">
    Usuario: <span jo-model="user"></span><br>
    <input type="text" jo-model="user">
    <button jo-click="reset">limpar</button>
  </div>

  <script src="dist/jongularJS.2.0.min.js"></script>
  <script>
    var app = jongular.module('myApp');

    app.controller('testController', function ($scope) {
      $scope.user = 'Jonathan';
      $scope.reset = function () { $scope.user = ''; };

      setTimeout(function () { $scope.user = 'Rafael'; }, 3000);
    });
  </script>
</body>
</html>
```

Ou como módulo ES:

```js
import jongular from './src/index.js'

const app = jongular.module('myApp')

app.service('greeter', function () {
  this.greet = (name) => `Olá, ${name}`
})

app.controller('profileController', ($scope, greeter) => {
  $scope.user = { name: 'Jonathan' }
  $scope.greeting = () => greeter.greet($scope.user.name)
})
```

### Atributos

| Atributo | O que faz |
|---|---|
| `jo-app="nome"` | Marca a raiz do módulo criado com `jongular.module('nome')`. |
| `jo-controller="nome"` | Liga o trecho ao `$scope` do controller. Elementos com o mesmo nome dividem um escopo. |
| `jo-model="expressão"` | Mostra o valor. Em `input`, `textarea` e `select`, é de mão dupla. |
| `jo-click="expressão"` | Executa no clique: `add`, `add(10)`, `count = 0`, `save($event)`. |
| `jo-init="expressão"` | Executa uma vez na inicialização: `jo = 'Jonathan'`, `load()`. |

Expressões aceitam nomes, caminhos (`user.name`, `items[0].title`), chamadas com argumentos, `!`, atribuição e literais. Não há `eval`.

### API

| Chamada | Descrição |
|---|---|
| `jongular.module(nome)` | Cria um módulo e agenda o bootstrap para quando o DOM estiver pronto. |
| `app.controller(nome, fn)` | Registra um controller. `fn` recebe o que pedir pelo nome: `$scope`, `$rootScope`, `$http` ou serviços. |
| `app.service(nome, fn)` | Registra um serviço, criado uma vez, no primeiro pedido. Pode ser função construtora, fábrica ou classe. |
| `jongular.directive(nome, fn)` | Registra uma diretiva `jo-<nome>`. |
| `app.scope(nome)` | O `$scope` de um controller (útil no console e em testes). |
| `app.bootstrap(raiz?)` · `app.destroy()` | Liga e desliga à mão. |
| `$http.get/post/put/delete(url, opções)` | Devolve Promise. Aceita `data`, `headers`, `onSuccess`, `onError` e o `onSucess` de 2015. |

Para código minificado, declare as dependências em array: `app.controller('c', ['$scope', '$http', function (a, b) {}])`.

Uma diretiva nova:

```js
jongular.directive('show', ({ element, evaluate, effect }) => {
  effect(() => {
    element.hidden = !evaluate()
  })
})
```

## O que tem no repositório

```
original/                     o código de 2015, como estava
├── JongularJS.js             a biblioteca (293 linhas)
├── index.html                a demo do master
├── README.md                 o README de uma linha
└── branch-JongularJS.js/     a demo maior, do branch JongularJS.js
src/                          a versão 2.0
├── reactivity.js             reactive() e effect() com Proxy
├── expression.js             interpretador dos atributos jo-*
├── injector.js               injeção de dependências
├── http.js                   $http sobre fetch
├── directives.js             registro e jo-model, jo-click, jo-init
├── module.js                 controllers, serviços, bootstrap
├── index.js                  a fachada `jongular`
└── global.js                 entrada do bundle para <script>
dist/                         jongularJS.2.0.js e .min.js (gerados)
examples/                     um exemplo moderno e a demo de 2015 sobre a 2.0
test/                         58 testes (node:test + jsdom)
vendor/jonacode/              o editor Jonacode, usado no relatório
index.html                    o relatório
```

## Desenvolvimento

```bash
npm install
```

```bash
npm run build
```

```bash
npm test
```

Para abrir os exemplos que usam módulos ES é preciso um servidor estático (`npm run serve` e depois `http://localhost:4173/examples/`). O relatório e `examples/2015/` abrem direto do disco.

## Licença

GPL-2.0, a mesma escolhida em 2015. O [Jonacode](https://github.com/JonathanSantos/jonacode) em `vendor/` é MIT.

---

# Relatório: JongularJS, 2015 → 2026

*Versão em texto de [`index.html`](index.html). Lá os trechos são destacados pelo [Jonacode](https://github.com/JonathanSantos/jonacode), meu editor de código, e a demo de 2015 roda ao vivo num editor.*

## Quanto tempo tem

O primeiro commit é de **sexta-feira, 7 de agosto de 2015, 16:05**. Em 10 de novembro de 2026 o projeto tinha **11 anos, 3 meses e 3 dias** (4.113 dias). O histórico inteiro cabe em quatro dias:

| Quando | Commit | O que aconteceu |
|---|---|---|
| sex 07/08/2015 16:05 | `50ba2d0` | Initial commit. |
| sex 07/08/2015 17:08 | `4758d64` | A página de teste, com `jo-app`, `jo-controller` e dois `jo-model`. |
| sex 07/08/2015 17:09 | `d91f516` | Primeira versão da biblioteca: 109 linhas. Já tem módulo, controller, leitura do nome `$scope` e a tela reagindo a `Object.observe`. Pouco mais de uma hora depois do commit inicial. |
| ter 11/08/2015 09:10 | `1ebae96` (branch) | Cresce para 293 linhas: registro de diretivas, `jo-click`, `jo-init`, input de mão dupla, serviços, `$rootScope` e `$http`. |
| ter 11/08/2015 09:16 | `574f4c4` (branch) | Uma demo maior, que aponta para `jongularJS.2.0.js`. Esse arquivo nunca foi commitado. |
| ter 11/08/2015 10:29 | `d003baf` | O mesmo código entra no master (+209 −25). Último commit. |

### O que estava acontecendo em volta

- **AngularJS 1.4** tinha saído em maio e era o padrão de mercado. A atualização de tela dependia do ciclo de *digest*: mudar o `$scope` dentro de um `setTimeout` não atualizava nada sem `$apply` ou `$timeout`.
- **ES2015** tinha sido aprovado em junho, dois meses antes. O arquivo é ES5 puro: `var`, IIFE e `prototype`.
- **`Object.observe`** estava no Chrome desde a versão 36 (2014) e era a aposta da época para data binding sem dirty checking. A proposta foi retirada em novembro de 2015, três meses depois deste código, e a API saiu do Chrome 50 em 2016.
- **`Proxy`**, o substituto natural, chegou ao Chrome 49 em março de 2016. O Vue adotou a ideia no Vue 3, em 2020.
- **`fetch`** já existia no Chrome 42, mas quase ninguém confiava nele ainda.

## O que tem de bom no código de 2015

Em 293 linhas ele reproduz as quatro ideias centrais do AngularJS (módulo, controller com escopo, diretivas em atributos e injeção de dependências) e, em uma delas, vai além do original.

### 1. Reatividade sem digest

O AngularJS comparava valores antigos e novos a cada ciclo. Aqui o `$scope` é um objeto comum vigiado por `Object.observe`, e cada mudança vai direto ao elemento certo:

```js
// original/JongularJS.js, linhas 248–250
Object.observe(this.groups[name].$scope, function(a){
	__refresh__(name, a[0].name, a[0].object[a[0].name]);
});
```

A consequência aparece na própria demo: `setTimeout(function(){ $scope.user = 'Rafael' }, 3000)` atualiza a tela sozinho. No AngularJS de 2015 essa mesma linha não faria nada visível. A equipe do Angular planejava usar essa API no futuro; este código já usava.

### 2. Injeção de dependências pelo nome do parâmetro

```js
// original/JongularJS.js, linha 205
var attr = fn.toString().replace(/\n/g, '').replace(/ /g,'').replace(/function.*?\((.*?)\).*/, '$1').split(',');
```

A função é convertida em texto e os nomes dos parâmetros saem por regex. É o mesmo truque do `$injector.annotate` do AngularJS, reescrito de cabeça em uma linha.

### 3. Diretivas como um registro

Na versão de sexta, o `jo-model` estava escrito direto no laço principal. Na terça ele virou uma entrada de um objeto `modules`, e o laço passou a procurar `'jo-' + nome` para cada entrada. Criar `jo-click` e `jo-init` depois disso foi só acrescentar funções:

```js
// original/JongularJS.js, linhas 74–82
modules['click'] = function joClick(element){
	var attr = element.attribute;
	var elements = element.element;
	var $scope = element.$scope;

	try{
		elements.addEventListener('click', eval('$scope.' + attr));
	}catch(err){console.error(err.message);}
};
```

### 4. O dialeto de 2015

IIFE recebendo o global como parâmetro, `'use strict'` no topo, um `_$` que embrulha `querySelectorAll` e o idioma `Jongular.fn = Jongular.prototype`, herdado do jQuery. Zero dependências, um `<script>` e pronto.

### 5. Um `$http` que cobre do IE6 ao futuro

O serviço HTTP traz o fallback para `ActiveXObject("Microsoft.XMLHTTP")`. Ele convive, no mesmo arquivo, com `Object.observe`, que só existia no Chrome 36 em diante. O IE6 nunca chegaria àquela linha, mas o cuidado está lá, junto com o `onSucess` escrito com um “c” só. A 2.0 aceita essa grafia de propósito.

### 6. Pensado para brincar no console

A demo guarda o escopo numa global (`test = $scope`). Com a página aberta, digitar `test.user = 'outro nome'` no console mudava a tela na hora. Esse comportamento virou um dos testes da 2.0.

## O que o tempo cobrou

| Ponto | No original | Na 2.0 |
|---|---|---|
| API extinta | L248: `Object.observe` saiu dos navegadores em 2016. Hoje o arquivo lança `TypeError: Object.observe is not a function` no primeiro controller. | `Proxy` com rastreamento de leitura. |
| Só a primeira mudança | L249: o observador lê apenas `a[0]`. | Escritas do mesmo tick viram uma execução com o valor final. |
| Só o primeiro nível | L55–62: `jo-model="user.name"` desenha uma vez e não acompanha. | Reatividade em profundidade. |
| `eval` | L23, L58, L80, L217, L224. | Interpretador próprio, compatível com CSP. |
| `jo-click="fn()"` | L80: com parênteses, a função roda no carregamento. | Referência e chamada funcionam, com `$event`. |
| `jo-init="fn()"` | L22–23: os parênteses são removidos, a função é lida e não chamada. | Atribuição, chamada ou referência executam. |
| Argumentos deslocados | L229–242: o teste `check != 0` está invertido. | Erro claro: `Dependência desconhecida: "$x", pedida por "ctrl"`. |
| Ordem de registro | L217, L245: o controller roda na hora do registro. | Controllers rodam no bootstrap; serviços, quando pedidos. |
| Input | L37, L143: só `type="text"`, três eventos de teclado, volta para o campo comentada. | Evento `input`, ida e volta, e checkbox, radio, number, select, textarea. |
| Controllers aninhados | L166: um elemento dentro de dois controllers é ligado aos dois. | Pertence ao mais próximo. |
| `$http` | L95–100, L124–125: `onSucess` dispara a cada `readystatechange`; o POST não envia corpo. | `fetch`, Promise, corpo em JSON, callback uma vez. |
| Maiúsculas | `index.html` pede `jongularJS.js`; o arquivo é `JongularJS.js`. Dá 404 no Linux. | HTML original mantido; os testes respondem ao nome pedido. |

## O que foi refeito

A regra foi uma só: **quem escreveu código para o Jongular em 2015 não muda nada**. O global `jongular`, `module()`, `controller()`, `service()`, os atributos `jo-*`, o `$scope` como objeto comum, o bootstrap automático, um escopo por nome de controller e os campos do objeto que as diretivas recebem continuam iguais. As duas páginas de demo de 2015 rodam sem alteração sobre `dist/jongularJS.2.0.js`, e isso é um teste automatizado.

**Reatividade.** `Object.observe` deu lugar a `Proxy`. O ritmo é o mesmo de 2015 (mudanças em lote, num microtask). A direção mudou: antes cada mudança procurava no documento os elementos com aquele nome; agora cada diretiva é um efeito que registra o que leu, e uma escrita reagenda só quem leu aquela chave.

```js
// src/reactivity.js
get(target, key, receiver) {
  const value = Reflect.get(target, key, receiver)
  if (typeof key === 'symbol') return value
  track(target, key)
  return reactive(value)
},
```

**Expressões.** `eval('$scope.' + attr)` deu lugar a um interpretador com tokenizador, árvore e avaliação, que entende o vocabulário que os atributos de 2015 usavam. Acesso a `constructor`, `__proto__` e `prototype` é recusado.

**Injeção.** Ler o nome dos parâmetros continua sendo o jeito principal, e agora entende arrow functions, `async`, valores padrão, comentários e classes. Para código minificado existem a notação em array e `$inject`. Serviços são instanciados uma vez, no primeiro pedido, e podem depender uns dos outros.

**Diretivas.** O registro ficou público (`jongular.directive`). A diretiva recebe os cinco campos de 2015 (`attribute`, `element`, `name`, `controller`, `$scope`) e cinco ferramentas novas (`evaluate`, `assign`, `run`, `effect`, `listen`).

**`$http`.** `fetch` e Promise por fora; `onSucess` e `onSuccess` continuam aceitos.

**Organização.** Um arquivo virou sete módulos ES. Quatro não conhecem o DOM e são testados sem navegador.

## Design patterns

| Padrão | Em 2015 | Na 2.0 | O que melhorou |
|---|---|---|---|
| Module | IIFE com `global` injetado | Módulos ES e um bundle IIFE gerado | Partes importáveis e testáveis; o uso antigo continua. |
| Facade | O objeto `jongular` | `src/index.js` | Mesma superfície, com `directive` e `version`. |
| Factory Method | `jongular.module(name)` | Igual, e agenda o bootstrap | Funciona com script carregado depois da página. |
| Registry + Strategy | `modules['click']` | `directive()` e os adaptadores de campo do `jo-model` | Extensão pública. |
| Observer | `Object.observe` | `reactive()` + `effect()` | Assinatura por leitura, em profundidade, com lote. |
| Dependency Injection | `fn.toString()` + `eval` | `createInjector()` | Erros com nome, ciclo detectado, três formas de anotar. |
| Singleton preguiçoso | não havia | Serviço instanciado no primeiro pedido | Ordem de registro deixa de importar. |
| Interpreter | `eval` | `compile()` | Seguro, com mensagem que cita a expressão. |
| Adapter | XHR ou ActiveX atrás de `$http` | Callbacks de 2015 sobre `fetch` | As duas gerações de API convivem. |
| Núcleo funcional, casca imperativa | tudo no mesmo laço | Quatro módulos sem DOM, dois com | A lógica difícil é testada sem navegador. |

### O que ficou de fora, de propósito

Filtros, `jo-repeat`, rotas e componentes não existiam em 2015 e não foram acrescentados. Duas mudanças de comportamento merecem aviso: o controller agora roda quando o DOM fica pronto, e não na linha do `app.controller()`; e um serviço é instanciado antes de ser entregue, quando antes o controller recebia a função crua.

## Evidências

| Medida | 2015 | 2.0 |
|---|---|---|
| Código | 293 linhas, 1 arquivo | 962 linhas com comentários, 7 módulos |
| Tamanho entregue | 6,2 kB (1,8 kB gzip), sem minificar | 11,1 kB minificado (4,7 kB gzip) |
| Dependências em produção | 0 | 0 |
| Testes | a página de demo | 58 automatizados, 58 passando |
| Roda no Chrome 152 | não | sim, conferido nas três páginas de exemplo |
| Usa `eval` | 5 pontos | nenhum |

Medido em 10/11/2026 com Node 22 e jsdom. Os testes de DOM rodam em jsdom; no navegador real a conferência foi manual, no Chrome 152. Firefox e Safari não foram testados.
