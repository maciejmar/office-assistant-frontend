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
      </div>

      <h2>HTML preview</h2>
      <div class="preview" [innerHTML]="item.html_body"></div>

      <h2>Text</h2>
      <pre class="text">{{item.text_body}}</pre>
    </div>
  `,
  styles: [`
    .muted { color:#666; margin-bottom: 10px; }
    .row { margin: 10px 0; }
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

  constructor(private route: ActivatedRoute, private api: ApiService) {
    const id = this.route.snapshot.paramMap.get('id')!;
    this.api.getNewsletter(id).subscribe(n => this.item = n);
  }
}
