import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';

@Component({
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  template: `
  <div class="auth">
    <div class="card">
      <div class="badge">Office Assistant</div>
      <h1>Zapomnialem hasla</h1>
      <p class="lead">Podaj swoj e-mail. Jesli konto istnieje, wyslemy link do resetu hasla.</p>

      <form [formGroup]="form" (ngSubmit)="submit()">
        <label>Email</label>
        <input type="email" formControlName="email" />

        <button [disabled]="form.invalid || loading">Wyslij link resetujacy</button>
        <div class="error" *ngIf="error">{{error}}</div>
        <div class="ok" *ngIf="sent">Jesli to konto istnieje, link do resetu hasla zostal wyslany na podany adres.</div>
      </form>

      <p class="muted">Pamietasz haslo? <a routerLink="/login">Zaloguj sie</a></p>
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
export class ForgotPasswordComponent {
  loading = false;
  error = '';
  sent = false;

  form = new FormGroup({
    email: new FormControl('', [Validators.required, Validators.email]),
  });

  constructor(private auth: AuthService) {}

  submit() {
    this.error = '';
    this.sent = false;
    this.loading = true;

    const { email } = this.form.value;
    this.auth.forgotPassword(email!).subscribe({
      next: () => { this.sent = true; },
      error: (e) => {
        this.error = e?.error?.detail || 'Cos poszlo nie tak, sprobuj ponownie.';
        this.loading = false;
      },
      complete: () => { this.loading = false; },
    });
  }
}
