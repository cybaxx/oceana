import { w as writable } from "./index.js";
function createAuthStore() {
  let initial = { user: null, token: null, refresh_token: null };
  const { subscribe, set, update } = writable(initial);
  return {
    subscribe,
    login(user, token, refresh_token) {
      const state = { user, token, refresh_token };
      set(state);
    },
    updateUser(user) {
      update((s) => {
        const state = { ...s, user };
        return state;
      });
    },
    setTokens(token, refresh_token) {
      update((s) => {
        const state = { ...s, token, refresh_token };
        return state;
      });
    },
    logout() {
      set({ user: null, token: null, refresh_token: null });
    }
  };
}
const auth = createAuthStore();
export {
  auth as a
};
