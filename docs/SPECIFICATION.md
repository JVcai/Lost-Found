> Historical product brief. Current scope is mobile-only Lost&Found. The web/admin requirements below are superseded by README.md and docs/STATUS.md.

Да. Ниже ТЗ уже не для учебного прототипа, а для **полноценной рабочей версии LostNet**, которую можно отдавать разработчику или использовать как основу для разработки.

# Техническое задание — LostNet

**Версия:** 1.0
**Тип продукта:** mobile-first Lost & Found platform
**Основная цель:** создать централизованную систему поиска потерянных и найденных вещей с AI-сопоставлением объявлений, геолокацией, уведомлениями и подтверждением владельца.

---

# 1. Общая концепция

LostNet позволяет пользователям:

- сообщить о потерянной вещи;
- сообщить о найденной вещи;
- добавить фотографию;
- указать место и время;
- получить автоматически найденные совпадения;
- связаться с владельцем / нашедшим;
- подтвердить право собственности;
- завершить возврат вещи.

Система должна работать для:

- университетов;
- школ;
- торговых центров;
- аэропортов;
- общественного транспорта;
- гостиниц;
- кафе;
- крупных компаний и кампусов.

---

# 2. Технологический стек

## Frontend

### Mobile
Рекомендуемый вариант:

**React Native + Expo + TypeScript**

Использовать:

- React Native;
- Expo;
- TypeScript;
- React Navigation;
- TanStack Query;
- Zustand либо Redux Toolkit;
- Expo Camera;
- Expo Image Picker;
- Expo Location;
- Expo Notifications.

Приложение должно поддерживать:

- Android;
- iOS.

---

## Web Admin Panel

Для сотрудников организаций:

**React + TypeScript**

или:

**Next.js**

Назначение:

- просмотр Lost / Found reports;
- управление location;
- подтверждение возврата;
- просмотр match;
- управление сотрудниками;
- статистика.

---

# 3. Backend

Основной backend:

**Node.js + TypeScript**

Рекомендуемый framework:

**NestJS**

Альтернатива:

**Express.js**

Backend отвечает за:

- API;
- бизнес-логику;
- matching;
- AI;
- permissions;
- notifications;
- ownership verification;
- работу с Supabase;
- audit logs.

Архитектура:

```text
Mobile App
      ↓
Node.js API
      ↓
Supabase
 ├── PostgreSQL
 ├── Auth
 ├── Storage
 └── Realtime

      ↓
Gemini API
      ↓
Matching Engine
      ↓
Notifications
```

---

# 4. Supabase

Supabase используется как основная cloud infrastructure.

Не нужно создавать отдельный PostgreSQL сервер.

Supabase уже предоставляет:

- PostgreSQL;
- Auth;
- Storage;
- Realtime;
- Row Level Security;
- API;
- backups.

То есть архитектура:

```text
Supabase
    ↓
PostgreSQL database
```

а не:

```text
PostgreSQL + отдельная база Supabase
```

---

# 5. Авторизация

Использовать:

**Supabase Auth**

Поддержать:

- email/password;
- email verification;
- password reset;
- Google login — optional;
- Apple Sign In — optional.

Не хранить пароль пользователя самостоятельно в таблице `users`.

Пароль хранится только через Supabase Auth.

---

# 6. Роли пользователей

Минимум 4 роли.

### User

Обычный пользователь.

Может:

- создавать Lost report;
- создавать Found report;
- видеть свои reports;
- видеть matches;
- получать notifications;
- писать messages;
- подтверждать ownership.

---

### Staff

Сотрудник организации.

Например:

- university security;
- mall information desk;
- airport Lost & Found.

Может:

- принимать найденные вещи;
- менять статус;
- указывать storage point;
- подтверждать возврат;
- просматривать reports своей организации.

---

### Organization Admin

Может:

- создавать locations;
- добавлять staff;
- видеть статистику;
- управлять reports;
- управлять QR codes.

---

### Platform Admin

Полный доступ LostNet.

---

# 7. Регистрация

