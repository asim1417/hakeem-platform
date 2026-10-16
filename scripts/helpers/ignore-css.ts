/**
 * الاختبارات تستورد مكوّنات عميل تستورد ملفات CSS (يعالجها Next وحده).
 * يُستورد أولًا في الاختبار فيتجاهل Node ملفات .css.
 */
require.extensions[".css"] = () => undefined;

export {};
