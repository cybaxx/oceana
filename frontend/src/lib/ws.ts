import { get } from 'svelte/store';
import { auth } from '$lib/stores/auth';
import type { WsServerMessage } from '$lib/types';

type MessageHandler = (msg: WsServerMessage) => void;

let ws: WebSocket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let handlers: MessageHandler[] = [];

function getWsUrl(token: string): string {
	const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
	// In dev, connect directly to backend; in prod, same host
	const host = window.location.hostname === 'localhost'
		? 'localhost:3001'
		: window.location.host;
	return `${proto}//${host}/api/v1/ws?token=${encodeURIComponent(token)}`;
}

export function connectWs() {
	const state = get(auth);
	if (!state.token) return;
	if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) return;

	ws = new WebSocket(getWsUrl(state.token));

	ws.onopen = () => {
		if (reconnectTimer) {
			clearTimeout(reconnectTimer);
			reconnectTimer = null;
		}
	};

	ws.onmessage = (event) => {
		try {
			const msg: WsServerMessage = JSON.parse(event.data);
			for (const handler of handlers) {
				handler(msg);
			}
		} catch {}
	};

	ws.onclose = () => {
		ws = null;
		scheduleReconnect();
	};

	ws.onerror = () => {
		ws?.close();
	};
}

function scheduleReconnect() {
	if (reconnectTimer) return;
	const state = get(auth);
	if (!state.token) return;
	reconnectTimer = setTimeout(() => {
		reconnectTimer = null;
		connectWs();
	}, 3000);
}

export function disconnectWs() {
	if (reconnectTimer) {
		clearTimeout(reconnectTimer);
		reconnectTimer = null;
	}
	if (ws) {
		ws.onclose = null;
		ws.close();
		ws = null;
	}
}

export function sendWsMessage(msg: { type: string; [key: string]: unknown }) {
	if (ws && ws.readyState === WebSocket.OPEN) {
		ws.send(JSON.stringify(msg));
	}
}

export function onWsMessage(handler: MessageHandler): () => void {
	handlers.push(handler);
	return () => {
		handlers = handlers.filter((h) => h !== handler);
	};
}
