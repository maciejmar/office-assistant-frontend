import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService, UsageSummaryDto, UsageHistoryItemDto } from '../../core/api.service';

@Component({
  standalone: true,
  imports: [CommonModule],
  template: `
    <h1>Koszty AI</h1>

    <div *ngIf="loading" class="muted">Ładowanie...</div>
    <div *ngIf="error" class="error-msg">{{ error }}</div>

    <ng-container *ngIf="summary && !loading">
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-label">Ten miesiąc</div>
          <div class="stat-value">\${{ summary.month_cost_usd | number:'1.4-6' }}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Łącznie</div>
          <div class="stat-value">\${{ summary.total_cost_usd | number:'1.4-6' }}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Zapytań</div>
          <div class="stat-value">{{ summary.total_calls }}</div>
        </div>
      </div>

      <section class="panel" *ngIf="operationKeys.length">
        <h2>Podział wg operacji</h2>
        <table class="usage-table">
          <thead><tr><th>Operacja</th><th>Koszt (USD)</th></tr></thead>
          <tbody>
            <tr *ngFor="let op of operationKeys">
              <td>{{ op }}</td>
              <td>\${{ summary.by_operation[op] | number:'1.4-6' }}</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section class="panel">
        <h2>Historia (ostatnie 50)</h2>
        <table class="usage-table" *ngIf="history.length; else noHistory">
          <thead>
            <tr>
              <th>Data</th>
              <th>Operacja</th>
              <th>Model</th>
              <th>Tokeny we/wy</th>
              <th>Koszt (USD)</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let row of history">
              <td class="mono">{{ row.created_at | date:'dd.MM.yyyy HH:mm' }}</td>
              <td>{{ row.operation }}</td>
              <td class="mono">{{ row.model }}</td>
              <td class="mono">{{ row.input_tokens }}&nbsp;/&nbsp;{{ row.output_tokens }}</td>
              <td class="mono">\${{ row.cost_usd | number:'1.4-6' }}</td>
            </tr>
          </tbody>
        </table>
        <ng-template #noHistory><p class="muted">Brak historii.</p></ng-template>
      </section>
    </ng-container>
  `,
  styles: [`
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 1rem;
      margin-bottom: 1.5rem;
    }
    .stat-card {
      background: var(--surface-2, #1e1e2e);
      border: 1px solid rgba(255,255,255,0.08);
      border-radius: 8px;
      padding: 1.2rem 1.5rem;
    }
    .stat-label { font-size: 0.75rem; color: rgba(166,176,212,0.7); text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 0.4rem; }
    .stat-value { font-size: 1.6rem; font-weight: 600; color: #a855f7; }
    .usage-table { width: 100%; border-collapse: collapse; font-size: 0.88rem; }
    .usage-table th, .usage-table td { padding: 0.5rem 0.75rem; border-bottom: 1px solid rgba(255,255,255,0.06); text-align: left; }
    .usage-table th { color: rgba(166,176,212,0.7); font-weight: 500; }
    .mono { font-family: monospace; }
    .error-msg { color: #f87171; padding: 0.5rem 0; }
    @media (max-width: 600px) { .stats-grid { grid-template-columns: 1fr; } }
  `],
})
export class UsageComponent implements OnInit {
  summary: UsageSummaryDto | null = null;
  history: UsageHistoryItemDto[] = [];
  loading = true;
  error = '';

  constructor(private api: ApiService) {}

  ngOnInit() {
    this.api.getUsageSummary().subscribe({
      next: s => { this.summary = s; this.loadHistory(); },
      error: e => { this.error = e?.error?.detail ?? 'Błąd ładowania danych'; this.loading = false; },
    });
  }

  private loadHistory() {
    this.api.getUsageHistory(50).subscribe({
      next: h => { this.history = h; this.loading = false; },
      error: () => { this.loading = false; },
    });
  }

  get operationKeys(): string[] {
    return this.summary ? Object.keys(this.summary.by_operation) : [];
  }
}
