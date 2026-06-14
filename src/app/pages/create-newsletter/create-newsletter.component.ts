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
    <div class="error" *ngIf="uploadValidationError">{{uploadValidationError}}</div>
    <div class="list" *ngIf="uploads.length">
      <div class="item" *ngFor="let u of uploads">
        <div>
          <div><b>{{u.file.name}}</b> ({{u.file.size}} bytes)</div>
          <div class="muted">{{u.status}} <span class="err" *ngIf="u.error">- {{u.error}}</span></div>
        </div>
      </div>
    </div>
    <button (click)="uploadAll()" [disabled]="uploading || !uploads.length || uploadBlockedByLimit">Upload selected</button>
    <div class="error" *ngIf="uploadBlockedByLimit">
      Upload blocked: file limit is {{maxUploadedFiles}}. Delete old PDFs first.
    </div>
    <div class="muted">Only PDFs uploaded in this step are used for this job.</div>
  </section>

  <section class="panel">
    <h2>Uploaded PDF library</h2>
    <div class="meter-wrap">
      <div class="meter-title">
        <span>File slots</span>
        <b>{{uploadedFilesCount}} / {{maxUploadedFiles}}</b>
      </div>
      <div class="meter">
        <div class="bar" [ngClass]="uploadedFilesProgressClass" [style.width.%]="uploadedFilesProgressPct"></div>
      </div>
    </div>
    <div class="meter-wrap">
      <div class="meter-title">
        <span>Stored size</span>
        <b>{{totalStoredMb}} MB / {{maxStoredMb}} MB</b>
      </div>
      <div class="meter">
        <div class="bar" [ngClass]="totalStoredProgressClass" [style.width.%]="totalStoredProgressPct"></div>
      </div>
    </div>
    <div class="warn" *ngIf="uploadedFilesCount > maxRecommendedUploadedFiles">
      You have {{uploadedFilesCount}} uploaded files.
      Large history may produce oversized RAG context and slower generation.
      Delete old files you no longer need.
    </div>
    <div class="error" *ngIf="filesError">{{filesError}}</div>
    <div class="list" *ngIf="files.length; else emptyFiles">
      <div class="item file-item" *ngFor="let f of files">
        <label class="file-select">
          <input type="checkbox"
            [checked]="selectedLibraryIds.has(f.id)"
            [disabled]="f.status !== 'ready' && f.status !== 'uploaded'"
            (change)="toggleLibraryFile(f.id, $event)" />
          <div>
            <div><b>{{f.filename}}</b></div>
            <div class="muted">status: {{f.status}} <span *ngIf="f.uploaded_at">| uploaded: {{f.uploaded_at}}</span></div>
          </div>
        </label>
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
    <div class="muted">
      Selected input size: {{selectedUploadMb}} MB / {{maxJobInputMb}} MB
    </div>
    <div class="warn" *ngIf="selectedUploadBytes > maxJobInputBytes">
      Selected files exceed generation limit. Remove large files or upload fewer PDFs.
    </div>

    <button (click)="generate()" [disabled]="generating || selectedUploadBytes > maxJobInputBytes">
      Generate
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
    .file-select { display: flex; gap: 10px; align-items: center; cursor: pointer; flex: 1; }
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
    .meter-wrap { margin: 8px 0 10px; }
    .meter-title { display: flex; justify-content: space-between; font-size: 13px; color: #555; margin-bottom: 4px; }
    .meter { height: 10px; border-radius: 999px; background: #e9edf5; overflow: hidden; }
    .bar { height: 100%; transition: width 200ms ease; }
    .bar.ok { background: #1f9d55; }
    .bar.warn { background: #d97706; }
    .bar.danger { background: #dc2626; }
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
  readonly maxUploadedFiles = 20;
  readonly maxTotalStoredBytes = 120 * 1024 * 1024;
  readonly maxJobInputBytes = 20 * 1024 * 1024;

  uploads: UploadItem[] = [];
  uploading = false;
  generating = false;
  error = '';
  filesError = '';
  uploadValidationError = '';

  subs: SubscriberDto[] = [];
  selected = new Set<string>();
  files: FileDto[] = [];
  selectedLibraryIds = new Set<string>();

  language = 'pl';
  tone = 'professional';
  maxLength = 900;

  constructor(private api: ApiService, private router: Router) {
    this.loadSubs();
    this.loadFiles();
  }

  get uploadedFilesCount() {
    return this.files.filter((f) => f.status === 'uploaded' || f.status === 'ready').length;
  }

  get uploadBlockedByLimit() {
    return this.uploadedFilesCount + this.uploads.length > this.maxUploadedFiles;
  }

  get selectedUploadBytes() {
    return this.uploads
      .filter((u) => u.status === 'done')
      .reduce((sum, u) => sum + u.file.size, 0);
  }

  get selectedUploadMb() {
    return (this.selectedUploadBytes / (1024 * 1024)).toFixed(1);
  }

  get maxJobInputMb() {
    return (this.maxJobInputBytes / (1024 * 1024)).toFixed(0);
  }

  get uploadedFilesProgressPct() {
    return Math.min(100, Math.round((this.uploadedFilesCount / this.maxUploadedFiles) * 100));
  }

  get uploadedFilesProgressClass() {
    if (this.uploadedFilesProgressPct >= 90) return 'danger';
    if (this.uploadedFilesProgressPct >= 70) return 'warn';
    return 'ok';
  }

  get totalStoredBytes() {
    return this.files.reduce((sum, f) => sum + (f.size || 0), 0);
  }

  get totalStoredMb() {
    return (this.totalStoredBytes / (1024 * 1024)).toFixed(1);
  }

  get maxStoredMb() {
    return (this.maxTotalStoredBytes / (1024 * 1024)).toFixed(0);
  }

  get totalStoredProgressPct() {
    return Math.min(100, Math.round((this.totalStoredBytes / this.maxTotalStoredBytes) * 100));
  }

  get totalStoredProgressClass() {
    if (this.totalStoredProgressPct >= 90) return 'danger';
    if (this.totalStoredProgressPct >= 70) return 'warn';
    return 'ok';
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
      this.selectedLibraryIds = new Set(
        this.files.filter(f => f.status === 'ready' || f.status === 'uploaded').map(f => String(f.id))
      );
    } catch (e: any) {
      this.filesError = e?.error?.detail || 'Failed to load uploaded files.';
    }
  }

  toggleLibraryFile(id: string, ev: Event) {
    if ((ev.target as HTMLInputElement).checked) this.selectedLibraryIds.add(String(id));
    else this.selectedLibraryIds.delete(String(id));
  }

  onFiles(ev: Event) {
    const input = ev.target as HTMLInputElement;
    const raw = Array.from(input.files || []);
    const files = raw.filter((f) => {
      const isPdf = f.type.toLowerCase() === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf');
      return isPdf;
    });
    if (files.length !== raw.length) {
      this.uploadValidationError = 'Only PDF files are allowed.';
    } else {
      this.uploadValidationError = '';
    }
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
    this.uploadValidationError = '';

    const projectedCount = this.uploadedFilesCount + this.uploads.length;
    if (projectedCount > this.maxUploadedFiles) {
      this.uploadValidationError = `Upload blocked: file limit is ${this.maxUploadedFiles}. Delete old PDFs first.`;
      return;
    }

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
      const uploadedIds = this.uploads
        .filter((u) => u.status === 'done' && u.fileId)
        .map((u) => u.fileId as string);
      const libraryIds = Array.from(this.selectedLibraryIds);
      const fileIds = [...new Set([...uploadedIds, ...libraryIds])];

      if (!fileIds.length) {
        throw new Error('Select at least one PDF from the library or upload a new one.');
      }

      if (this.selectedUploadBytes > this.maxJobInputBytes) {
        throw new Error(
          `Selected files are too large for generation (${this.selectedUploadMb} MB). Limit is ${this.maxJobInputMb} MB.`,
        );
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
      this.error = e?.error?.detail || e?.message || 'Generate failed';
      this.generating = false;
    }
  }
}
