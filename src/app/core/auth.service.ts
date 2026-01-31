import { Injectable } from '@angular/core';
import { BehaviorSubject, catchError, map, of, tap } from 'rxjs';
import { ApiService } from './api.service';
import { TokenStore } from './token.store';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private authed$ = new BehaviorSubject<boolean>(false);
  isAuthed$ = this.authed$.asObservable();

  constructor(private api: ApiService, private tokens: TokenStore) {
    this.authed$.next(!!this.tokens.get());
  }

  isAuthed(): boolean {
    return !!this.tokens.get();
  }

  login(email: string, password: string) {
    if (environment.mockAuth) {
      return of({ accessToken: 'mock-token' }).pipe(
        tap(({ accessToken }) => {
          this.tokens.set(accessToken);
          this.authed$.next(true);
        }),
      );
    }
    return this.api.login(email, password).pipe(
      tap(({ accessToken }) => {
        this.tokens.set(accessToken);
        this.authed$.next(true);
      }),
    );
  }

  register(email: string, password: string) {
    if (environment.mockAuth) {
      return of(void 0);
    }
    return this.api.register(email, password).pipe(map(() => void 0));
  }

  logout() {
    if (environment.mockAuth) {
      this.tokens.clear();
      this.authed$.next(false);
      return of(null);
    }
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
    if (environment.mockAuth) {
      this.tokens.set('mock-token');
      this.authed$.next(true);
      return of(true);
    }
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
