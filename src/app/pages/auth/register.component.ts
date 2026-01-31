import { Component } from '@angular/core';
import { ReactiveFormsModule, FormControl, FormGroup, Validators } from '@angular/forms';
import { RouterLink, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../core/auth.service';

@Component({
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  template: `
  <div class="auth">
    <h1>Register</h1>

    <form [formGroup]="form" (ngSubmit)="submit()">
      <label>Email</label>
      <input type="email" formControlName="email" />

      <label>Password</label>
      <input type="password" formControlName="password" />

      <button [disabled]="form.invalid || loading">Create account</button>
      <div class="error" *ngIf="error">{{error}}</div>
      <div class="ok" *ngIf="ok">Account created. You can login now.</div>
    </form>

    <p>Masz konto? <a routerLink="/login">Zaloguj się</a></p>
  </div>
  `,
  styles: [`
    .auth { max-width: 380px; margin: 60px auto; }
    input { width: 100%; padding: 10px; margin: 6px 0 12px; }
    button { width: 100%; padding: 10px; }
    .error { color: #b00; margin-top: 10px; }
    .ok { color: #070; margin-top: 10px; }
  `]
})
export class RegisterComponent {
  loading = false;
  error = '';
  ok = false;

  form = new FormGroup({
    email: new FormControl('', [Validators.required, Validators.email]),
    password: new FormControl('', [Validators.required, Validators.minLength(8)]),
  });

  constructor(private auth: AuthService, private router: Router) {}

  submit() {
    this.error = '';
    this.ok = false;
    this.loading = true;

    const { email, password } = this.form.value;
    this.auth.register(email!, password!).subscribe({
      next: () => { this.ok = true; },
      error: (e) => { this.error = e?.error?.message || 'Register failed'; },
      complete: () => { this.loading = false; }
    });
  }
}
