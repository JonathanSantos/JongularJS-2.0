// Entrada do bundle clássico (`<script src="jongularJS.2.0.js">`): expõe o
// global `jongular`, como o arquivo de 2015 fazia com `global.jongular = jongular`.
import { jongular } from './index.js'

globalThis.jongular = jongular
