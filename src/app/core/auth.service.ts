import { Injectable } from '@angular/core';
import { BehaviorSubject, catchError, map, of, tap } from 'rxjs';
import { ApiService, MeDto } from './api.service';
import { TokenStore } from './token.store';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private authed$ = new BehaviorSubject<boolean>(false);
  isAuthed$ = this.authed$.asObservable();

  private currentUser$ = new BehaviorSubject<MeDto | null>(null);
  user$ = this.currentUser$.asObservable();

  constructor(private api: ApiService, private tokens: TokenStore) {
    const authed = !!this.tokens.get();
    this.authed$.next(authed);
    if (authed) this.loadMe();
  }

  isAuthed(): boolean {
    return !!this.tokens.get();
  }

  isAdmin(): boolean {
    return this.currentUser$.value?.role === 'admin';
  }

  fetchMe() {
    if (environment.mockAuth) {
      return of(this.currentUser$.value ?? { id: 0, email: 'mock@local.test', role: 'admin' });
    }
    return this.api.getMe().pipe(tap((me) => this.currentUser$.next(me)));
  }

  private loadMe() {
    if (environment.mockAuth) {
      this.currentUser$.next({ id: 0, email: 'mock@local.test', role: 'admin' });
      return;
    }
    this.api.getMe().subscribe({
      next: (me) => this.currentUser$.next(me),
      error: () => this.currentUser$.next(null),
    });
  }

  login(email: string, password: string) {
    if (environment.mockAuth) {
      return of({ accessToken: 'mock-token' }).pipe(
        tap(({ accessToken }) => {
          this.tokens.set(accessToken);
          this.authed$.next(true);
          this.loadMe();
        }),
      );
    }
    return this.api.login(email, password).pipe(
      tap(({ accessToken }) => {
        this.tokens.set(accessToken);
        this.authed$.next(true);
        this.loadMe();
      }),
    );
  }

  register(email: string, password: string) {
    if (environment.mockAuth) {
      return of(void 0);
    }
    return this.api.register(email, password).pipe(map(() => void 0));
  }

  forgotPassword(email: string) {
    return this.api.forgotPassword(email).pipe(map(() => void 0));
  }

  resetPassword(token: string, password: string) {
    return this.api.resetPassword(token, password).pipe(map(() => void 0));
  }

  logout() {
    if (environment.mockAuth) {
      this.tokens.clear();
      this.authed$.next(false);
      this.currentUser$.next(null);
      return of(null);
    }
    return this.api.logout().pipe(
      tap(() => {
        this.tokens.clear();
        this.authed$.next(false);
        this.currentUser$.next(null);
      }),
      catchError(() => {
        this.tokens.clear();
        this.authed$.next(false);
        this.currentUser$.next(null);
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
        this.loadMe();
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
