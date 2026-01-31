import { Injectable } from '@angular/core';

const KEY = 'oa_access_token';

@Injectable({ providedIn: 'root' })
export class TokenStore {
  get(): string | null {
    return localStorage.getItem(KEY);
  }
  set(token: string) {
    localStorage.setItem(KEY, token);
  }
  clear() {
    localStorage.removeItem(KEY);
  }
}
