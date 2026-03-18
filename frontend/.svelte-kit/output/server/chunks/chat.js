import { w as writable } from "./index.js";
import "./auth.js";
import "@privacyresearch/libsignal-protocol-typescript";
const conversations = writable([]);
const activeMessages = writable([]);
export {
  activeMessages as a,
  conversations as c
};
