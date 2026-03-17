import { w as writable } from "./index.js";
function createAuthStore() {
  let initial = { user: null, token: null };
  if (typeof localStorage !== "undefined") {
    const saved = localStorage.getItem("auth");
    if (saved) {
      try {
        initial = JSON.parse(saved);
      } catch {
      }
    }
  }
  const { subscribe, set, update } = writable(initial);
  return {
    subscribe,
    login(user, token) {
      const state = { user, token };
      localStorage.setItem("auth", JSON.stringify(state));
      set(state);
    },
    updateUser(user) {
      update((s) => {
        const state = { ...s, user };
        localStorage.setItem("auth", JSON.stringify(state));
        return state;
      });
    },
    logout() {
      localStorage.removeItem("auth");
      set({ user: null, token: null });
    }
  };
}
const auth = createAuthStore();
export {
  auth as a
};
