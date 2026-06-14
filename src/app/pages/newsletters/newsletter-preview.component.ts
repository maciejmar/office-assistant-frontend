import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ApiService, NewsletterDetailDto } from '../../core/api.service';

@Component({
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div *ngIf="item">
      <h1>{{item.subject}}</h1>
      <div class="muted">{{item.created_at}}</div>

      <div class="row">
        <a routerLink="/app/newsletters">Back</a>
        <button
          *ngIf="!sentCount"
          [disabled]="sending"
          (click)="send()"
        >
          {{ sending ? 'Sending…' : 'Send to ' + (item.pending_subscriber_count ?? 0) + ' subscribers' }}
        </button>
        <span class="ok" *ngIf="sentCount">Sent to {{sentCount}} subscribers.</span>
        <span class="err" *ngIf="sendError">{{sendError}}</span>
      </div>

      <h2>HTML preview</h2>
      <div class="preview" [innerHTML]="item.html_body"></div>

      <h2>Text</h2>
      <pre class="text">{{item.text_body}}</pre>
    </div>
  `,
  styles: [`
    .muted { color:#666; margin-bottom: 10px; }
    .row { margin: 10px 0; display: flex; gap: 12px; align-items: center; flex-wrap: wrap; }
    .ok { color: #0a7a2f; font-weight: 600; }
    .err { color: #b00; }
    .preview {
      border:1px solid #ddd;
      border-radius:10px;
      padding: 14px;
      max-width: 980px;
      overflow-x: auto;
      overflow-wrap: anywhere;
      word-break: break-word;
    }
    .preview :where(pre, code) {
      white-space: pre-wrap;
      word-break: break-word;
      overflow-wrap: anywhere;
    }
    .preview :where(img, table, iframe) {
      max-width: 100%;
      height: auto;
    }
    .text {
      border:1px solid #ddd;
      border-radius:10px;
      padding: 14px;
      max-width: 980px;
      white-space: pre-wrap;
      overflow-wrap: anywhere;
      word-break: break-word;
    }
  `]
})
export class NewsletterPreviewComponent {
  item: NewsletterDetailDto | null = null;
  sending = false;
  sentCount: number | null = null;
  sendError = '';
  private newsletterId = '';

  constructor(private route: ActivatedRoute, private api: ApiService) {
    this.newsletterId = this.route.snapshot.paramMap.get('id')!;
    this.api.getNewsletter(this.newsletterId).subscribe(n => this.item = n);
  }

  send() {
    this.sendError = '';
    this.sending = true;
    this.api.sendNewsletter(this.newsletterId).subscribe({
      next: (r) => {
        this.sentCount = r.sent_count;
        this.sending = false;
      },
      error: (e) => {
        this.sendError = e?.error?.detail || 'Send failed';
        this.sending = false;
      },
    });
  }
}
