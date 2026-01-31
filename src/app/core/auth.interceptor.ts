import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap, throwError } from 'rxjs';
import { TokenStore } from './token.store';
import { AuthService } from './auth.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const tokens = inject(TokenStore);
  const auth = inject(AuthService);

  const token = tokens.get();
  const authReq = token
    ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
    : req;

  return next(authReq).pipe(
    catchError((err) => {
      // Jeśli access token wygasł → spróbuj refresh i powtórz request
      if (err?.status === 401) {
        return auth.refreshAccessToken().pipe(
          switchMap((ok) => {
            if (!ok) return throwError(() => err);
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
