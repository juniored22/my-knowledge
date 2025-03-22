// my custom mod
mod handlers;
mod utils;
mod routes;
use routes::all_routes;

// default mod dependencies
use axum::{routing::{get}};
use tower_http::services::ServeDir;




#[tokio::main]
async fn main() {
    // build our application with a single route
    let app = all_routes()
    .route("/comandos",     get(|| async { 

        r#"Use o comando:

        curl -X POST http://localhost:3000/users \
          -H "Content-Type: application/json" \
          -d '{"name":"João", "email":"joao@email.com"}'
        "#
        
    }))
    .nest_service("/libs", ServeDir::new("../web/public/libs/node_modules")) // Serve arquivos estáticos como /style.css ou /script.js ex.  src="/libs/file.js"
    .nest_service("/static", ServeDir::new("../web/public")); // src="/static/script.js"

    // run our app with hyper, listening globally on port 3000
    let listener = tokio::net::TcpListener::bind("0.0.0.0:3000").await.unwrap();

    println!("{:?}", listener);

    axum::serve(listener, app).await.unwrap();
}