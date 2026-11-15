use serde::{Deserialize, Serialize};
use std::path::Path;

#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq)]
#[serde(default, rename_all = "camelCase")]
pub struct Settings {
    pub nickname: String,
    pub game_path: String,
    pub cdn_base_url: String,
}

impl Settings {
    pub fn read(path: &Path) -> Settings {
        std::fs::read_to_string(path)
            .ok()
            .and_then(|s| serde_json::from_str(&s).ok())
            .unwrap_or_default()
    }
    pub fn write(path: &Path, settings: &Settings) -> std::io::Result<()> {
        if let Some(dir) = path.parent() {
            std::fs::create_dir_all(dir)?;
        }
        std::fs::write(path, serde_json::to_vec_pretty(settings)?)
    }
    /// Apply a partial JSON patch (object with any subset of fields).
    pub fn apply_patch(mut self, patch: &serde_json::Value) -> Settings {
        if let Some(v) = patch.get("nickname").and_then(|v| v.as_str()) { self.nickname = v.into(); }
        if let Some(v) = patch.get("gamePath").or_else(|| patch.get("game_path")).and_then(|v| v.as_str()) { self.game_path = v.into(); }
        if let Some(v) = patch.get("cdnBaseUrl").or_else(|| patch.get("cdn_base_url")).and_then(|v| v.as_str()) { self.cdn_base_url = v.into(); }
        self
    }
}
