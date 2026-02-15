import { FormsModule } from '@angular/forms';
import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService, FileDto, SubscriberDto } from '../../core/api.service';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';

type UploadItem = {
  file: File;
  status: 'pending' | 'uploading' | 'done' | 'failed';
  fileId?: string;
  error?: string;
};

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
  <h1>Create newsletter</h1>

  <section class="panel">
    <h2>1) Upload PDF documents</h2>
    <input type="file" accept="application/pdf" multiple (change)="onFiles($event)" />
    <div class="list" *ngIf="uploads.length">
      <div class="item" *ngFor="let u of uploads">
        <div>
          <div><b>{{u.file.name}}</b> ({{u.file.size}} bytes)</div>
          <div class="muted">{{u.status}} <span class="err" *ngIf="u.error">- {{u.error}}</span></div>
        </div>
      </div>
    </div>
    <button (click)="uploadAll()" [disabled]="uploading || !uploads.length">Upload selected</button>
    <div class="muted">Only PDFs uploaded in this step are used for this job.</div>
  </section>

  <section class="panel">
    <h2>Uploaded PDF library</h2>
    <div class="warn" *ngIf="uploadedFilesCount > maxRecommendedUploadedFiles">
      You have {{uploadedFilesCount}} uploaded files.
      Large history may produce oversized RAG context and slower generation.
      Delete old files you no longer need.
    </div>
    <div class="error" *ngIf="filesError">{{filesError}}</div>
    <div class="list" *ngIf="files.length; else emptyFiles">
      <div class="item file-item" *ngFor="let f of files">
        <div>
          <div><b>{{f.filename}}</b></div>
          <div class="muted">status: {{f.status}} <span *ngIf="f.uploaded_at">| uploaded: {{f.uploaded_at}}</span></div>
        </div>
        <button class="danger" (click)="deleteFile(f.id)">Delete</button>
      </div>
    </div>
    <ng-template #emptyFiles>
      <div class="muted">No uploaded files yet.</div>
    </ng-template>
  </section>

  <section class="panel">
    <h2>2) Choose subscribers</h2>
    <div class="muted">Select recipients, or keep all selected.</div>

    <div class="row">
      <button (click)="selectAll()">Select all</button>
      <button (click)="selectNone()">Select none</button>
      <span class="muted">Selected: {{selectedEmails().length}} / {{subs.length}}</span>
    </div>

    <div class="subs" *ngIf="subs.length">
      <label class="sub" *ngFor="let s of subs">
        <input type="checkbox" [checked]="selected.has(s.email)" (change)="toggle(s.email, $event)" />
        <span>{{s.email}}</span>
      </label>
    </div>
  </section>

  <section class="panel">
    <h2>3) Generate</h2>
    <div class="row">
      <label>Language
        <select [(ngModel)]="language">
          <option value="pl">pl</option>
          <option value="en">en</option>
        </select>
      </label>

      <label>Tone
        <select [(ngModel)]="tone">
          <option value="professional">professional</option>
          <option value="friendly">friendly</option>
          <option value="concise">concise</option>
        </select>
      </label>

      <label>Max length
        <input type="number" [(ngModel)]="maxLength" />
      </label>
    </div>

    <div class="error" *ngIf="error">{{error}}</div>

    <button (click)="generate()" [disabled]="generating">
      Generate & Send
    </button>

    <div class="muted">
      Generation will use files uploaded in this screen and marked as done.
    </div>
  </section>
  `,
  styles: [`
    .panel { border: 1px solid #ddd; border-radius: 10px; padding: 14px; margin: 14px 0; max-width: 980px; }
    .list { margin-top: 10px; display: flex; flex-direction: column; gap: 8px; }
    .item { padding: 10px; border: 1px solid #eee; border-radius: 8px; }
    .file-item { display: flex; justify-content: space-between; align-items: center; gap: 12px; }
    .muted { color: #666; font-size: 13px; }
    .err { color: #b00; }
    .warn {
      margin: 8px 0;
      padding: 10px;
      border: 1px solid #e0a800;
      border-radius: 8px;
      background: #fff7e6;
      color: #7a5700;
    }
    .row { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; margin: 10px 0; }
    .subs { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 6px; margin-top: 10px; }
    .sub { display: flex; gap: 8px; align-items: center; border: 1px solid #eee; border-radius: 8px; padding: 8px; }
    .error { color: #b00; margin: 10px 0; }
    .danger {
      border: 1px solid #d64545;
      color: #d64545;
      background: transparent;
      border-radius: 8px;
      padding: 6px 10px;
      cursor: pointer;
    }
    input[type="number"] { width: 120px; }
    select { padding: 6px; }
  `],
})
export class CreateNewsletterComponent {
  readonly maxRecommendedUploadedFiles = 12;

  uploads: UploadItem[] = [];
  uploading = false;
  generating = false;
  error = '';
  filesError = '';

  subs: SubscriberDto[] = [];
  selected = new Set<string>();
  files: FileDto[] = [];

  language = 'pl';
  tone = 'professional';
  maxLength = 900;

  constructor(private api: ApiService, private router: Router) {
    this.loadSubs();
    this.loadFiles();
  }

  get uploadedFilesCount() {
    return this.files.filter((f) => f.status === 'uploaded').length;
  }

  async loadSubs() {
    const subs = await firstValueFrom(this.api.listSubscribers());
    this.subs = subs;
    subs.forEach((s) => this.selected.add(s.email));
  }

  async loadFiles() {
    this.filesError = '';
    try {
      this.files = await firstValueFrom(this.api.listFiles());
    } catch (e: any) {
      this.filesError = e?.error?.detail || 'Failed to load uploaded files.';
    }
  }

  onFiles(ev: Event) {
    const input = ev.target as HTMLInputElement;
    const files = Array.from(input.files || []);
    this.uploads = files.map((f) => ({ file: f, status: 'pending' }));
  }

  selectedEmails() {
    return Array.from(this.selected);
  }

  toggle(email: string, ev: Event) {
    const checked = (ev.target as HTMLInputElement).checked;
    if (checked) this.selected.add(email);
    else this.selected.delete(email);
  }

  selectAll() {
    this.subs.forEach((s) => this.selected.add(s.email));
  }

  selectNone() {
    this.selected.clear();
  }

  async uploadAll() {
    this.error = '';
    this.uploading = true;

    for (const u of this.uploads) {
      try {
        u.status = 'uploading';

        const presign = await firstValueFrom(
          this.api.presignUpload(u.file.name, u.file.type || 'application/pdf', u.file.size),
        );

        await fetch(presign.uploadUrl, {
          method: 'PUT',
          headers: { 'Content-Type': u.file.type || 'application/pdf' },
          body: u.file,
        });

        await firstValueFrom(this.api.completeUpload(presign.fileId));
        u.fileId = presign.fileId;
        u.status = 'done';
      } catch (e: any) {
        u.status = 'failed';
        u.error = e?.message || 'Upload failed';
      }
    }

    this.uploading = false;
    await this.loadFiles();
  }

  async deleteFile(fileId: string) {
    if (!confirm('Delete this uploaded PDF?')) return;
    this.filesError = '';
    try {
      await firstValueFrom(this.api.deleteFile(fileId));
      this.files = this.files.filter((f) => f.id !== fileId);
    } catch (e: any) {
      this.filesError = e?.error?.detail || 'Delete failed.';
    }
  }

  async generate() {
    this.error = '';
    this.generating = true;

    try {
      const fileIds = this.uploads
        .filter((u) => u.status === 'done' && u.fileId)
        .map((u) => u.fileId as string);

      if (!fileIds.length) {
        throw new Error('Upload at least one PDF first (Upload selected).');
      }

      const subscriberEmails = this.selectedEmails();
      if (!subscriberEmails.length) {
        throw new Error('Select at least one subscriber.');
      }

      const { jobId } = await firstValueFrom(
        this.api.createJob({
          fileIds,
          subscriberEmails,
          language: this.language,
          tone: this.tone,
          maxLength: this.maxLength,
        }),
      );

      this.router.navigateByUrl(`/app/jobs/${jobId}`);
    } catch (e: any) {
      this.error = e?.message || 'Generate failed';
      this.generating = false;
    }
  }
}
