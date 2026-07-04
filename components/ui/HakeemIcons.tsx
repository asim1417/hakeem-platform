// نظام الأيقونات الموحّد — HakeemIcons (وفق دليل الهوية البصرية لمنصة الوثائق)
// أيقونات خطية متجهة بدل الإيموجي: لون من السياق (currentColor)، اسم وصول اختياري،
// وتُعامل كزخرفة (aria-hidden) عند غياب العنوان. الأيقونات الاتجاهية تنعكس في RTL تلقائياً
// باستخدام مسارات محايدة الاتجاه قدر الإمكان.

interface IconProps {
  size?: number;
  /** اسم وصول للقارئ الصوتي — بدونه تكون الأيقونة زخرفية */
  title?: string;
  className?: string;
}

function Svg({
  size = 20,
  title,
  className,
  children
}: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      className={className}
    >
      {title ? <title>{title}</title> : null}
      {children}
    </svg>
  );
}

/** الاستعارة البصرية للشعار: وثيقة تنبثق منها كفّتا ميزان */
export function DocScaleIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M6.5 3h8l3.5 3.5V21h-11.5z" />
      <path d="M14.5 3v3.5H18" />
      <path d="M12 8.5v3" />
      <path d="M8.5 11.5h7" />
      <path d="M12 11.5v6.5" />
      <path d="m8.5 11.5-1.6 3.2h3.2z" />
      <path d="m15.5 11.5-1.6 3.2h3.2z" />
    </Svg>
  );
}

export function UploadIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M12 16V5" />
      <path d="M7.5 9.5 12 5l4.5 4.5" />
      <path d="M4 16v3a1.5 1.5 0 0 0 1.5 1.5h13A1.5 1.5 0 0 0 20 19v-3" />
    </Svg>
  );
}

export function ScanIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M4 8V5.5A1.5 1.5 0 0 1 5.5 4H8" />
      <path d="M16 4h2.5A1.5 1.5 0 0 1 20 5.5V8" />
      <path d="M20 16v2.5a1.5 1.5 0 0 1-1.5 1.5H16" />
      <path d="M8 20H5.5A1.5 1.5 0 0 1 4 18.5V16" />
      <path d="M4 12h16" />
    </Svg>
  );
}

export function SearchIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m20 20-3.8-3.8" />
    </Svg>
  );
}

export function DriveIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="m9.3 4.5 5.4 0L21 15.8l-2.7 4.7H5.7L3 15.8z" />
      <path d="M9.3 4.5 3 15.8" />
      <path d="M14.7 4.5 9.6 13h11.4" />
    </Svg>
  );
}

export function TagIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="m12.6 3.6 7.8 7.8a1.5 1.5 0 0 1 0 2.1l-6.9 6.9a1.5 1.5 0 0 1-2.1 0l-7.8-7.8V4.5a.9.9 0 0 1 .9-.9z" />
      <circle cx="8.2" cy="8.2" r="1.4" />
    </Svg>
  );
}

export function EyeIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M2.5 12S6 5.8 12 5.8 21.5 12 21.5 12 18 18.2 12 18.2 2.5 12 2.5 12z" />
      <circle cx="12" cy="12" r="2.8" />
    </Svg>
  );
}

export function TableIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <rect x="3.5" y="5" width="17" height="14" rx="1.2" />
      <path d="M3.5 10h17" />
      <path d="M9.5 10v9" />
      <path d="M15.5 10v9" />
    </Svg>
  );
}

export function AlertIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M12 4 2.8 19.5h18.4z" />
      <path d="M12 10v4.5" />
      <path d="M12 17.3v.2" />
    </Svg>
  );
}

export function QuoteIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M9.5 7.5C7 8.5 5.5 10.4 5.5 13v3.5H10V12H7.6c.2-1.6 1-2.7 2.4-3.4z" />
      <path d="M18.5 7.5c-2.5 1-4 2.9-4 5.5v3.5H19V12h-2.4c.2-1.6 1-2.7 2.4-3.4z" />
    </Svg>
  );
}

