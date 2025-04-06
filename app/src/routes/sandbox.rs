// app/src/routes/sandbox.rs
use axum::{routing::get, Router};
use crate::handlers::sandbox::sandbox_page;

pub fn sandbox() -> Router {
    Router::new().route("/sandbox", get(sandbox_page))
}