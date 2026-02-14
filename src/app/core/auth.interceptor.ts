import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, switchMap, throwError } from 'rxjs';
import { TokenStore } from './token.store';
import { AuthService } from './auth.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const tokens = inject(TokenStore);
  const auth = inject(AuthService);
  const router = inject(Router);

  const token = tokens.get();
  const authReq = token
    ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
    : req;

  const isAuthEndpoint =
    req.url.includes('/api/auth/login') ||
    req.url.includes('/api/auth/register') ||
    req.url.includes('/api/auth/refresh');

  return next(authReq).pipe(
    catchError((err) => {
      // Avoid refresh loops on auth endpoints when login/register/refresh returns 401.
      if (err?.status === 401 && !isAuthEndpoint) {
        return auth.refreshAccessToken().pipe(
          switchMap((ok) => {
            if (!ok) {
              router.navigateByUrl('/login');
              return throwError(() => err);
            }
            const newToken = tokens.get();
            const retryReq = newToken
              ? req.clone({ setHeaders: { Authorization: `Bearer ${newToken}` } })
              : req;
            return next(retryReq);
          }),
        );
      }
      return throwError(() => err);
    }),
  );
};
