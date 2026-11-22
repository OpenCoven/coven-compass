fn main() {
    tauri::Builder::default()
        .run(tauri::generate_context!())
        .expect("Coven Compass desktop could not start");
}
