import { w as writable } from "./index.js";
import "./auth.js";
import "@privacyresearch/libsignal-protocol-typescript";
const conversations = writable([]);
const activeMessages = writable([]);
const keyChangeAlerts = writable(/* @__PURE__ */ new Set());
const verificationReceived = writable(null);
const typingUsers = writable(/* @__PURE__ */ new Map());
export {
  activeMessages as a,
  conversations as c,
  keyChangeAlerts as k,
  typingUsers as t,
  verificationReceived as v
};
