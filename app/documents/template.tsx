import styles from "./transition.module.css";

// template يعيد التركيب عند كل تنقّل بين شاشات منصة الوثائق (البوابة/البحث السريع/محطة العمل)
// فيشغّل انتقال الانزلاق الأفقي RTL المنصوص في دليل الهوية البصرية.
export default function DocumentsTemplate({ children }: { children: React.ReactNode }) {
  return <div className={styles.screen}>{children}</div>;
}
