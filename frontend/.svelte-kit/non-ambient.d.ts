
// this file is generated — do not edit it


declare module "svelte/elements" {
	export interface HTMLAttributes<T> {
		'data-sveltekit-keepfocus'?: true | '' | 'off' | undefined | null;
		'data-sveltekit-noscroll'?: true | '' | 'off' | undefined | null;
		'data-sveltekit-preload-code'?:
			| true
			| ''
			| 'eager'
			| 'viewport'
			| 'hover'
			| 'tap'
			| 'off'
			| undefined
			| null;
		'data-sveltekit-preload-data'?: true | '' | 'hover' | 'tap' | 'off' | undefined | null;
		'data-sveltekit-reload'?: true | '' | 'off' | undefined | null;
		'data-sveltekit-replacestate'?: true | '' | 'off' | undefined | null;
	}
}

export {};


declare module "$app/types" {
	type MatcherParam<M> = M extends (param : string) => param is (infer U extends string) ? U : string;

	export interface AppTypes {
		RouteId(): "/" | "/login" | "/posts" | "/posts/[id]" | "/register" | "/settings" | "/users" | "/users/[id]";
		RouteParams(): {
			"/posts/[id]": { id: string };
			"/users/[id]": { id: string }
		};
		LayoutParams(): {
			"/": { id?: string };
			"/login": Record<string, never>;
			"/posts": { id?: string };
			"/posts/[id]": { id: string };
			"/register": Record<string, never>;
			"/settings": Record<string, never>;
			"/users": { id?: string };
			"/users/[id]": { id: string }
		};
		Pathname(): "/" | "/login" | `/posts/${string}` & {} | "/register" | "/settings" | `/users/${string}` & {};
		ResolvedPathname(): `${"" | `/${string}`}${ReturnType<AppTypes['Pathname']>}`;
		Asset(): string & {};
	}
}