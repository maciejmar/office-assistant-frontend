import { Component } from '@angular/core';
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
      </p>

      <div class="form-row">
        <label class="short">
          Zakres dni wstecz
          <input [(ngModel)]="daysBack" type="number" min="7" max="365" />
        </label>

        <label class="short">
          Maks. e-maili
          <input [(ngModel)]="maxEmails" type="number" min="5" max="100" />
        </label>
      </div>

      <div class="hint">
        Serwer IMAP oraz hasło pobierane są z <a href="/app/settings">Ustawień</a>.
        Upewnij się że masz skonfigurowany serwer IMAP.
      </div>

      <button (click)="generate()" [disabled]="loading">
        {{ loading ? 'Analizuję skrzynkę…' : 'Generuj raport' }}
      </button>

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
    .panel {
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 20px;
      max-width: 720px;
    }
    .desc { color: var(--muted, #888); font-size: 0.9rem; margin-bottom: 18px; line-height: 1.6; }
    .form-row { display: flex; gap: 14px; flex-wrap: wrap; margin-bottom: 14px; }
    label { display: flex; flex-direction: column; gap: 6px; font-size: 0.88rem; color: var(--muted, #888); flex: 1; min-width: 180px; }
    label.short { flex: 0 0 130px; min-width: 0; }
    input { padding: 8px 10px; border-radius: 8px; border: 1px solid var(--border); background: transparent; color: var(--text); font-size: 0.9rem; }
    .hint { font-size: 0.82rem; color: var(--muted, #888); margin-bottom: 16px; }
    .hint a { color: var(--text); }
    button { padding: 10px 22px; border-radius: 10px; cursor: pointer; }
    button:disabled { opacity: 0.5; cursor: not-allowed; }
    .error { color: var(--danger, #b00); margin-top: 12px; font-size: 0.9rem; }

    .report-panel {
      margin-top: 28px;
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 24px;
      max-width: 860px;
    }
    .report-meta {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
      font-size: 0.88rem;
      color: var(--muted, #888);
    }
    .print-btn {
      padding: 6px 14px;
      font-size: 0.82rem;
      border-radius: 8px;
    }
    .report-body {
      line-height: 1.7;
      font-size: 0.92rem;
    }
    .report-body :deep(h2) { font-size: 1.1rem; margin: 20px 0 8px; }
    .report-body :deep(h3) { font-size: 0.98rem; margin: 16px 0 6px; color: var(--muted); }
    .report-body :deep(table) { width: 100%; border-collapse: collapse; margin: 12px 0; }
    .report-body :deep(th), .report-body :deep(td) { padding: 8px 12px; border: 1px solid var(--border); text-align: left; font-size: 0.88rem; }
    .report-body :deep(th) { background: rgba(255,255,255,0.05); }
    .report-body :deep(ul) { padding-left: 20px; }
    .report-body :deep(li) { margin: 4px 0; }
  `]
})
export class InboxReportComponent {
  daysBack = 90;
  maxEmails = 40;
  loading = false;
  error = '';
  reportHtml: SafeHtml | null = null;
  emailCount = 0;

  constructor(private api: ApiService, private sanitizer: DomSanitizer) {}

  generate() {
    this.error = '';
    this.reportHtml = null;
    this.loading = true;

    this.api.generateInboxReport('', this.daysBack, this.maxEmails).subscribe({
      next: (res) => {
        this.emailCount = res.email_count;
        this.reportHtml = this.sanitizer.bypassSecurityTrustHtml(res.html);
        this.loading = false;
      },
      error: (e) => {
        const detail = e?.error?.detail;
        this.error = Array.isArray(detail)
          ? detail.map((d: any) => d.msg || JSON.stringify(d)).join('; ')
          : detail || e?.message || `HTTP ${e?.status}: Błąd generowania raportu`;
        this.loading = false;
      },
    });
  }

  print() {
    window.print();
  }
}
