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
        Aplikacja połączy się z Twoją skrzynką via IMAP, wyszuka wiadomości dotyczące
        płatności, faktur i składek, a następnie wygeneruje raport przy użyciu AI.
        Może to potrwać kilka minut.
      </p>

      <div class="form-row">
        <label class="short">
          Zakres dni wstecz
          <input [(ngModel)]="daysBack" type="number" min="7" max="365" [disabled]="loading" />
        </label>
        <label class="short">
          Maks. e-maili
          <input [(ngModel)]="maxEmails" type="number" min="5" max="100" [disabled]="loading" />
        </label>
      </div>

      <div class="hint">
        Serwer IMAP oraz hasło pobierane są z <a href="/app/settings">Ustawień</a>.
      </div>

      <button (click)="start()" [disabled]="loading">
        {{ loading ? 'Generowanie…' : 'Generuj raport' }}
      </button>

      <!-- loading state -->
      <div class="progress" *ngIf="loading">
        <div class="spinner"></div>
        <span>{{ statusLabel }}</span>
        <span class="elapsed">{{ elapsed }}</span>
      </div>

      <div class="error" *ngIf="error">{{ error }}</div>
    </section>

    <!-- wyniki -->
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
    .panel { border: 1px solid var(--border); border-radius: 12px; padding: 20px; max-width: 720px; }
    .desc { color: var(--muted, #888); font-size: 0.9rem; margin-bottom: 18px; line-height: 1.6; }
    .form-row { display: flex; gap: 14px; flex-wrap: wrap; margin-bottom: 14px; }
    label { display: flex; flex-direction: column; gap: 6px; font-size: 0.88rem; color: var(--muted, #888); }
    label.short { flex: 0 0 140px; }
    input { padding: 8px 10px; border-radius: 8px; border: 1px solid var(--border); background: transparent; color: var(--text); font-size: 0.9rem; }
    .hint { font-size: 0.82rem; color: var(--muted, #888); margin-bottom: 16px; }
    .hint a { color: var(--text); }
    button { padding: 10px 22px; border-radius: 10px; cursor: pointer; }
    button:disabled { opacity: 0.5; cursor: not-allowed; }
    .error { color: var(--danger, #b00); margin-top: 12px; font-size: 0.9rem; }

    .progress {
      display: flex; align-items: center; gap: 12px;
      margin-top: 16px; color: var(--muted, #888); font-size: 0.88rem;
    }
    .spinner {
      width: 18px; height: 18px; border-radius: 50%;
      border: 2px solid rgba(255,255,255,0.15);
      border-top-color: var(--primary, #58f2c4);
      animation: spin 0.8s linear infinite;
      flex-shrink: 0;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    .elapsed { color: var(--muted, #888); font-size: 0.8rem; }

    .report-panel { margin-top: 28px; border: 1px solid var(--border); border-radius: 12px; padding: 24px; max-width: 860px; }
    .report-meta { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; font-size: 0.88rem; color: var(--muted, #888); }
    .print-btn { padding: 6px 14px; font-size: 0.82rem; border-radius: 8px; }
    .report-body { line-height: 1.7; font-size: 0.92rem; }
  `]
})
export class InboxReportComponent implements OnDestroy {
  daysBack = 90;
  maxEmails = 40;
  loading = false;
  error = '';
  reportHtml: SafeHtml | null = null;
  emailCount = 0;
  elapsed = '';

  private pollTimer?: any;
  private clockTimer?: any;
  private startedAt = 0;
  private currentJobId: number | null = null;

  get statusLabel(): string {
    return this.currentJobId ? 'Analizuję skrzynkę i generuję raport…' : 'Uruchamianie…';
  }

  constructor(private api: ApiService, private sanitizer: DomSanitizer) {}

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

    this.api.startInboxReport(this.daysBack, this.maxEmails).subscribe({
      next: (res: { jobId: number }) => {
        this.currentJobId = res.jobId;
        this.pollTimer = setInterval(() => this.poll(), 3000);
      },
      error: (e: any) => {
        this.error = e?.error?.detail || 'Nie udało się uruchomić raportu';
        this.stopTimers();
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

  print() { window.print(); }

  ngOnDestroy() { this.stopTimers(); }
}