Поля:

```text
Full Name
Email
Password
Confirm Password
```

Optional:

```text
Phone
Avatar
```

Validation:

- email обязателен;
- валидный email;
- пароль ≥ 8 символов;
- password confirmation;
- email должен быть уникальным.

---

# 8. Home Screen

Главный экран:

```text
LostNet

[ I Lost Something ]

[ I Found Something ]

Possible Matches

Nearby Locations

My Reports
```

Также bottom navigation:

```text
Home
Reports
Matches
Notifications
Profile
```

---

# 9. Lost Item Report

Пользователь нажимает:

**I Lost Something**

Форма:

```text
Category *
Item Name *
Brand
Color *
Description
Unique Features

Photo(s)

Location *
GPS coordinates

Date *
Approximate Time

Reward
```

Пример:

```text
Item:
Black Nike backpack

Location:
University Library

Date:
03 October

Time:
17:40

Unique Features:
Blue keychain
Small scratch near zipper
```

---

# 10. Found Item Report

Отдельный flow.

Поля:

```text
Category *
Item Name
Brand
Color *
Photo *

Found Location *
GPS

Date *
Time *

Unique Features

Storage Location
```

После отправки:

```text
Thank you!

Your report has been received.

LostNet will automatically compare
this item with active lost reports.
```

Пользователь не должен переходить в сценарий владельца.

---

# 11. Фото

Использовать:

**Supabase Storage**

Bucket:

```text
item-images
```

Структура:

```text
item-images/
    users/
        {user_id}/
            reports/
                {report_id}/
                    image_1.jpg
```

В PostgreSQL хранить только:

```text
storage_path
url
report_id
created_at
```

---

# 12. Image Upload

Требования:

- JPG;
- PNG;
- WebP;
- максимум 10 MB;
- до 5 фото на item;
- автоматическое сжатие;
- генерация thumbnail.

---

# 13. AI Item Analysis

Использовать:

**Gemini API**

После загрузки изображения AI должен определить:

```text
category
object_type
brand
color
visual features
logos
unique characteristics
```

Пример:

```json
{
  "category": "Backpack",
  "brand": "Nike",
  "color": "Black",
  "features": [
    "blue keychain",
    "white Nike logo",
    "scratch near zipper"
  ]
}
```

---

# 14. AI Description

AI также должен улучшать пользовательское описание.

Исходное:

```text
black bag blue thing
```

AI:

```text
Black Nike backpack with a blue keychain
attached to the front zipper and a small
scratch near the main compartment.
```

Пользователь должен иметь возможность изменить AI description.

---

# 15. Matching Engine

Это ключевая функция LostNet.

После создания Lost или Found report система запускает matching.

Формула:

```text
Match Score =
Visual/Text similarity × 40%
+
Location × 30%
+
Time × 20%
+
Unique characteristics × 10%
```

---

# 16. Visual / Text Match

Вес:

**40%**

Сравниваются:

```text
category
brand
color
description
photo
AI features
```

---

# 17. Location Match

Вес:

**30%**

Использовать:

**PostGIS**

Хранить:

```text
latitude
longitude
```

Пример запроса:

```text
Find Found Reports
within 500 meters
of Lost Report location
```

---

# 18. Time Match

Вес:

**20%**

Например:

```text
Lost:
17:40

Found:
18:05

Difference:
25 minutes
```

Чем меньше разница — тем выше score.

---

# 19. Unique Features

Вес:

**10%**

Например:

```text
Blue keychain
Scratch
Sticker
Serial number
Custom case
```

---

# 20. Match Score

Результат:

```text
94% MATCH
```

UI:

```text
Possible Match

Black Nike Backpack

Visual / Text       38 / 40
Location            28 / 30
Time                18 / 20
Unique Features     10 / 10

TOTAL
94 / 100
```

---

# 21. Match Threshold

Например:

### 90–100%

```text
Strong Match
```

Отправить push notification.

---

### 70–89%

```text
Possible Match
```

Показать в Matches.

---

### <70%

Не отправлять push.

