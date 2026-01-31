import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';

@Component({
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  template: `
  <div class="auth">
    <div class="card">
      <div class="badge">Office Assistant</div>
      <h1>Login</h1>
      <p class="lead">Welcome back. Enter your credentials to continue.</p>

      <form [formGroup]="form" (ngSubmit)="submit()">
        <label>Email</label>
        <input type="email" formControlName="email" />

        <label>Password</label>
        <input type="password" formControlName="password" />

        <button [disabled]="form.invalid || loading">Log in</button>
        <div class="error" *ngIf="error">{{error}}</div>
      </form>

      <p class="muted">Nie masz konta? <a routerLink="/register">Zarejestruj sie</a></p>
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
    .muted { margin-top: 16px; color: var(--muted); }
    a { color: var(--text); }
  `]
})
export class LoginComponent {
  loading = false;
  error = '';

  form = new FormGroup({
    email: new FormControl('', [Validators.required, Validators.email]),
    password: new FormControl('', [Validators.required]),
  });

  constructor(private auth: AuthService, private router: Router) {}

  submit() {
    this.error = '';
    this.loading = true;

    const { email, password } = this.form.value;
    this.auth.login(email!, password!).subscribe({
      next: () => this.router.navigateByUrl('/app'),
      error: (e) => {
        this.error = e?.error?.message || 'Login failed';
        this.loading = false;
      },
      complete: () => { this.loading = false; },
    });
  }
}
