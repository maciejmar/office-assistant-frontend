import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { catchError, map, of } from 'rxjs';
import { AuthService } from './auth.service';

export const adminGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  return auth.fetchMe().pipe(
    map((me) => {
      if (me.role === 'admin') return true;
      router.navigateByUrl('/app/dashboard');
      return false;
    }),
    catchError(() => {
      router.navigateByUrl('/app/dashboard');
      return of(false);
    }),
  );
};
