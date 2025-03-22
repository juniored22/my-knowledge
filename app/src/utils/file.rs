use std::{fs, path::PathBuf};

pub fn load_html(relative_path: &str) -> String {

    let path = match std::env::current_dir() {
        Ok(mut dir) => {
            dir.push(relative_path);
            dir
        }
        Err(e) => {
            eprintln!("Erro ao obter o diretório atual: {}", e);
            // retorna um path "falso" que falhará no read_to_string abaixo
            PathBuf::from(relative_path)
        }
    };

    println!("Lendo arquivo HTML de: {}", path.display());

 
    match fs::read_to_string(&path) {
        Ok(content) => content,
        Err(e) => {
            eprintln!("Erro ao ler HTML em '{}': {}", path.display(), e);
            "<h1>Erro ao carregar página</h1>".to_string()
        }
    }
}
