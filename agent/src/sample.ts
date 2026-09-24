// خزانة تجريبية لـ `npm run dev` والتقييم — مش بيانات حقيقية.
import type { ClosetItem } from "./closet.ts";

const today = Math.floor(Date.now() / 86_400_000);

export const SAMPLE_CLOSET: ClosetItem[] = [
  { id: "s1", name: "قميص أبيض أكسفورد", category: "shirts", colorName: "أبيض", material: "قطن", status: "IN_CLOSET", condition: "GOOD", wearCount: 14, lastWornDateEpochDay: today - 3 },
  { id: "s2", name: "قميص كتان أزرق فاتح", category: "shirts", colorName: "أزرق فاتح", material: "كتان", status: "IN_CLOSET", condition: "GOOD", wearCount: 2, lastWornDateEpochDay: today - 95 },
  { id: "s3", name: "تيشيرت أسود", category: "t-shirts", colorName: "أسود", material: "قطن", status: "IN_LAUNDRY", condition: "GOOD", wearCount: 30, lastWornDateEpochDay: today - 1 },
  { id: "p1", name: "بنطلون جينز غامق", category: "pants", colorName: "كحلي", material: "دنيم", status: "IN_CLOSET", condition: "GOOD", wearCount: 20, lastWornDateEpochDay: today - 2 },
  { id: "p2", name: "بنطلون تشينو بيج", category: "pants", colorName: "بيج", material: "قطن", status: "IN_CLOSET", condition: "GOOD", wearCount: 5, lastWornDateEpochDay: today - 40 },
  { id: "j1", name: "جاكيت جلد بني", category: "jackets", colorName: "بني", material: "جلد", status: "IN_CLOSET", condition: "WORN", wearCount: 8, lastWornDateEpochDay: today - 150, notes: "ثقيل، للشتا" },
  { id: "b1", name: "بليزر كحلي", category: "jackets", colorName: "كحلي", material: "صوف", status: "IN_CLOSET", condition: "GOOD", wearCount: 3, lastWornDateEpochDay: today - 60 },
  { id: "sh1", name: "حذاء رياضي أبيض", category: "shoes", colorName: "أبيض", status: "IN_CLOSET", condition: "GOOD", wearCount: 40, lastWornDateEpochDay: today - 1 },
  { id: "sh2", name: "حذاء جلد بني رسمي", category: "shoes", colorName: "بني", material: "جلد", status: "IN_CLOSET", condition: "GOOD", wearCount: 4, lastWornDateEpochDay: today - 60 },
];
