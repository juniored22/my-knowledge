# my-knowledge
my knowledge



## Estrutura de Diretórios

~~~bash
.
├── app/
│   ├── src/
│   │   ├── handlers/
│   │   ├── routes/
│   │   └── utils/
│   └── target/
├── Docs/
└── web/
    └── public/
        ├── css/
        ├── libs/
        ├── models/
        ├── modules/
        ├── pages/
        ├── shared/
        └── utils/
~~~

### Descrição Geral

- **app/**
  - **src/**: Código-fonte principal do back-end em Rust.
    - **handlers/**: Funções que processam requisições específicas.
    - **routes/**: Definição de rotas e endpoints.
    - **utils/**: Funções e utilitários de apoio.
  - **target/**: Gerado automaticamente pelo Cargo (compilações, artefatos e metadados do projeto).

- **Docs/**
  - Pasta dedicada à documentação ou arquivos de especificação do projeto.

- **web/**
  - **public/**: Arquivos estáticos para a interface web (HTML, CSS, JS).
    - **css/**: Arquivos de estilo (CSS).
    - **libs/**: Bibliotecas externas (Three.js, MediaPipe, etc.).
    - **models/**: Modelos 3D ou outros ativos de mídia.
    - **modules/**: Módulos de frontend.
    - **pages/**: Páginas do projeto ou protótipos.
    - **shared/**: Recursos ou componentes reutilizáveis no front-end.
    - **utils/**: Funções/utilitários de apoio ao front-end.


# Estrutura dos Arquivos do Projeto (Exemplo)

A seguir está uma árvore de diretórios que mostra os arquivos que você desenvolveu para a lógica do seu projeto. **Atenção:** Os nomes dos arquivos abaixo são exemplos. Caso seus arquivos tenham nomes diferentes, substitua-os conforme necessário.

~~~bash
.
├── app
│   └── src
│       ├── handlers
│       │   ├── auth_handler.rs   # Arquivo que contém a lógica de autenticação
│       │   └── data_handler.rs   # Arquivo que gerencia o processamento de dados
│       ├── routes
│       │   ├── api_routes.rs     # Define os endpoints da API
│       │   └── web_routes.rs     # Define as rotas para o lado web
│       └── utils
│           ├── logger.rs         # Funções utilitárias para logging
│           └── helper.rs         # Funções auxiliares gerais
├── Docs
│   └── project_spec.md         # Documentação e especificações do projeto
└── web
    └── public
        ├── css
        │   └── main.css        # Arquivo principal de estilos CSS
        ├── models
        │   └── logo.svg        # Arquivo de imagem/modelo (logo, por exemplo)
        ├── pages
        │   └── sandboxBKP
        │       ├── index.html  # Página HTML de protótipo ou teste
        │       └── app.js      # Arquivo JavaScript para a página de sandbox
        ├── shared
        │   └── header.html     # Componente compartilhado (ex: cabeçalho)
        └── utils
            └── validator.js    # Script utilitário para validação no front-end
~~~

## Explicação

- **app/src:**  
  Esta pasta contém o código-fonte do back-end que você desenvolveu em Rust. Os diretórios estão organizados para separar os _handlers_ (tratadores de requisições), _routes_ (definições das rotas da aplicação) e _utils_ (utilitários e funções auxiliares).

- **Docs:**  
  Contém a documentação do projeto, onde você pode armazenar especificações, planos e outras informações importantes.

- **web/public:**  
  Abriga os arquivos do front-end desenvolvidos por você, como arquivos CSS, HTML, JavaScript e recursos visuais (imagens, modelos etc.).  
  - Dentro de `pages`, o diretório `sandboxBKP` pode ser usado para protótipos ou testes que não fazem parte do fluxo principal da aplicação.



# Modules in the Web Project

Below is the listing of your module files located in the `web/public/modules` directory, including the files in the main folder and those inside the subdirectory `_`:

~~~bash
web/public/modules
├── Camera.mjs
├── DeviceOrientationControls.mjs
├── Floor.mjs
├── Game.mjs
├── Gui.mjs
├── Lights.mjs
├── Localization.mjs
├── Material.mjs
├── OBJLoader.js
├── OrbitControls.js
├── RectAreaLightHelper.mjs
├── RectAreaLightTexturesLib.mjs
├── RectAreaLightUniformsLib.mjs
├── Render.mjs
├── THREE.MeshLine.js
├── webSocket.mjs
├── worker.mjs
└── _ 
    ├── DeviceOrientationControls_deprecated.mjs
    ├── Game copy 2.mjs
    ├── Game copy.mjs
    ├── Game.mjs
    └── webSocket.mjs
~~~

## Explanation

- **Main Modules:**  
  These files in the root of `web/public/modules` contain your core module logic (e.g., handling camera, controls, rendering, etc.).

- **Subdirectory `_`:**  
  This folder holds additional module files. They might be alternate or legacy versions of your module logic (for example, a deprecated control implementation or different copies/versions of the Game module).

This structure shows all the module files you developed for your project’s front-end logic.
