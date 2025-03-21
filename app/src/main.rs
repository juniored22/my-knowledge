use axum::{
    routing::{get,post},
    response::Html,
    Router,
    Json
};

use std::{fs, path::PathBuf};
use serde::Deserialize;
use tower_http::services::ServeDir;

#[derive(Deserialize, Debug)]
struct CreateUser {
    name: String,
    email: String,
}

async fn home() -> Html<String> {
    let path = match std::env::current_dir() {
        Ok(mut dir) => {
            dir.push("public/index.html");
            dir
        }
        Err(e) => {
            eprintln!("Erro ao obter o diretório atual: {}", e);
            // retorna um path "falso" que falhará no read_to_string abaixo
            PathBuf::from("public/index.html")
        }
    };

    println!("Lendo arquivo HTML de: {}", path.display());

    match fs::read_to_string(&path) {
        Ok(html) => Html(html),
        Err(e) => {
            eprintln!("Erro ao ler index.html: {}", e);
            Html("<h1>Erro ao carregar index.html</h1>".to_string())
        }
    }
}

async fn create_user(Json(payload): Json<CreateUser>) {
    // println!("Novo usuário: {:?}", payload);
    println!("Criando usuário: {} ({})", payload.name, payload.email);
    // ou use os dados normalmente
    // println!("Nome: {}", payload.name);
}

async fn get_foo() -> &'static str {"foo"}


#[tokio::main]
async fn main() {
    // build our application with a single route
    let app = Router::new()
    .route("/", get(home))
    .route("/comandos",     get(|| async { 

        r#"Use o comando:

        curl -X POST http://localhost:3000/users \
          -H "Content-Type: application/json" \
          -d '{"name":"João", "email":"joao@email.com"}'
        "#
        
    }))
    .route("/foo",  get(get_foo))
    .route("/users", post(create_user))
    // Serve arquivos estáticos como /style.css ou /script.js
    .nest_service("/libs", ServeDir::new("public/libs/node_modules"))
    .nest_service("/static", ServeDir::new("public"));


    // run our app with hyper, listening globally on port 3000
    let listener = tokio::net::TcpListener::bind("0.0.0.0:3000").await.unwrap();

    println!("{:?}", listener);

    axum::serve(listener, app).await.unwrap();
}