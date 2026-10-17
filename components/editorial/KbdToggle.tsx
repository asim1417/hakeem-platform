"use client";

/** مفتاح الاختصارات (حاسب بمؤشر دقيق من 1024 وحده، عبر .dk-kbd). قائمة المفاتيح معزولة باتجاهها حتى لا ينعكس ترتيبها. */
export function KbdToggle({ on, onChange }: { on: boolean; onChange: (on: boolean) => void }) {
  return (
    <label className="dk-check dk-kbd">
      <input type="checkbox" checked={on} onChange={(e) => onChange(e.target.checked)} />
      <span className="dk-meta">
        اختصارات لوحة المفاتيح {on ? "مفعّلة" : "معطّلة"}{" "}
        <bdi dir="ltr" lang="en">
          (<kbd>j</kbd>/<kbd>k</kbd>, <kbd>a</kbd>, <kbd>r</kbd>, <kbd>e</kbd>, <kbd>x</kbd>)
        </bdi>
      </span>
    </label>
  );
}
