# Novel Reader API Documentation

## Version
Current API Version: 1.0

## Base URL
```
http://localhost:8000
```

## Endpoints

### 1. Health Check

#### 1.1 Health Status
```http
GET /health
```
Get the health status of the API service.

Response:
```json
{
  "status": "healthy",
  "env": "development"
}
```

### 2. Novel Management

#### 2.1 Get All Novels
```http
GET /novels
```
Returns a list of all available novels from Cloudflare D1.

Response format:
```json
[
  {
    "id": "shadow-slave",
    "slug": "shadow-slave",
    "title": "Shadow Slave",
    "author": "Guiltythree",
    "chapterCount": 1500,
    "source": "cloudflare_d1",
    "description": "Novel description text"
  }
]
```

#### 2.2 Upload EPUB Novel
```http
POST /upload-epub
Content-Type: multipart/form-data
```
Upload and parse an EPUB file. Text and metadata are stored in Cloudflare D1/R2, and images in Supabase.

Request:
- Form data with key `file` containing the EPUB file

Response:
```json
{
  "title": "Novel Title",
  "author": "Author Name",
  "chapterCount": 85,
  "message": "Novel uploaded to D1 + R2 with 5 images"
}
```

### 3. Chapter Management

#### 3.1 Get Chapters List
```http
GET /chapters-with-pages/{novel_name}?page={page_number}
```
Get a paginated list of chapters for a novel from Cloudflare D1.

Parameters:
- `novel_name`: The slug or title of the novel (URL encoded)
- `page`: Page number (optional, defaults to 1)

Response:
```json
{
  "chapters": [
    {
      "chapterNumber": 1,
      "chapterTitle": "Chapter 1",
      "id": "novel-slug_ch_1",
      "wordCount": 1200
    }
  ],
  "total_pages": 15,
  "current_page": 1
}
```

#### 3.2 Get Chapter Content
```http
GET /chapter?chapterNumber={number}&novelName={name}
```
Get the content of a specific chapter. Metadata is fetched from D1 and content streams from R2.

Parameters:
- `chapterNumber`: The chapter number
- `novelName`: The slug or title of the novel

Response:
```json
{
  "chapterNumber": 1,
  "chapterTitle": "Chapter 1",
  "content": [
    "Paragraph 1",
    "Paragraph 2"
  ]
}
```

### 4. Text-to-Speech

#### 4.1 Convert Text to Speech with Dual Voices
```http
POST /tts-dual-voice
```
Convert text to speech using Edge TTS with dual voices (one for paragraphs and one for dialogue).

Request (JSON):
```json
{
  "text": "Text to convert to speech",
  "paragraphVoice": "en-US-ChristopherNeural",
  "dialogueVoice": "en-US-JennyNeural"
}
```

Response:
- Audio file (audio/mp3)

#### 4.2 Convert Chapter to Speech with Dual Voices
```http
GET /novel-with-tts?novelName={name}&chapterNumber={number}&voice={voice}&dialogueVoice={dialogueVoice}
```
Fetch a novel chapter and convert it to speech using dual voices. The generated audio includes the chapter title followed by the content.

Response:
- Audio file (audio/mp3)
- Headers: `Content-Disposition: attachment; filename=chapter_{chapterNumber}.mp3`

### 5. Images Management

#### 5.1 Get Novel Image
```http
GET /novel/{novel_id}/image/{image_id}
```
Retrieve a single embedded image from Supabase.

#### 5.2 List Novel Images
```http
GET /novel/{novel_id}/images
```
List all images embedded in the EPUB.

Response format:
```json
{
  "novelId": "novel-id",
  "images": [
    {
      "id": "image-id-1",
      "originalPath": "OEBPS/images/cover.jpg",
      "contentType": "image/jpeg",
      "size": 102400,
      "url": "/novel/{novel_id}/image/image-id-1"
    }
  ],
  "count": 1
}
```

### 6. User Management

#### 6.1 User Login
```http
POST /userLogin
```
Login with username and password.

Request:
```json
{
  "username": "user",
  "password": "pass"
}
```

#### 6.2 User Registration
```http
POST /register
```
Register a new user in D1.

Request:
```json
{
  "username": "user",
  "password": "pass"
}
```

#### 6.3 Save Reading Progress
```http
POST /user/progress
```
Save or update user's reading progress for a novel in D1.

Request:
```json
{
  "username": "user",
  "novelName": "novel-slug",
  "lastChapterRead": 10
}
```

#### 6.4 Get User Progress
```http
GET /user/progress?username={username}
```
Get all reading progress for a user.

Response:
```json
{
  "progress": [
    {
      "novelName": "novel-slug",
      "lastChapterRead": 10
    }
  ]
}
```

#### 6.5 Get Novel Progress
```http
GET /user/progress/{novelName}?username={username}
```
Get user's reading progress for a specific novel.

Response:
```json
{
  "novelName": "novel-title",
  "lastChapterRead": 10
}
```

### 7. Downloading

#### 7.1 Download Chapter Content
```http
GET /download-chapter/{novel_name}/{chapter_number}?voice={voice}&dialogue_voice={dialogue_voice}&progress_id={progress_id}
```
Download a ZIP file containing the chapter JSON content and audio generated using dual voices.

Response:
- Streamed ZIP archive (application/zip)

#### 7.2 Get Download Progress
```http
GET /download/progress/{progress_id}
```
Checks the progress of a given download operation.

Response:
```json
{
  "status": "processing",
  "total": 50,
  "current": 25,
  "percent": 50.0
}
```

## Error Responses

The API uses standard HTTP status codes and returns error details in JSON format:

```json
{
  "detail": "Error message describing what went wrong"
}
```

Common error status codes:
- 400: Bad Request (e.g., invalid input)
- 401: Unauthorized (e.g., invalid login)
- 404: Not Found (e.g., novel or user not found)
- 500: Internal Server Error

## Data Structures

### Database Structure (Cloudflare D1)
```sql
novels (
  id TEXT PRIMARY KEY,
  title TEXT,
  author TEXT,
  description TEXT,
  total_chapters INTEGER
)

chapters (
  id TEXT PRIMARY KEY,
  novel_id TEXT,
  chapter_number INTEGER,
  title TEXT,
  r2_content_path TEXT,
  word_count INTEGER
)

users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE,
  password TEXT
)

user_progress (
  user_id INTEGER,
  novel_id TEXT,
  chapter_number INTEGER
)
```

## Architecture Changes

1. Fully migrated off Firebase to Cloudflare D1 + R2 for scalable reads
2. EPUB images remain on Supabase storage
3. Text content is decompressed on-the-fly from gzip files in Cloudflare R2
4. Included new multi-voice offline TTS downloads and streaming TTS
