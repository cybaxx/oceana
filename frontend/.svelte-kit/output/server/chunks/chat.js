import { w as writable } from "./index.js";
import "./auth.js";
const conversations = writable([]);
const activeMessages = writable([]);
export {
  activeMessages as a,
  conversations as c
};
