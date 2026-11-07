use std::collections::HashMap;
use std::io::Write;
use std::sync::atomic::AtomicU32;
use std::sync::{Arc, Mutex};

use portable_pty::{Child, MasterPty};

pub struct PtySession {
    pub master: Box<dyn MasterPty + Send>,
    pub writer: Arc<Mutex<Box<dyn Write + Send>>>,
    pub child: Arc<Mutex<Box<dyn Child + Send + Sync>>>,
}

pub struct TerminalState {
    pub next_id: AtomicU32,
    pub sessions: Arc<Mutex<HashMap<u32, PtySession>>>,
}

impl TerminalState {
    pub fn new() -> Self {
        Self {
            next_id: AtomicU32::new(1),
            sessions: Arc::new(Mutex::new(HashMap::new())),
        }
    }
}

impl Default for TerminalState {
    fn default() -> Self {
        Self::new()
    }
}