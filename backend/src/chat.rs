use dashmap::DashMap;
use std::sync::Arc;
use tokio::sync::mpsc;
use uuid::Uuid;

use crate::models::WsServerMessage;

pub type Sender = mpsc::UnboundedSender<WsServerMessage>;

#[derive(Clone, Default)]
pub struct ConnectionManager {
    connections: Arc<DashMap<Uuid, Vec<Sender>>>,
}

impl ConnectionManager {
    pub fn new() -> Self {
        Self {
            connections: Arc::new(DashMap::new()),
        }
    }

    pub fn connect(&self, user_id: Uuid, sender: Sender) {
        self.connections.entry(user_id).or_default().push(sender);
    }

    pub fn disconnect(&self, user_id: Uuid, sender: &Sender) {
        if let Some(mut senders) = self.connections.get_mut(&user_id) {
            senders.retain(|s| !s.same_channel(sender));
            if senders.is_empty() {
                drop(senders);
                self.connections.remove(&user_id);
            }
        }
    }

    pub fn send_to_user(&self, user_id: Uuid, msg: &WsServerMessage) {
        if let Some(senders) = self.connections.get(&user_id) {
            for sender in senders.iter() {
                let _ = sender.send(msg.clone());
            }
        }
    }
}
