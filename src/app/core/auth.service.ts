import { Injectable } from '@angular/core';
import { BehaviorSubject, catchError, map, of, tap } from 'rxjs';
import { ApiService } from './api.service';
import { TokenStore } from './token.store';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private authed$ = new BehaviorSubject<boolean>(!!this.tokens.get());
  isAuthed$ = this.authed$.asObservable();

  constructor(private api: ApiService, private tokens: TokenStore) {}

  isAuthed(): boolean {
    return !!this.tokens.get();
  }

  login(email: string, password: string) {
    return this.api.login(email, password).pipe(
      tap(({ accessToken }) => {
        this.tokens.set(accessToken);
        this.authed$.next(true);
      }),
    );
  }

  register(email: string, password: string) {
    return this.api.register(email, password);
  }

  logout() {
    return this.api.logout().pipe(
      tap(() => {
        this.tokens.clear();
        this.authed$.next(false);
      }),
      catchError(() => {
        this.tokens.clear();
        this.authed$.next(false);
        return of(null);
      }),
    );
  }

  refreshAccessToken() {
    return this.api.refresh().pipe(
      tap(({ accessToken }) => {
        this.tokens.set(accessToken);
        this.authed$.next(true);
      }),
      map(() => true),
      catchError(() => {
        this.tokens.clear();
        this.authed$.next(false);
        return of(false);
      }),
    );
  }
}
