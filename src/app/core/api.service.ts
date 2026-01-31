import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';

export interface SubscriberDto { id: string; email: string; status?: string; created_at?: string; }
export interface FileDto { id: string; filename: string; status: string; uploaded_at?: string; }
export interface NewsletterDto { id: string; subject: string; created_at: string; }
export interface NewsletterDetailDto { id: string; subject: string; html_body: string; text_body: string; created_at: string; }
export interface JobStatusDto { status: 'queued'|'running'|'done'|'failed'; newsletterId?: string; progress?: number; error?: string; }

@Injectable({ providedIn: 'root' })
export class ApiService {
  private base = environment.apiBaseUrl;

  constructor(private http: HttpClient) {}

  // Auth
  register(email: string, password: string) {
    return this.http.post(`${this.base}/auth/register`, { email, password }, { withCredentials: true });
  }
  login(email: string, password: string) {
    return this.http.post<{ accessToken: string }>(`${this.base}/auth/login`, { email, password }, { withCredentials: true });
  }
  refresh() {
    return this.http.post<{ accessToken: string }>(`${this.base}/auth/refresh`, {}, { withCredentials: true });
  }
  logout() {
    return this.http.post(`${this.base}/auth/logout`, {}, { withCredentials: true });
  }

  // Subscribers
  listSubscribers() {
    return this.http.get<SubscriberDto[]>(`${this.base}/subscribers`, { withCredentials: true });
  }
  addSubscriber(email: string) {
    return this.http.post(`${this.base}/subscribers`, { email }, { withCredentials: true });
  }
  deleteSubscriber(id: string) {
    return this.http.delete(`${this.base}/subscribers/${id}`, { withCredentials: true });
  }
  importSubscribers(emails: string[]) {
    return this.http.post(`${this.base}/subscribers/import`, { emails }, { withCredentials: true });
  }

  // Files
  listFiles() {
    return this.http.get<FileDto[]>(`${this.base}/files`, { withCredentials: true });
  }
  presignUpload(filename: string, mime: string, size: number) {
    return this.http.post<{ uploadUrl: string; fileId: string }>(
      `${this.base}/files/presign`,
      { filename, mime, size },
      { withCredentials: true },
    );
  }
  completeUpload(fileId: string) {
    return this.http.post(`${this.base}/files/complete`, { fileId }, { withCredentials: true });
  }
  deleteFile(fileId: string) {
    return this.http.delete(`${this.base}/files/${fileId}`, { withCredentials: true });
  }

  // Newsletters
  listNewsletters() {
    return this.http.get<NewsletterDto[]>(`${this.base}/newsletters`, { withCredentials: true });
  }
  getNewsletter(id: string) {
    return this.http.get<NewsletterDetailDto>(`${this.base}/newsletters/${id}`, { withCredentials: true });
  }

  // Jobs
  createJob(payload: { fileIds: string[]; subscriberEmails: string[]; language: string; tone: string; maxLength: number; }) {
    return this.http.post<{ jobId: string }>(`${this.base}/newsletter/jobs`, payload, { withCredentials: true });
  }
  getJob(jobId: string) {
    return this.http.get<JobStatusDto>(`${this.base}/newsletter/jobs/${jobId}`, { withCredentials: true });
  }
}
