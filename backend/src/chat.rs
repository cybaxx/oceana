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
        let mut senders = self.connections.entry(user_id).or_default();
        // Cap at 5 connections per user — drop oldest if exceeded
        while senders.len() >= 5 {
            senders.remove(0);
        }
        senders.push(sender);
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

#[cfg(test)]
mod tests {
    use super::*;
    use tokio::sync::mpsc;

    fn make_msg() -> WsServerMessage {
        WsServerMessage::Error {
            message: "test".into(),
        }
    }

    #[test]
    fn connect_and_disconnect() {
        let mgr = ConnectionManager::new();
        let user_id = Uuid::new_v4();
        let (tx, _rx) = mpsc::unbounded_channel();

        mgr.connect(user_id, tx.clone());
        assert!(mgr.connections.contains_key(&user_id));
        assert_eq!(mgr.connections.get(&user_id).unwrap().len(), 1);

        mgr.disconnect(user_id, &tx);
        assert!(!mgr.connections.contains_key(&user_id));
    }

    #[test]
    fn max_5_connections_drops_oldest() {
        let mgr = ConnectionManager::new();
        let user_id = Uuid::new_v4();
        let mut senders = Vec::new();

        for _ in 0..6 {
            let (tx, _rx) = mpsc::unbounded_channel::<WsServerMessage>();
            mgr.connect(user_id, tx.clone());
            senders.push(tx);
        }

        // Should be capped at 5
        assert_eq!(mgr.connections.get(&user_id).unwrap().len(), 5);
    }

    #[tokio::test]
    async fn send_to_user_reaches_all_connections() {
        let mgr = ConnectionManager::new();
        let user_id = Uuid::new_v4();

        let (tx1, mut rx1) = mpsc::unbounded_channel();
        let (tx2, mut rx2) = mpsc::unbounded_channel();
        mgr.connect(user_id, tx1);
        mgr.connect(user_id, tx2);

        mgr.send_to_user(user_id, &make_msg());

        assert!(rx1.try_recv().is_ok());
        assert!(rx2.try_recv().is_ok());
    }

    #[test]
    fn send_to_disconnected_user_no_panic() {
        let mgr = ConnectionManager::new();
        let user_id = Uuid::new_v4();
        // Should not panic
        mgr.send_to_user(user_id, &make_msg());
    }

    #[test]
    fn disconnect_cleans_up_empty_entries() {
        let mgr = ConnectionManager::new();
        let user_id = Uuid::new_v4();
        let (tx1, _rx1) = mpsc::unbounded_channel();
        let (tx2, _rx2) = mpsc::unbounded_channel();

        mgr.connect(user_id, tx1.clone());
        mgr.connect(user_id, tx2.clone());

        mgr.disconnect(user_id, &tx1);
        assert!(mgr.connections.contains_key(&user_id));
        assert_eq!(mgr.connections.get(&user_id).unwrap().len(), 1);

        mgr.disconnect(user_id, &tx2);
        assert!(!mgr.connections.contains_key(&user_id));
    }
}
