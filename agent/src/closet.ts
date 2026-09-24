// تحويل قطع الخزانة (كما يرفعها التطبيق لجدول records) لنص قصير يفهمه الموديل،
// واستخراج القطع اللي اقترحها الموديل من ردّه.

export interface ClosetItem {
  id: string;
  name?: string | null;
  category?: string | null;
  colorName?: string | null;
  material?: string | null;
  size?: string | null;
  brand?: string | null;
  status?: string | null;
  condition?: string | null;
  wearCount?: number | null;
  lastWornDateEpochDay?: number | null;
  notes?: string | null;
  isDeleted?: boolean | null;
}

// أكثر من هيك بيكبّر الطلب وبياكل الحصة المجانية بسرعة.
export const MAX_ITEMS = 200;
const MAX_NOTE = 80;

const clean = (value: unknown, max = 40): string =>
  typeof value === "string" ? value.replace(/[\r\n|[\]]+/g, " ").trim().slice(0, max) : "";

export function formatCloset(items: ClosetItem[], todayEpochDay: number): string {
  const live = items.filter((i) => !i.isDeleted && typeof i.id === "string");
  if (live.length === 0) return "(الخزانة فاضية)";
  // القطع الموجودة بالخزانة أول، وبعدين الأقل لبساً — هدول أهم شي للاقتراحات.
  live.sort((a, b) => {
    const inA = a.status === "IN_CLOSET" ? 0 : 1;
    const inB = b.status === "IN_CLOSET" ? 0 : 1;
    return inA - inB || (a.wearCount ?? 0) - (b.wearCount ?? 0);
  });
  const lines = live.slice(0, MAX_ITEMS).map((i) => {
    const worn = typeof i.lastWornDateEpochDay === "number"
      ? `آخر لبس قبل ${Math.max(0, todayEpochDay - i.lastWornDateEpochDay)} يوم`
      : "ما انلبست بعد";
    return [
      i.id,
      clean(i.name) || "بدون اسم",
      clean(i.category),
      clean(i.colorName),
      clean(i.material),
      clean(i.size, 12),
      clean(i.brand),
      clean(i.status, 20),
      clean(i.condition, 20),
      `لبست ${i.wearCount ?? 0} مرة`,
      worn,
      clean(i.notes, MAX_NOTE),
    ].join(" | ");
  });
  const more = live.length > MAX_ITEMS ? `\n(و${live.length - MAX_ITEMS} قطعة كمان ما انعرضت)` : "";
  return "id | الاسم | النوع | اللون | الخامة | المقاس | الماركة | الحالة | الجودة | مرات اللبس | آخر لبس | ملاحظات\n"
    + lines.join("\n") + more;
}

// الموديل بيكتب اسم القطعة وبعده [[id]]. منشيل العلامات من النص ومنرجّع الـ ids الصحيحة بس،
// عشان التطبيق يعرض صور القطع المقترحة.
export function extractItemIds(reply: string, knownIds: Set<string>): { text: string; itemIds: string[] } {
  const itemIds: string[] = [];
  const text = reply
    .replace(/\s*\[\[([^\]]{1,64})\]\]/g, (_, id: string) => {
      const trimmed = id.trim();
      if (knownIds.has(trimmed) && !itemIds.includes(trimmed)) itemIds.push(trimmed);
      return "";
    })
    .replace(/[ \t]{2,}/g, " ")
    .trim();
  return { text, itemIds };
}
