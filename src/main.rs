use axum::{
    routing::get,
    Router,
};
use std::net::SocketAddr;

async fn home() -> &'static str {
    "Servidor Rust no GitLab Code!"
}

#[tokio::main]
async fn main() {
    let app = Router::new().route("/", get(home));

    let port: u16 = std::env::var("PORT")
        .unwrap_or_else(|_| "8080".to_string()) // Gitpod usa 8080 por padrão
        .parse()
        .unwrap();

    let addr = SocketAddr::from(([0, 0, 0, 0], port));
    println!("Servidor rodando em http://localhost:{}", port);

    axum::Server::bind(&addr)
        .serve(app.into_make_service())
        .await
        .unwrap();
}
