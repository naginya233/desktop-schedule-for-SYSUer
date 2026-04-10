use serde::Serialize;
use tauri::Emitter;
use windows::Media::Control::GlobalSystemMediaTransportControlsSessionManager;

#[derive(Serialize, Clone)]
struct MediaInfo {
    title: String,
    artist: String,
}

#[tauri::command]
fn launch_app(path: String) {
    let _ = std::process::Command::new("cmd")
        .args(["/C", "start", "", &path])
        .spawn();
}

fn get_now_playing_sync() -> Option<MediaInfo> {
    let manager = GlobalSystemMediaTransportControlsSessionManager::RequestAsync().ok()?.get().ok()?;
    let session = match manager.GetCurrentSession() {
        Ok(s) => s,
        Err(_) => {
            return None;
        }
    };
    let props = session.TryGetMediaPropertiesAsync().ok()?.get().ok()?;
    
    let title = props.Title().unwrap_or_default().to_string();
    let artist = props.Artist().unwrap_or_default().to_string();

    Some(MediaInfo { title, artist })
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_autostart::init(tauri_plugin_autostart::MacosLauncher::LaunchAgent, Some(vec![])))
        .invoke_handler(tauri::generate_handler![launch_app])
        .setup(|app| {
            let handle = app.handle().clone();
            std::thread::spawn(move || {
                loop {
                    let info = get_now_playing_sync();
                    let _ = handle.emit_to("main", "now-playing", info);
                    std::thread::sleep(std::time::Duration::from_secs(3));
                }
            });

            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
