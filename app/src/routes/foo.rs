use axum::{routing::get, Router};
use crate::handlers::home::get_foo;

pub fn foo_routes() -> Router {
    Router::new().route("/get_foo", get(get_foo))
}