import { w as writable } from "./index.js";
function createAuthStore() {
  let initial = { user: null, token: null };
  const { subscribe, set, update } = writable(initial);
  return {
    subscribe,
    login(user, token) {
      const state = { user, token };
      set(state);
    },
    updateUser(user) {
      update((s) => {
        const state = { ...s, user };
        return state;
      });
    },
    logout() {
      set({ user: null, token: null });
    }
  };
}
const auth = createAuthStore();
export {
  auth as a
};
