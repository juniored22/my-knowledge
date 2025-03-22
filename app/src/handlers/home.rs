
use axum::{response::Html,Json};
use serde::Deserialize;
use crate::utils::file::load_html; // <- aqui é o acesso ao módulo

#[derive(Deserialize, Debug)]
pub struct CreateUser {
    name: String,
    email: String,
}

pub async fn home_page() -> Html<String> {

    Html(load_html("../web/public/index.html"))

}

pub async fn create_user(Json(payload): Json<CreateUser>) {
    // println!("Novo usuário: {:?}", payload);
    println!("Criando usuário: {} ({})", payload.name, payload.email);
    // ou use os dados normalmente
    // println!("Nome: {}", payload.name);
}

pub async fn get_foo() -> &'static str {"foo"}