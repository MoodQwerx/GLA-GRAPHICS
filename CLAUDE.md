# Claude Code

Las instrucciones permanentes de este repositorio son neutrales a la herramienta.

Antes de trabajar:

1. Leer [`AGENTS.md`](AGENTS.md).
2. Seguir la autoridad normativa de [`.agents/global-rules.md`](.agents/global-rules.md).
3. Cargar únicamente el workflow y los roles relevantes según [`.agents/README.md`](.agents/README.md).

Este archivo es solo un adaptador para Claude Code. No define reglas adicionales ni reemplaza la documentación común.

Comandos operativos básicos:

```sh
npm install
npm start
```

- Master Control: `http://localhost:4400/master`
- Program: `http://localhost:4400/program`

No hay build step, suite de tests ni linter configurados. No agregar esos componentes salvo pedido explícito.
