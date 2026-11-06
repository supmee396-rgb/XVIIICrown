# Guild Queue — Local Docker

ระบบลงคิวดันเจี้ยน Next.js + SQLite สำหรับเปิดใช้ในเครื่องผ่าน Docker

- `/queue`: หน้าลงคิวแยก กรอกชื่อตัวละคร เลือกอาชีพจาก dropdown เลือก Lv.1–5 และติดตามคิว (ชื่อเดิมใช้ข้อมูลสมาชิกเดิมอัตโนมัติ)
- `/admin`: ภาพรวม จัดตี้ A/B/C บันทึกผล ปรับความจุ เปิด–ปิดรอบ และดูประวัติ
- `/`: ไปหน้าลงคิวอัตโนมัติ
- ทั้งสองหน้าอ่านฐานข้อมูลเดียวกันและอัปเดตทุก 3 วินาที

## เปิดด้วย Docker

เปิด Docker Desktop แล้วรันในโฟลเดอร์โปรเจกต์:

```bash
docker compose up -d --build
```

เปิด http://localhost:3000/queue และ http://localhost:3000/admin

ถ้าพอร์ต 3000 ถูกใช้งานอยู่ สามารถใช้ 3100 แทน:

```bash
PORT=3100 docker compose up -d --build
```

จากนั้นเปิด http://localhost:3100/queue และ http://localhost:3100/admin
หากต้องการจำพอร์ต ให้คัดลอก `.env.example` เป็น `.env` แล้วตั้ง `PORT=3100`

```bash
docker compose ps
docker compose logs -f web
docker compose stop
docker compose start
```

ถ้าพบ `permission denied` ที่ `~/.docker/buildx/current` ให้ใช้โฟลเดอร์ buildx ของโปรเจกต์แทน โดยไม่แก้สิทธิ์ไฟล์เดิม:

```bash
BUILDX_CONFIG="$PWD/.docker-buildx" PORT=3100 docker compose up -d --build
```

## การเก็บข้อมูล

เริ่มต้นด้วยรอบที่ 1 และข้อมูลสมาชิก/คิวว่าง ไม่มีข้อมูลสาธิตปนอยู่ ข้อมูลเดิมใน localStorage ของต้นแบบไม่ได้ถูกนำเข้าฐานข้อมูลอัตโนมัติ

SQLite อยู่ที่ `/app/data/guild-queue.sqlite` ภายใน container โดยใช้ named volume `queue-data` (Compose เติมชื่อโปรเจกต์ด้านหน้า) คิว สมาชิก รอบ ประวัติการดัน ความจุ และกิจกรรมคงอยู่เมื่อ restart, rebuild หรือ `docker compose down` แล้วเปิดใหม่

**อย่าใช้ `docker compose down -v` หากต้องการเก็บข้อมูล** เพราะ `-v` ลบ volume ฐานข้อมูลด้วย

ระบบเก็บสถานะเป็น JSON ใน SQLite แถวเดียว เหมาะสำหรับระบบกิลขนาดเล็ก ทุกคำสั่งอ่านสถานะล่าสุดและตรวจเงื่อนไขภายใน `BEGIN IMMEDIATE` transaction ก่อนบันทึก จึงไม่เขียนทับข้อมูลจากอีกแท็บและไม่รับคิวซ้ำ เมื่อรายการใหญ่ขึ้นมากควรแยกเป็นตารางและเพิ่ม pagination

การยกเลิกคิวยังนับว่าลงระดับนั้นในรอบนี้แล้ว แอดมินสามารถเปลี่ยนกลับเป็นรอคิวได้โดยใช้ตำแหน่งเดิม การเปิดรอบใหม่เก็บคิวและประวัติของรอบเก่าไว้ และเปิดให้ลงระดับเดิมได้อีกครั้ง

### สำรองข้อมูล

หยุดเว็บระหว่างคัดลอกและสำรองทั้งโฟลเดอร์ เพื่อรวมไฟล์ SQLite WAL หากยังมีอยู่:

```bash
docker compose stop web
mkdir -p backups
docker compose cp web:/app/data ./backups/queue-data
docker compose start web
```

ใช้ชื่อโฟลเดอร์สำรองใหม่ในแต่ละครั้ง หากต้องการกู้คืน ให้ใช้สำเนาทั้งชุดจากการสำรองครั้งเดียวกันแทนไฟล์ใน volume ขณะเว็บหยุดทำงาน

## ขอบเขตการใช้งาน

Compose เปิดพอร์ตเฉพาะ `127.0.0.1` สำหรับเครื่องนี้ ยังไม่มีระบบล็อกอินหรือสิทธิ์แอดมิน ผู้ที่เปิดเว็บได้สามารถเลือกสมาชิกและใช้หน้าจัดการได้ การแยก `/queue` กับ `/admin` เป็นการแยกหน้าการใช้งาน หากจะเปิดให้คนอื่นเข้าผ่าน LAN หรืออินเทอร์เน็ต ต้องเพิ่มการยืนยันตัวตนและตรวจสิทธิ์ที่ API ก่อน

## พัฒนาโดยไม่ใช้ Docker

ใช้ Node.js **22.13 ขึ้นไป** (แนะนำ Node 22 LTS; ใช้ `node:sqlite` ในตัว)

```bash
nvm use 22
npm ci
npm run dev
```

ฐานข้อมูล local จะอยู่ที่ `data/guild-queue.sqlite` แยกจาก Docker volume ตั้งตำแหน่งเองได้ด้วย `DATABASE_PATH` ไฟล์ฐานข้อมูลถูกละเว้นจาก Git และ Docker build context

## ตรวจสอบ

```bash
npm run typecheck
npm run build
npm test
```

Integration tests เปิดเซิร์ฟเวอร์บนพอร์ตว่าง ใช้ฐานข้อมูลชั่วคราวและลบทิ้งหลังทดสอบ ไม่แตะข้อมูลใช้งานจริง ครอบคลุมการลงหลายระดับ คิวซ้ำ การส่งพร้อมกัน การจัดตี้ซ้ำ การ retry ดัน การปิด/เปิดรอบ การส่งข้อมูลของรอบเก่า และการคงข้อมูลหลังรีสตาร์ตเซิร์ฟเวอร์ ต้อง build ก่อนรัน tests

## ไฟล์หลัก

- `src/components/QueueRegistration.tsx`: หน้าลงคิว
- `src/components/GuildApp.tsx`: หน้าจัดการ
- `src/lib/useGuildData.ts`: โหลดข้อมูล ส่งคำสั่ง และติดตามการเปลี่ยนแปลง
- `src/lib/server/store.ts`: SQLite และ transaction
- `src/lib/server/actions.ts`: ตรวจข้อมูลและคำสั่งจัดการคิว
- `src/app/api/state/route.ts`: API อ่าน/แก้ข้อมูล
- `Dockerfile`, `compose.yaml`: production container และ persistent volume
