# SMRITI — API Specification

---

## Base URL
- **Production:** `https://smriti-backup.vercel.app/api`
- **Development:** `http://localhost:3000/api`

## Authentication
All endpoints (except `/health`) require a valid Supabase JWT in the `Authorization` header:
```
Authorization: Bearer <supabase_access_token>
```

---

## Endpoints

### GET /api/health
Health check for offline detection probe.

**Response 200:**
```json
{ "ok": true, "timestamp": 1693000000000 }
```

---

### POST /api/sync
Push local telemetry and pull server updates. Core sync endpoint.

**Request body:**
```json
{
  "deviceId": "uuid-of-device",
  "lastSyncTimestamp": "2024-01-15T10:30:00Z",
  "patients": [
    {
      "patientId": "uuid",
      "sessions": [
        {
          "id": "uuid",
          "startedAt": "2024-01-15T09:00:00Z",
          "endedAt": "2024-01-15T09:15:00Z"
        }
      ],
      "events": [
        {
          "id": "uuid",
          "sessionId": "uuid",
          "gameType": "object_hunt",
          "difficultyLevel": 3,
          "roundNumber": 1,
          "isCorrect": true,
          "responseTimeMs": 2340,
          "eventTimestamp": "2024-01-15T09:02:15Z",
          "metadata": { "targetObject": "gamosa", "selectedTile": 3, "correctTile": 3 }
        }
      ],
      "dailySummaries": [
        {
          "patientId": "uuid",
          "summaryDate": "2024-01-15",
          "gameType": "object_hunt",
          "totalRounds": 8,
          "correctRounds": 6,
          "avgResponseTimeMs": 2100,
          "maxDifficultyReached": 4,
          "sessionCount": 1,
          "eloRating": 1215.50
        }
      ],
      "reminderAcks": [
        {
          "id": "uuid",
          "reminderId": "uuid",
          "scheduledAt": "2024-01-15T08:00:00Z",
          "acknowledgedAt": "2024-01-15T08:03:22Z",
          "ackMethod": "touch"
        }
      ]
    }
  ]
}
```

**Response 200:**
```json
{
  "serverTimestamp": "2024-01-15T10:35:00Z",
  "syncedEventCount": 12,
  "updates": {
    "patients": [
      {
        "id": "uuid",
        "displayName": "Updated Name",
        "sessionDurationMinutes": 10,
        "updatedAt": "2024-01-15T10:20:00Z"
      }
    ],
    "reminders": [
      {
        "id": "uuid",
        "patientId": "uuid",
        "reminderType": "medication",
        "label": "New evening pill",
        "timeOfDay": "20:00",
        "daysOfWeek": [0,1,2,3,4,5,6],
        "isActive": true,
        "updatedAt": "2024-01-15T10:25:00Z"
      }
    ],
    "alerts": [
      {
        "id": "uuid",
        "patientId": "uuid",
        "alertType": "cognitive_drop",
        "severity": "red",
        "title": "Sudden cognitive score drop detected",
        "description": "Accuracy in object_hunt dropped to 35% (7-day avg: 72%). Please check on the patient.",
        "createdAt": "2024-01-15T10:35:00Z"
      }
    ]
  }
}
```

**Error 401:** Invalid or expired token
**Error 429:** Rate limited (max 1 sync/30 seconds)

---

### GET /api/patients
Get caregiver's patient list with latest summary data.

**Response 200:**
```json
{
  "patients": [
    {
      "id": "uuid",
      "displayName": "Patient Name",
      "ageYears": 72,
      "primaryLanguage": "as",
      "isActive": true,
      "latestSummary": {
        "date": "2024-01-15",
        "overallAccuracy": 75.5,
        "sessionsThisWeek": 5,
        "reminderAdherence": 82.3
      },
      "alertStatus": "green",
      "lastSessionAt": "2024-01-15T09:15:00Z"
    }
  ]
}
```

---

### GET /api/patients/[id]/timeline
Get longitudinal data for dashboard graphs.

**Query params:**
- `range`: `30d` | `90d` | `180d` (default: `30d`)
- `gameType`: `object_hunt` | `word_stream` | `quick_tap` | `path_match` | `all` (default: `all`)

**Response 200:**
```json
{
  "patientId": "uuid",
  "range": "30d",
  "dataPoints": [
    {
      "date": "2024-01-01",
      "gameType": "object_hunt",
      "accuracy": 68.5,
      "avgResponseTimeMs": 2400,
      "maxDifficulty": 3,
      "sessionCount": 1,
      "eloRating": 1180.25
    }
  ],
  "trends": {
    "object_hunt": "stable",
    "word_stream": "improving",
    "quick_tap": "declining",
    "path_match": "stable"
  }
}
```

---

### GET /api/patients/[id]/adherence
Get reminder adherence data.

**Query params:**
- `range`: `7d` | `30d` (default: `7d`)

**Response 200:**
```json
{
  "patientId": "uuid",
  "range": "7d",
  "overall": {
    "totalReminders": 42,
    "acknowledged": 35,
    "adherenceRate": 83.3
  },
  "byType": {
    "medication": { "total": 14, "acknowledged": 13, "rate": 92.9 },
    "hydration": { "total": 21, "acknowledged": 16, "rate": 76.2 },
    "activity": { "total": 7, "acknowledged": 6, "rate": 85.7 }
  },
  "missed": [
    {
      "reminderLabel": "Morning pill",
      "scheduledAt": "2024-01-14T08:00:00Z",
      "type": "medication"
    }
  ]
}
```

---

### GET /api/alerts
Get unresolved alerts for the caregiver.

**Response 200:**
```json
{
  "alerts": [
    {
      "id": "uuid",
      "patientId": "uuid",
      "patientName": "Patient Name",
      "alertType": "cognitive_drop",
      "severity": "red",
      "title": "Sudden cognitive score drop",
      "description": "...",
      "isRead": false,
      "createdAt": "2024-01-15T10:35:00Z"
    }
  ],
  "counts": { "red": 1, "yellow": 2, "green": 0 }
}
```

---

### PATCH /api/alerts/[id]
Mark alert as read or resolved.

**Request body:**
```json
{ "isRead": true }
```
or
```json
{ "isResolved": true }
```

**Response 200:**
```json
{ "success": true }
```
