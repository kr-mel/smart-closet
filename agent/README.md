# مساعد الخزانة — smart-closet-agent

Worker على Cloudflare بيحكي مع المستخدم جوّا التطبيق: بيقترح أطقم من خزانته، بينبّه على القطع المنسية، وبيجاوب عن التطبيق.

- **مجاني:** بيشتغل على Workers AI بالخطة المجانية (10,000 neuron باليوم). على الخطة المجانية ما في فاتورة أبداً — إذا خلصت الحصة، الطلبات بتفشل لحد 00:00 UTC وبس.
- **مش على جهازك:** كله على Cloudflare بنفس الحساب اللي فيه `smart-closet-api`.
- **ما بيلمس الـ API الحالي:** Worker منفصل. بيقرأ من نفس قاعدة `smart-closet` (الجلسات والقطع) وبيكتب بس بجدول `agent_usage`.

## التكلفة التقريبية
الموديل `@cf/google/gemma-4-26b-a4b-it`: رسالة عادية (خزانة ~50 قطعة + رد) ≈ 25–40 neuron، يعني **~250–400 رسالة باليوم مجاناً** لكل المستخدمين مع بعض.
الحد لكل مستخدم `DAILY_LIMIT` (20 رسالة) بـ `wrangler.jsonc` — بيمنع مستخدم واحد ياكل الحصة كلها.

## التشغيل لأول مرة
```bash
cd agent
npm install
npx wrangler login          # مرة وحدة، بحساب Smart Closet
npm run db:migrate          # بيعمل جدول agent_usage
npm run deploy              # بيطلعلك رابط https://smart-closet-agent.<...>.workers.dev
```

## "التدريب" — كيف تحسّن المساعد
ما في تدريب موديل (هاد بكلّف وما بتحتاجه). التحسين بيصير بالتعليمات:

1. عدّل `src/prompt.ts` — الشخصية، القواعد، ومعلومات التطبيق. كل ما تضيف ميزة للتطبيق، ضيفها هون.
2. انسخ `.dev.vars.example` لـ `.dev.vars` وشغّل `npm run dev` (بيستخدم الموديل الحقيقي مع خزانة تجريبية من `src/sample.ts`).
3. بنافذة تانية: `npm run eval` — بيجرّب كل الأسئلة بـ `eval/cases.json` وبيطبع الردود. `npm run eval -- عرس` لسؤال واحد.
4. ضيف لـ `eval/cases.json` أي سؤال جاوب عليه المساعد غلط، وعدّل البرومبت لحد ما يصير صح.

لتجربة موديل تاني: غيّر `MODEL` بـ `wrangler.jsonc` (لازم يكون متاح على الخطة المجانية).

## الربط مع التطبيق
المستخدم لازم يكون مسجّل دخول. التطبيق بيبعت نفس التوكن اللي بياخده من `smart-closet-api` بـ `/auth/google`:

```http
POST https://smart-closet-agent.<...>.workers.dev/chat
Authorization: Bearer <session token>
Content-Type: application/json

{ "messages": [
  { "role": "user", "content": "بدي طقم للدوام بكرا" }
] }
```

الرد:
```json
{ "reply": "جرّب القميص الأبيض مع التشينو البيج…", "itemIds": ["s1", "p2"], "remaining": 17 }
```

- `messages`: المحادثة كلها (آخر 12 رسالة بتنبعت)، آخر وحدة لازم من `user`. التطبيق هو اللي بيحفظ المحادثة — السيرفر ما بيحفظ شي.
- `itemIds`: القطع اللي ذكرها المساعد — اعرض صورها تحت الرد.
- `remaining`: كم رسالة ضايلة اليوم.

الأخطاء (`{ "error": "...", "message": "..." }`):
| الكود | المعنى |
|---|---|
| 401 `missing_token` / `invalid_session` | لازم يسجّل دخول |
| 429 `rate_limited` | أكتر من 10 رسائل بالدقيقة |
| 429 `agent_quota` | خلص الحد اليومي |
| 503 `agent_unavailable` | الموديل مش متاح (غالباً خلصت الحصة المجانية لليوم) — الرسالة ما بتنحسب |

## قبل النشر
- `smart-closet-api` → `deleteAccount` لازم يمسح كمان `DELETE FROM agent_usage WHERE user_id = ?1`، لأن سياسة الخصوصية بتقول إنه كل شي بينمسح.
- سياسة الخصوصية (`privacy.html`) انضاف لها قسم «مساعد الخزانة».

## التطوير
```bash
npm test          # اختبارات تنسيق الخزانة واستخراج القطع
npm run typecheck
```