---

# 22. Notification

Использовать:

```text
Expo Push Notifications
```

или:

```text
Firebase Cloud Messaging
```

Примеры:

```text
Possible match found!

We found a backpack that is 94%
similar to your lost item.
```

---

# 23. Ownership Verification

Перед раскрытием контактных данных:

пользователь должен подтвердить ownership.

Система задаёт скрытый вопрос.

Например:

```text
What was inside the front pocket?
```

Ответ владельца:

```text
Red notebook and USB drive
```

---

# 24. OTP Verification

Optional дополнительная защита.

```text
Email OTP
```

или:

```text
SMS OTP
```

---

# 25. Secure Chat

После подтверждения match:

открывается внутренний chat.

Не использовать WhatsApp / Telegram как основную систему.

Chat:

```text
Owner
↕
Finder / Staff
```

Поддержка:

- text;
- images;
- system messages.

Supabase Realtime можно использовать для realtime сообщений.

---

# 26. Status System

Report имеет statuses.

Lost:

```text
ACTIVE
MATCH_FOUND
VERIFYING
CLAIMED
RETURNED
CLOSED
```

Found:

```text
FOUND
STORED
MATCH_FOUND
CLAIMED
RETURNED
```

---

# 27. My Reports

Пользователь видит:

```text
My Lost Items

Black Nike Backpack
Active

AirPods
Possible Match

Wallet
Returned
```

---

# 28. Search

Пользователь может искать items.

Filters:

```text
Category
Location
Date
Color
Brand
Status
```

---

# 29. Location System

Таблица Locations.

Пример:

```text
AITU

Building:
C1

Floor:
2

Point:
Security Desk
```

---

# 30. QR Codes

Для каждой location создать QR.

Например:

```text
QR:
AITU Main Building
```

Scan:

```text
https://lostnet.app/location/aitu-main
```

После сканирования:

```text
Found something here?

[ Report Found Item ]
```

Location автоматически устанавливается.

---

# 31. Organizations

Таблица:

```text
organizations
```

Примеры:

```text
AITU
Mega Mall
Astana Airport
Hilton Astana
```

---

# 32. Database

Использовать Supabase PostgreSQL.

Главные таблицы:

```text
profiles
organizations
locations
reports
report_images
matches
messages
notifications
ownership_verifications
staff_members
audit_logs
```

---

# 33. profiles

```sql
profiles
--------------------
id UUID PK
auth_user_id UUID
full_name TEXT
email TEXT
phone TEXT
avatar_url TEXT
role TEXT
created_at TIMESTAMP
updated_at TIMESTAMP
```

---

# 34. reports

Главная таблица.

```sql
reports
----------------------------
id UUID PK

user_id UUID FK

organization_id UUID FK

location_id UUID FK

type
LOST | FOUND

category TEXT

item_name TEXT

brand TEXT

color TEXT

description TEXT

ai_description TEXT

unique_features JSONB

latitude DECIMAL
longitude DECIMAL

event_date DATE
event_time TIME

reward DECIMAL

storage_location TEXT

status TEXT

created_at TIMESTAMP
updated_at TIMESTAMP
```

---

# 35. report_images

```sql
report_images
--------------------
id UUID PK

report_id UUID FK

storage_path TEXT

image_url TEXT

is_primary BOOLEAN

created_at TIMESTAMP
```

---

# 36. locations

```sql
locations
--------------------

id UUID PK

organization_id UUID FK

name TEXT

building TEXT

floor TEXT

address TEXT

latitude DECIMAL
longitude DECIMAL

qr_code TEXT

active BOOLEAN
```

---

# 37. matches

```sql
matches
----------------------------

id UUID PK

lost_report_id UUID FK
found_report_id UUID FK

visual_score DECIMAL
location_score DECIMAL
time_score DECIMAL
feature_score DECIMAL

total_score DECIMAL

status TEXT

created_at TIMESTAMP
```

---

# 38. messages

