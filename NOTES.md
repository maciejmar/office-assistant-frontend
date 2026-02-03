# Notes

## Tokens
- access token: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxIiwiZXhwIjoxNzcwMDc1Njc0fQ.1Dpihd3UPZlTRT6at4CBfYWg6QBL_dvpt76ATktKcp4
- refresh token cookie: oa_refresh=(paste here)
- issued at: (date/time)

## Services
- backend URL: http://localhost:8001
- extract endpoint: /api/extract-text
- n8n webhook: http://localhost:5678/webhook/office-assistant/newsletter/generate

## Useful commands
- start backend (local): python -m uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload
- test extract: curl.exe -i -X POST -F "file=@test.txt" http://localhost:8001/api/extract-text
- check auth: curl.exe -i -H "Authorization: Bearer $env:TOKEN" http://localhost:8001/api/files

## n8n
- workflow: Office Assistant - RAG Newsletter (Cloud-ready skeleton)
- external extract node: HTTP - External Extract Text (PDF/DOCX)
- expected binary field: data
- content type: n8n Binary File (or multipart/form-data with file)
- extract URL (from n8n): http://host.docker.internal:8001/api/extract-text