export function SaveIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M5 4h11l3 3v13H5z" />
      <path d="M8 4v5h7V4" />
      <rect x="8" y="13" width="8" height="6" />
    </Svg>
  );
}

export function ExportIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M12 3v10" />
      <path d="M8 6.5 12 3l4 3.5" />
      <path d="M6 11H5a1.5 1.5 0 0 0-1.5 1.5v6A1.5 1.5 0 0 0 5 20h14a1.5 1.5 0 0 0 1.5-1.5v-6A1.5 1.5 0 0 0 19 11h-1" />
    </Svg>
  );
}

export function ShieldIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M12 3 5 5.8v5.4c0 4.4 3 7.7 7 9.8 4-2.1 7-5.4 7-9.8V5.8z" />
      <path d="m9 11.8 2.1 2.1L15.2 9.7" />
    </Svg>
  );
}

export function FolderIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M3.5 6.5A1.5 1.5 0 0 1 5 5h4.5l2 2.5H19a1.5 1.5 0 0 1 1.5 1.5v9A1.5 1.5 0 0 1 19 19.5H5A1.5 1.5 0 0 1 3.5 18z" />
    </Svg>
  );
}

export function CheckSealIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M12 2.8 14 4.6l2.7-.3 1 2.5 2.5 1-.3 2.7 1.8 2-1.8 2 .3 2.7-2.5 1-1 2.5-2.7-.3-2 1.8-2-1.8-2.7.3-1-2.5-2.5-1 .3-2.7-1.8-2 1.8-2-.3-2.7 2.5-1 1-2.5 2.7.3z" />
      <path d="m8.8 12.2 2.1 2.1 4.3-4.4" />
    </Svg>
  );
}

export function PaperclipIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="m20 11.5-7.8 7.8a5 5 0 0 1-7-7l8.5-8.5a3.3 3.3 0 0 1 4.7 4.7L10 17a1.7 1.7 0 0 1-2.4-2.4l7.4-7.4" />
    </Svg>
  );
}

export function LockIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <rect x="5.5" y="10.5" width="13" height="9.5" rx="1.5" />
      <path d="M8.5 10.5V7.8a3.5 3.5 0 0 1 7 0v2.7" />
      <path d="M12 14.2v2.3" />
    </Svg>
  );
}

export function NoteIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M16.8 3.7a2 2 0 0 1 2.9 2.9L8.5 17.8 4.5 19l1.2-4z" />
      <path d="m14.8 5.7 2.9 2.9" />
    </Svg>
  );
}

export function TrashIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M4.5 6.5h15" />
      <path d="M9 6.5V4.8A1.3 1.3 0 0 1 10.3 3.5h3.4A1.3 1.3 0 0 1 15 4.8v1.7" />
      <path d="M6.5 6.5 7.4 20h9.2l.9-13.5" />
      <path d="M10 10v6.5" />
      <path d="M14 10v6.5" />
    </Svg>
  );
}

export function ClipboardIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <rect x="5.5" y="5" width="13" height="16" rx="1.5" />
      <path d="M9 5a3 3 0 0 1 6 0" />
      <path d="M8.5 10.5h7" />
      <path d="M8.5 14h7" />
      <path d="M8.5 17.5h4.5" />
    </Svg>
  );
}

export function FlagIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M6 21V4" />
      <path d="M6 4.8c3.5-1.8 6.5 1.8 12 0v8.5c-5.5 1.8-8.5-1.8-12 0" />
    </Svg>
  );
}

export function SparkIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M12 3.5 13.8 9l5.7 1.8-5.7 1.8L12 18.2l-1.8-5.6-5.7-1.8L10.2 9z" />
      <path d="M19 16.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z" transform="scale(0.8) translate(3 1)" />
    </Svg>
  );
}