```sql
messages
--------------------

id UUID PK

match_id UUID FK

sender_id UUID FK

message TEXT

image_url TEXT

created_at TIMESTAMP

read_at TIMESTAMP
```

---

# 39. notifications

```sql
notifications
--------------------

id UUID PK

user_id UUID FK

type TEXT

title TEXT

message TEXT

data JSONB

read BOOLEAN

created_at TIMESTAMP
```

---

# 40. Ownership Verification

```sql
ownership_verifications
--------------------

id UUID PK

match_id UUID FK

user_id UUID FK

question TEXT

answer_hash TEXT

status TEXT

attempts INTEGER

created_at TIMESTAMP
```

---

# 41. Security

Обязательно использовать:

## Row Level Security

Supabase RLS.

Например пользователь может читать:

```text
только свои reports
```

или публичные ограниченные данные found items.

---

Пользователь НЕ должен видеть:

```text
email другого пользователя
phone
hidden ownership details
private messages
```

до разрешения системы.

---

# 42. API

Пример REST API.

Auth:

```text
POST /auth/register
POST /auth/login
POST /auth/logout
POST /auth/reset-password
```

---

Reports:

```text
POST   /reports
GET    /reports/:id
PATCH  /reports/:id
DELETE /reports/:id

GET /reports/my
GET /reports/search
```

---

Images:

```text
POST /reports/:id/images
DELETE /reports/:id/images/:imageId
```

---

Matches:

```text
GET /matches
GET /matches/:id

POST /matches/:id/confirm
POST /matches/:id/reject
```

---

Verification:

```text
POST /matches/:id/verify
```

---

Messages:

```text
GET  /matches/:id/messages
POST /matches/:id/messages
```

---

# 43. Validation

Backend обязан проверять данные независимо от frontend.

Пример:

```text
item_name required
location required
type LOST/FOUND only
valid date
valid GPS coordinates
image size
image type
valid UUID
```

Использовать:

```text
Zod
```

или:

```text
class-validator
```

---

# 44. Error Handling

Frontend должен получать понятные ошибки.

Например:

```json
{
  "error": "VALIDATION_ERROR",
  "message": "Location is required"
}
```

Не показывать пользователю raw database errors.

---

# 45. Search

Поиск:

```text
GET /reports/search
```

Query:

```text
?category=backpack
&color=black
&radius=500
&lat=51.1
&lng=71.4
```

---

# 46. Admin Panel

Admin dashboard:

```text
Total Reports

Lost Reports
Found Reports

Matches

Returned Items

Average Recovery Time

Match Success Rate
```

---

# 47. Staff Panel

Staff видит:

```text
Items waiting at location

Possible owners

Verification requests

Returned items
```

---

# 48. Audit Log

Все критические действия записывать.

Например:

```text
staff changed status
owner verified
item returned
report deleted
staff viewed hidden data
```

Таблица:

```text
audit_logs
```

---

# 49. Privacy

Не показывать полный GPS found item публично.

Например пользователь видит:

```text
University Library
```

но не:

```text
51.090134
71.418474
```

---

# 50. Deployment

Frontend:

```text
Expo EAS
```

Mobile releases:

```text
Google Play
App Store
```

---

Backend:

```text
Railway
Render
Fly.io
AWS
```

или Supabase Edge Functions для части логики.

---

Database:

```text
Supabase PostgreSQL
```

---

Storage:

```text
Supabase Storage
```

---

# 51. Environment Variables

Backend:

```env
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=

SUPABASE_ANON_KEY=

GEMINI_API_KEY=

JWT_SECRET=

EXPO_PUSH_ACCESS_TOKEN=
```

Ни один secret key не должен находиться внутри frontend приложения.

Особенно:

```text
SUPABASE_SERVICE_ROLE_KEY
GEMINI_API_KEY
```

---

# 52. Логирование

Использовать:

```text
Pino
```

или:

```text
Winston
```

Production ошибки:

```text
Sentry
```

---

# 53. Monitoring

Отслеживать:

```text
API failures
AI failures
upload failures
notification failures
matching errors
```

---

