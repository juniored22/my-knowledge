// app/src/handlers/sandbox.rs

use axum::{response::Html};
use crate::utils::file::load_html; // <- aqui é o acesso ao módulo

pub async fn sandbox_page() -> Html<String> {
    Html(load_html("../web/public/pages/sandbox.html"))
}