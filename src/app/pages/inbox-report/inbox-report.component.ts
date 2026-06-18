import { Component, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/api.service';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <h1>Raport skrzynki mailowej</h1>

    <section class="panel">
      <p class="desc">
        Aplikacja połączy się z podaną skrzynką via IMAP, wyszuka wiadomości dotyczące
        płatności, faktur i składek, a następnie wygeneruje raport przy użyciu AI.
        Może to potrwać kilka minut.
      </p>

      <h3>Konto IMAP</h3>

      <div class="grid-2">
        <label>
          Serwer IMAP
          <input [(ngModel)]="imapHost" placeholder="imap.gmail.com" [disabled]="loading" />
        </label>
        <label class="short">
          Port
          <input [(ngModel)]="imapPort" type="number" [disabled]="loading" />
        </label>
      </div>

      <label>
        Login (adres e-mail)
        <input [(ngModel)]="username" type="email" placeholder="twoj@gmail.com" [disabled]="loading" />
      </label>

      <label>
        Hasło / App Password
        <input [(ngModel)]="password" type="password" placeholder="••••••••" [disabled]="loading" />
      </label>

      <div class="hint">
        Dane domyślnie pobrane z <a href="/app/settings">Ustawień</a>.
        Możesz wpisać inne konto — dane nie są zapisywane.
      </div>

      <h3>Parametry analizy</h3>

      <div class="grid-2">
        <label>
          Zakres dni wstecz
          <input [(ngModel)]="daysBack" type="number" min="7" max="365" [disabled]="loading" />
        </label>
        <label>
          Maks. e-maili
          <input [(ngModel)]="maxEmails" type="number" min="5" max="100" [disabled]="loading" />
        </label>
      </div>

      <button (click)="start()" [disabled]="loading || !imapHost || !username || !password">
        {{ loading ? 'Generowanie…' : 'Generuj raport' }}
      </button>

      <div class="progress" *ngIf="loading">
        <div class="spinner"></div>
        <span>Analizuję skrzynkę i generuję raport…</span>
        <span class="elapsed">{{ elapsed }}</span>
        <button class="cancel-btn" (click)="cancel()">Anuluj</button>
      </div>

      <div class="error" *ngIf="error">{{ error }}</div>
    </section>

    <section class="report-panel" *ngIf="reportHtml">
      <div class="report-meta">
        Przeanalizowano <strong>{{ emailCount }}</strong> wiadomości finansowych
        <button class="print-btn" (click)="print()">Drukuj / Zapisz PDF</button>
      </div>
      <div class="report-body" [innerHTML]="reportHtml"></div>
    </section>
  `,
  styles: [`
    h1 { margin-bottom: 20px; }
    h3 { margin: 18px 0 10px; font-size: 0.95rem; color: var(--muted, #aaa); font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; }
    .panel { border: 1px solid var(--border); border-radius: 12px; padding: 20px; max-width: 720px; }
    .desc { color: var(--muted, #888); font-size: 0.9rem; margin-bottom: 4px; line-height: 1.6; }
    .grid-2 { display: grid; grid-template-columns: 1fr 110px; gap: 12px; }
    label { display: flex; flex-direction: column; gap: 6px; font-size: 0.88rem; color: var(--muted, #888); margin-bottom: 12px; }
    .hint { font-size: 0.82rem; color: var(--muted, #888); margin: 4px 0 18px; }
    .hint a { color: var(--text); }
    button { padding: 10px 22px; border-radius: 10px; cursor: pointer; }
    button:disabled { opacity: 0.5; cursor: not-allowed; }
    .error { color: var(--danger, #b00); margin-top: 12px; font-size: 0.9rem; }
    .progress { display: flex; align-items: center; gap: 12px; margin-top: 16px; color: var(--muted, #888); font-size: 0.88rem; }
    .spinner { width: 18px; height: 18px; border-radius: 50%; border: 2px solid rgba(255,255,255,0.15); border-top-color: var(--primary, #58f2c4); animation: spin 0.8s linear infinite; flex-shrink: 0; }
    @keyframes spin { to { transform: rotate(360deg); } }
    .elapsed { font-size: 0.8rem; }
    .cancel-btn { padding: 4px 12px; font-size: 0.8rem; border-radius: 6px; background: rgba(255,100,100,0.15); border-color: rgba(255,100,100,0.4); color: var(--danger, #ff6b6b); margin-left: 8px; }
    .report-panel { margin-top: 28px; border: 1px solid var(--border); border-radius: 12px; padding: 24px; max-width: 860px; }
    .report-meta { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; font-size: 0.88rem; color: var(--muted, #888); }
    .print-btn { padding: 6px 14px; font-size: 0.82rem; border-radius: 8px; }
    .report-body { line-height: 1.7; font-size: 0.92rem; }
  `]
})
export class InboxReportComponent implements OnDestroy {
  imapHost = '';
  imapPort = 993;
  username = '';
  password = '';
  daysBack = 60;
  maxEmails = 15;

  loading = false;
  error = '';
  reportHtml: SafeHtml | null = null;
  emailCount = 0;
  elapsed = '';

  private pollTimer?: any;
  private clockTimer?: any;
  private startedAt = 0;
  private currentJobId: number | null = null;

  constructor(private api: ApiService, private sanitizer: DomSanitizer) {
    this.api.getSmtpConfig().subscribe({
      next: (cfg: any) => {
        this.imapHost = cfg.imap_host || '';
        this.imapPort = cfg.imap_port || 993;
        this.username = cfg.username || '';
      },
      error: () => {},
    });
  }

  start() {
    this.error = '';
    this.reportHtml = null;
    this.loading = true;
    this.startedAt = Date.now();
    this.elapsed = '';
    this.currentJobId = null;

    this.clockTimer = setInterval(() => {
      const s = Math.floor((Date.now() - this.startedAt) / 1000);
      const m = Math.floor(s / 60);
      this.elapsed = m > 0 ? `${m} min ${s % 60} s` : `${s} s`;
    }, 1000);

    this.api.startInboxReport({
      daysBack: this.daysBack,
      maxEmails: this.maxEmails,
      imapHost: this.imapHost,
      imapPort: this.imapPort,
      username: this.username,
      password: this.password,
    }).subscribe({
      next: (res: { jobId: number }) => {
        this.currentJobId = res.jobId;
        this.pollTimer = setInterval(() => this.poll(), 3000);
      },
      error: (e: any) => {
        this.error = e?.error?.detail || 'Nie udało się uruchomić raportu';
        this.stopTimers();
        this.loading = false;
      },
    });
  }

  private poll() {
    if (!this.currentJobId) return;
    this.api.getInboxReport(this.currentJobId).subscribe({
      next: (s) => {
        if (s.status === 'done') {
          this.emailCount = s.email_count;
          this.reportHtml = this.sanitizer.bypassSecurityTrustHtml(s.result_html || '');
          this.loading = false;
          this.stopTimers();
        } else if (s.status === 'failed') {
          this.error = s.error || 'Generowanie nie powiodło się';
          this.loading = false;
          this.stopTimers();
        }
      },
    });
  }

  private stopTimers() {
    clearInterval(this.pollTimer);
    clearInterval(this.clockTimer);
  }

  cancel() {
    if (!this.currentJobId) { this.loading = false; this.stopTimers(); return; }
    this.api.cancelInboxReport(this.currentJobId).subscribe({
      next: () => { this.error = 'Anulowano.'; this.loading = false; this.stopTimers(); },
      error: () => { this.loading = false; this.stopTimers(); },
    });
  }

  print() { window.print(); }

  ngOnDestroy() { this.stopTimers(); }
}
