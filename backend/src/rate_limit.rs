use dashmap::DashMap;
use std::collections::VecDeque;
use std::net::IpAddr;
use std::time::{Duration, Instant};

#[derive(Clone)]
pub struct RateLimiter {
    requests: DashMap<IpAddr, VecDeque<Instant>>,
}

impl RateLimiter {
    pub fn new() -> Self {
        Self {
            requests: DashMap::new(),
        }
    }

    /// Returns `true` if the request is allowed, `false` if rate limited.
    pub fn check(&self, ip: IpAddr, max_requests: u32, window_secs: u64) -> bool {
        let now = Instant::now();
        let window = Duration::from_secs(window_secs);

        let mut entry = self.requests.entry(ip).or_insert_with(VecDeque::new);
        let deque = entry.value_mut();

        // Prune expired entries
        while deque.front().map_or(false, |&t| now.duration_since(t) > window) {
            deque.pop_front();
        }

        if deque.len() >= max_requests as usize {
            false
        } else {
            deque.push_back(now);
            true
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::net::Ipv4Addr;

    #[test]
    fn allows_under_limit() {
        let rl = RateLimiter::new();
        let ip = IpAddr::V4(Ipv4Addr::new(127, 0, 0, 1));
        for _ in 0..5 {
            assert!(rl.check(ip, 5, 60));
        }
    }

    #[test]
    fn blocks_over_limit() {
        let rl = RateLimiter::new();
        let ip = IpAddr::V4(Ipv4Addr::new(127, 0, 0, 1));
        for _ in 0..5 {
            assert!(rl.check(ip, 5, 60));
        }
        assert!(!rl.check(ip, 5, 60));
    }

    #[test]
    fn different_ips_independent() {
        let rl = RateLimiter::new();
        let ip1 = IpAddr::V4(Ipv4Addr::new(127, 0, 0, 1));
        let ip2 = IpAddr::V4(Ipv4Addr::new(127, 0, 0, 2));
        for _ in 0..5 {
            assert!(rl.check(ip1, 5, 60));
        }
        assert!(!rl.check(ip1, 5, 60));
        assert!(rl.check(ip2, 5, 60));
    }

    #[test]
    fn expired_entries_pruned() {
        let rl = RateLimiter::new();
        let ip = IpAddr::V4(Ipv4Addr::new(127, 0, 0, 1));
        // Use a window of 0 seconds so entries expire immediately
        assert!(rl.check(ip, 1, 0));
        // The previous entry should be expired
        assert!(rl.check(ip, 1, 0));
    }
}
