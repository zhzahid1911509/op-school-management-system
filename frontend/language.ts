export type Language = "bn" | "en";
export const languageKey = "admission.language";
export function savedLanguage(): Language {
  try { return localStorage.getItem(languageKey) === "en" ? "en" : "bn"; }
  catch { return "bn"; }
}

const bangla = {
  "School Admission System": "স্কুল ভর্তি ব্যবস্থা",
  "Workspace": "কর্মক্ষেত্র", "Admissions": "ভর্তি", "School admin": "স্কুল প্রশাসন",
  "School administration": "স্কুল প্রশাসন", "Student admissions": "শিক্ষার্থী ভর্তি",
  "Student birth registration number": "শিক্ষার্থীর জন্ম নিবন্ধন নম্বর",
  "17-digit number": "১৭ সংখ্যার নম্বর", "digits": "সংখ্যা", "Complete": "সম্পূর্ণ", "remaining": "বাকি",
  "Browser storage is unavailable. Re-enter the number on your next visit.": "ব্রাউজারে নম্বর সংরক্ষণ করা যায়নি। পরের বার নম্বরটি আবার লিখুন।",
  "Displayed counts may be outdated.": "দেখানো আসনসংখ্যা বদলে গিয়ে থাকতে পারে।", "Retry": "আবার চেষ্টা করুন",
  "Create a class": "নতুন শ্রেণি", "Class and shift": "শ্রেণি ও শিফট", "Class 6 – Morning Shift": "ষষ্ঠ শ্রেণি – প্রভাতী শিফট",
  "Total seats": "মোট আসন", "Create class": "শ্রেণি তৈরি করুন", "Class availability": "শ্রেণিভিত্তিক আসনসংখ্যা",
  "Enter the full 17-digit number above to apply.": "আবেদন করতে উপরে জন্ম নিবন্ধনের ১৭টি সংখ্যা লিখুন।",
  "Class list unavailable.": "শ্রেণির তালিকা পাওয়া যায়নি।", "Loading classes…": "শ্রেণির তালিকা লোড হচ্ছে…",
  "No classes have been created yet.": "এখনও কোনো শ্রেণি তৈরি করা হয়নি।", "Class ID": "শ্রেণির আইডি",
  "Available": "খালি", "Held": "সাময়িক সংরক্ষিত", "Confirmed": "ভর্তি নিশ্চিত", "Total": "মোট",
  "Already applied": "আবেদন করা হয়েছে", "Apply": "আবেদন করুন", "Class full": "আসন খালি নেই",
  "Check availability": "খালি আসন দেখুন", "seats available.": "টি আসন খালি আছে।",
  "My applications": "আমার আবেদন", "History unavailable.": "আবেদনের তালিকা পাওয়া যায়নি।",
  "Loading history…": "আবেদনের তালিকা লোড হচ্ছে…", "No applications for this student.": "এই শিক্ষার্থীর কোনো আবেদন নেই।",
  "Application ID": "আবেদনের আইডি", "Time to pay": "ফি দেওয়ার বাকি সময়",
  "Pay admission fee": "ভর্তি ফি দিন", "Cancel": "বাতিল করুন", "Check application status": "আবেদনের অবস্থা দেখুন",
  "Hold deadline": "আসন সংরক্ষণের শেষ সময়", "HELD": "সাময়িক সংরক্ষিত", "CONFIRMED": "ভর্তি নিশ্চিত",
  "EXPIRED": "মেয়াদ শেষ", "CANCELLED": "বাতিল",
  "Class created.": "শ্রেণি তৈরি হয়েছে।", "Seat held. Your payment deadline is shown below.": "আসন সংরক্ষিত হয়েছে। নিচে ফি দেওয়ার বাকি সময় দেখুন।",
  "Fee recorded. Admission confirmed.": "ফি জমা হয়েছে। ভর্তি নিশ্চিত হয়েছে।", "Application cancelled.": "আবেদন বাতিল হয়েছে।",
  "Enter the class and shift name and a positive whole-number capacity.": "শ্রেণি ও শিফটের নাম লিখুন এবং মোট আসনসংখ্যা ধনাত্মক পূর্ণসংখ্যায় দিন।",
  "Cannot reach the admission service. Check your connection and try again.": "ভর্তি সেবার সঙ্গে সংযোগ করা যায়নি। সংযোগ পরীক্ষা করে আবার চেষ্টা করুন।",
  "The request failed. Refresh and try again.": "অনুরোধটি সম্পন্ন হয়নি। পৃষ্ঠাটি রিফ্রেশ করে আবার চেষ্টা করুন।",
  "Please try again.": "আবার চেষ্টা করুন।", "Class is full": "এই শ্রেণিতে কোনো আসন খালি নেই।",
  "All five-digit IDs are in use": "পাঁচ সংখ্যার সব আইডি ব্যবহৃত হয়েছে।",
  "Class not found": "শ্রেণিটি পাওয়া যায়নি।", "Application not found": "আবেদনটি পাওয়া যায়নি।",
  "Student already has an admission for this class": "এই শ্রেণিতে শিক্ষার্থীর সক্রিয় আবেদন বা নিশ্চিত ভর্তি রয়েছে।",
  "Application belongs to another student": "এই আবেদনটি অন্য শিক্ষার্থীর।",
  "Application is no longer active": "এই আবেদনটি আর সক্রিয় নেই।",
  "Invalid target status": "আবেদনের অবস্থা এভাবে পরিবর্তন করা যাবে না।",
  "X-Student-Id must contain exactly 17 digits.": "জন্ম নিবন্ধন নম্বরে ঠিক ১৭টি সংখ্যা থাকতে হবে।",
  "The admission database is temporarily unavailable.": "ভর্তির তথ্যভান্ডার সাময়িকভাবে পাওয়া যাচ্ছে না।",
  "Check the request URL, content type and JSON fields.": "অনুরোধের তথ্য সঠিক নয়। তথ্য যাচাই করে আবার চেষ্টা করুন।",
  "Provide a class name and a positive seat count.": "শ্রেণির নাম এবং শূন্যের চেয়ে বেশি আসনসংখ্যা দিন।"
} as const;
export type Label = keyof typeof bangla;
export function label(lang: Language, key: Label) { return lang === "bn" ? bangla[key] : key; }
export function errorText(lang: Language, text: string) {
  if (lang === "en") return text;
  const key = text in bangla ? text : text.replace(/\.$/, "");
  return Object.hasOwn(bangla, key) ? bangla[key as Label] : bangla["The request failed. Refresh and try again."];
}
export function digits(lang: Language, value: number | string) {
  return lang === "bn" ? String(value).replace(/[0-9]/g, n => "০১২৩৪৫৬৭৮৯"[Number(n)]) : String(value);
}
export function asciiDigits(value: string) {
  return value.replace(/[০-৯]/g, n => String(n.charCodeAt(0) - 0x09e6));
}
