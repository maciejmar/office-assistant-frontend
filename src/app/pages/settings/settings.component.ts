import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ApiService } from '../../core/api.service';

@Component({
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <h1>Settings</h1>

    <section class="panel">
      <h2>SMTP — konfiguracja wysyłki e-mail</h2>
      <p class="muted">Każdy użytkownik konfiguruje własną skrzynkę. Hasło jest przechowywane po stronie serwera.</p>

      <form [formGroup]="form" (ngSubmit)="save()">
        <div class="grid">
          <label>
            Serwer SMTP
            <input formControlName="host" placeholder="smtp.gmail.com" />
          </label>
          <label>
            Port
            <input type="number" formControlName="port" />
          </label>
        </div>

        <label class="checkbox-row">
          <input type="checkbox" formControlName="tls" />
          Użyj STARTTLS (zalecane dla portu 587)
        </label>

        <label>
          Login (adres e-mail konta)
          <input formControlName="username" placeholder="twoj@email.com" />
        </label>

        <label>
          Hasło / App Password
          <input type="password" formControlName="password" placeholder="••••••••" />
        </label>

        <label>
          Adres nadawcy (From)
          <input formControlName="from_addr" placeholder="Biuro &lt;twoj@email.com&gt;" />
        </label>

        <div class="hint">
          <b>Gmail:</b> SMTP <code>smtp.gmail.com:587</code> / IMAP <code>imap.gmail.com:993</code>, TLS ✓, użyj
          <a href="https://myaccount.google.com/apppasswords" target="_blank">App Password</a>.<br>
          <b>Hotmail/Outlook:</b> SMTP <code>smtp.office365.com:587</code> / IMAP <code>outlook.office365.com:993</code>, TLS ✓.<br>
          <b>Privatemail:</b> SMTP <code>smtp.privateemail.com:587</code> / IMAP <code>mail.privateemail.com:993</code>, TLS ✓.
        </div>

        <h3 style="margin: 20px 0 4px">IMAP — analiza skrzynki przychodzącej</h3>
        <p class="muted">Wymagane do generowania raportu skrzynki mailowej.</p>

        <div class="grid">
          <label>
            Serwer IMAP
            <input formControlName="imap_host" placeholder="imap.gmail.com" />
          </label>
          <label>
            Port IMAP
            <input type="number" formControlName="imap_port" />
          </label>
        </div>

        <div class="row">
          <button type="submit" [disabled]="form.invalid || saving">
            {{ saving ? 'Zapisywanie…' : 'Zapisz' }}
          </button>
          <button type="button" [disabled]="testing || form.dirty" (click)="test()">
            {{ testing ? 'Testowanie…' : 'Wyślij test na mój adres' }}
          </button>
        </div>

        <div class="ok" *ngIf="saved">Zapisano.</div>
        <div class="ok" *ngIf="tested">Test wysłany — sprawdź skrzynkę.</div>
        <div class="error" *ngIf="error">{{ error }}</div>
      </form>
    </section>
  `,
  styles: [`
    .panel { border: 1px solid var(--border); border-radius: 12px; padding: 20px; max-width: 640px; }
    .muted { color: var(--muted, #888); font-size: 0.9rem; margin-bottom: 16px; }
    .grid { display: grid; grid-template-columns: 1fr 120px; gap: 12px; }
    label { display: flex; flex-direction: column; gap: 6px; font-size: 0.9rem; color: var(--muted, #888); margin-top: 12px; }
    .checkbox-row { flex-direction: row; align-items: center; gap: 8px; color: var(--text); margin-top: 12px; }
    .hint { margin-top: 16px; font-size: 0.82rem; color: var(--muted, #888); line-height: 1.7;
            border: 1px solid var(--border); border-radius: 8px; padding: 12px; }
    .hint a { color: var(--text); }
    code { background: rgba(255,255,255,0.07); padding: 1px 5px; border-radius: 4px; }
    .row { display: flex; gap: 10px; margin-top: 18px; }
    .ok { color: #0a7a2f; margin-top: 10px; font-weight: 600; }
    .error { color: var(--danger, #b00); margin-top: 10px; }
  `]
})
export class SettingsComponent {
  saving = false;
  testing = false;
  saved = false;
  tested = false;
  error = '';

  form = new FormGroup({
    host:      new FormControl('', Validators.required),
    port:      new FormControl(587, Validators.required),
    tls:       new FormControl(true),
    username:  new FormControl('', [Validators.required, Validators.email]),
    password:  new FormControl(''),
    from_addr: new FormControl('', Validators.required),
    imap_host: new FormControl(''),
    imap_port: new FormControl(993),
  });

  constructor(private api: ApiService) {
    this.api.getSmtpConfig().subscribe({
      next: (cfg) => this.form.patchValue({ ...cfg, password: '' }),
      error: () => {},
    });
  }

  save() {
    this.error = ''; this.saved = false;
    this.saving = true;
    this.api.saveSmtpConfig(this.form.value as any).subscribe({
      next: () => { this.saved = true; this.saving = false; this.form.markAsPristine(); },
      error: (e) => { this.error = e?.error?.detail || 'Błąd zapisu'; this.saving = false; },
    });
  }

  test() {
    this.error = ''; this.tested = false;
    this.testing = true;
    this.api.testSmtp().subscribe({
      next: () => { this.tested = true; this.testing = false; },
      error: (e) => { this.error = e?.error?.detail || 'Test nieudany'; this.testing = false; },
    });
  }
}
