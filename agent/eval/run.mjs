// بيجرب كل الحالات بـ cases.json على المساعد وهو شغّال محلياً (npm run dev) بالخزانة التجريبية.
// الاستخدام: npm run eval            — كل الحالات
//           npm run eval -- عرس      — الحالات اللي اسمها فيه "عرس"
import { readFile } from "node:fs/promises";

const url = process.env.AGENT_URL ?? "http://localhost:8787";
const filter = process.argv[2];
const cases = JSON.parse(await readFile(new URL("./cases.json", import.meta.url), "utf8"))
  .filter((c) => !filter || c.name.includes(filter));

for (const c of cases) {
  const started = Date.now();
  const res = await fetch(`${url}/chat`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-sample-closet": "1" },
    body: JSON.stringify({ messages: c.messages }),
  });
  const body = await res.json().catch(() => ({}));
  console.log(`\n━━━ ${c.name} (${res.status}, ${Date.now() - started}ms)`);
  console.log(`> ${c.messages.at(-1).content}`);
  console.log(body.reply ?? JSON.stringify(body));
  if (body.itemIds?.length) console.log(`  قطع: ${body.itemIds.join(", ")}`);
}
