use axum::{response::Html};
use crate::utils::file::load_html; // <- aqui é o acesso ao módulo


pub async fn game_page() -> Html<String> {
    Html(load_html("../web/public/pages/game.html"))
}