# 54. Основной пользовательский сценарий

### Lost

```text
Register
↓
Login
↓
I Lost Something
↓
Fill Report
↓
Upload Photo
↓
Save to PostgreSQL
↓
Photo → Supabase Storage
↓
Gemini Analysis
↓
Matching Engine
↓
Possible Match 94%
↓
Push Notification
↓
Owner Verification
↓
Secure Chat
↓
Item Returned
↓
Status = RETURNED
```

---

# 55. Found Scenario

```text
User finds item
↓
Scan QR
↓
Found Item Form
↓
Upload Photo
↓
Submit
↓
Saved to PostgreSQL
↓
AI Analysis
↓
Compare with Lost Reports
↓
Strong Match Found
↓
Notify Owner
```

---

# 56. Non-functional Requirements

### Performance

API:

```text
< 500 ms
```

для обычных запросов.

AI может работать:

```text
2–10 seconds
```

---

### Availability

Target:

```text
99.5%+
```

---

### Scalability

Архитектура должна выдерживать минимум:

```text
10,000 users
100,000 reports
500,000 images
```

без изменения структуры приложения.

---

# 57. UI Requirements

Стиль:

- light;
- clean;
- mobile-first;
- green LostNet accent;
- минимум действий на экран;
- крупные CTA buttons.

Цвет:

```text
Primary:
#16A34A

Background:
#F7F8FA

Text:
#101828
```

---

# 58. MVP

Чтобы не строить сразу огромную систему, первую полноценную версию ограничить.

## MVP обязательно

- Registration/Login;
- Supabase Auth;
- Lost Report;
- Found Report;
- Image upload;
- PostgreSQL storage;
- My Reports;
- search;
- AI image analysis;
- matching engine;
- match score;
- push notification;
- ownership verification;
- status management;
- secure chat;
- staff panel.

---

## V2

После MVP:

- QR system;
- organization dashboards;
- PostGIS advanced search;
- Google login;
- Apple login;
- multiple photos;
- analytics;
- rewards;
- courier delivery;
- advanced anti-fraud.

---

# 59. Acceptance Criteria

Проект считается рабочим, если можно пройти реальный сценарий:

```text
Create Account
↓
Login
↓
Create Lost Report
↓
Upload Image
↓
Report сохраняется
↓
Reload App
↓
Report остаётся
↓
Create Found Report
↓
Matching запускается
↓
Match появляется
↓
Notification приходит
↓
User verifies ownership
↓
Chat opens
↓
Staff marks item Returned
```

И все данные реально хранятся в PostgreSQL.

---

# 60. Что разработчик должен передать

В конце разработки должны быть:

```text
/mobile
/backend
/admin
/database
/docs
```

В GitHub.

Также:

```text
README.md
.env.example
database migrations
API documentation
deployment instructions
```

И схема:

```text
Supabase project
PostgreSQL migrations
Storage buckets
RLS policies
```

---

## Рекомендуемая итоговая архитектура LostNet

```text
┌─────────────────────────────┐
│ React Native / Expo         │
│ Android + iOS               │
└──────────────┬──────────────┘
               │
               │ HTTPS API
               ▼
┌─────────────────────────────┐
│ Node.js / NestJS            │
│ Business Logic              │
│ Matching Engine             │
│ AI Integration              │
└───────┬────────┬────────────┘
        │        │
        │        └──────────────► Gemini API
        │
        ▼
┌─────────────────────────────┐
│ Supabase                    │
│                             │
│ PostgreSQL                  │
│ Auth                        │
│ Storage                     │
│ Realtime                    │
│ PostGIS                     │
└──────────────┬──────────────┘
               │
               ▼
       Push Notifications
```

Для **первой реально разрабатываемой версии** я бы зафиксировал стек именно так:

**React Native + Expo + TypeScript → NestJS → Supabase Auth/PostgreSQL/Storage/Realtime → Gemini API → Expo Push Notifications.**

Это уже нормальная production-like архитектура, которую впоследствии не придётся выбрасывать и переписывать с нуля.
