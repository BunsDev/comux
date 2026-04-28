use serde::Serialize;
use std::{env, fs, path::PathBuf};

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct BridgeConfig {
    port: u16,
    token: Option<String>,
    token_path: String,
    project_root: String,
}

fn home_dir() -> Option<PathBuf> {
    env::var_os("HOME").map(PathBuf::from)
}

#[tauri::command]
fn bridge_config() -> BridgeConfig {
    let port = env::var("COMUX_DAEMON_PORT")
        .ok()
        .and_then(|value| value.parse::<u16>().ok())
        .unwrap_or(47_123);
    let token_path = home_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join(".config")
        .join("comux")
        .join("token");
    let token = fs::read_to_string(&token_path)
        .ok()
        .map(|value| value.trim().to_owned())
        .filter(|value| value.len() >= 32);
    let project_root = env::current_dir()
        .ok()
        .and_then(|path| path.to_str().map(ToOwned::to_owned))
        .unwrap_or_else(|| "~".to_owned());

    BridgeConfig {
        port,
        token,
        token_path: token_path.to_string_lossy().to_string(),
        project_root,
    }
}

pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![bridge_config])
        .run(tauri::generate_context!())
        .expect("error while running comux desktop");
}
