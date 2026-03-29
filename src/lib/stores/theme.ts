import { writable } from 'svelte/store';

// Load saved theme from localStorage, default to 'clouds'
const saved = typeof localStorage !== 'undefined' ? localStorage.getItem('activeTheme') : null;
const initial = saved === 'cosmos' ? 'cosmos' : 'clouds';

export const activeThemeStore = writable(initial);

// Auto-save to localStorage on change
if (typeof localStorage !== 'undefined') {
    activeThemeStore.subscribe(v => {
        localStorage.setItem('activeTheme', v);
    });
}
