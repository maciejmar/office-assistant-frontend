import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';

@Component({
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  template: `
  <div class="auth">
    <div class="card">
      <div class="badge">Office Assistant</div>
      <h1>Ustaw nowe haslo</h1>
      <p class="lead">Wpisz nowe haslo do swojego konta.</p>

      <form [formGroup]="form" (ngSubmit)="submit()">
        <label>Nowe haslo</label>
        <input type="password" formControlName="password" />
        <div class="error" *ngIf="form.controls.password.touched && form.controls.password.invalid">
          Haslo musi miec min. 8 znakow.
        </div>

        <button type="submit" [disabled]="loading">Zmien haslo</button>
        <div class="error" *ngIf="error">{{error}}</div>
        <div class="ok" *ngIf="ok">Haslo zostalo zmienione. Mozesz sie teraz zalogowac.</div>
      </form>

      <p class="muted"><a routerLink="/login">Wroc do logowania</a></p>
    </div>
  </div>
  `,
  styles: [`
    .auth {
      min-height: calc(100vh - 48px);
      display: grid;
      place-items: center;
      padding: 24px;
    }

    .card {
      width: min(420px, 100%);
      padding: 28px;
      border-radius: 16px;
      border: 1px solid var(--border);
      background:
        radial-gradient(240px 160px at 10% 0%, rgba(106, 167, 255, 0.18), transparent 60%),
        radial-gradient(220px 140px at 90% 0%, rgba(248, 107, 210, 0.2), transparent 60%),
        var(--grad-soft);
      box-shadow: var(--shadow);
    }

    .badge {
      display: inline-flex;
      align-items: center;
      padding: 6px 10px;
      border-radius: 999px;
      font-size: 0.7rem;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: var(--muted);
      border: 1px solid var(--border);
      background: rgba(255, 255, 255, 0.02);
      margin-bottom: 12px;
    }

    .lead {
      margin-bottom: 18px;
      color: var(--muted);
    }

    label {
      display: block;
      margin: 12px 0 6px;
      color: var(--muted);
      font-size: 0.9rem;
    }

    button {
      width: 100%;
      margin-top: 14px;
    }

    .error { color: var(--danger); margin-top: 10px; }
    .ok { color: var(--primary); margin-top: 10px; }
    .muted { margin-top: 16px; color: var(--muted); }
    a { color: var(--text); }
  `]
})
export class ResetPasswordComponent {
  loading = false;
  error = '';
  ok = false;
  private token = '';

  form = new FormGroup({
    password: new FormControl('', [Validators.required, Validators.minLength(8)]),
  });

  constructor(private auth: AuthService, private route: ActivatedRoute, private router: Router) {
    this.token = this.route.snapshot.paramMap.get('token') || '';
  }

  submit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.error = '';
    this.ok = false;
    this.loading = true;

    const { password } = this.form.value;
    this.auth.resetPassword(this.token, password!).subscribe({
      next: () => {
        this.ok = true;
        setTimeout(() => this.router.navigateByUrl('/login'), 2000);
      },
      error: (e) => {
        this.error = e?.error?.detail || 'Link jest nieprawidlowy lub wygasl.';
        this.loading = false;
      },
      complete: () => { this.loading = false; },
    });
  }
}
