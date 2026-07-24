import { getSiteConfig } from "@/lib/modules/site/site-store";
import { themeToCssVars, DEFAULT_THEME } from "@/lib/modules/site/defaults";

/**
 * حقن متغيرات الثيم من إعدادات الموقع — سقوط آمن للهوية الحالية عند فشل القاعدة.
 */
export async function SiteThemeStyle() {
  let css = themeToCssVars(DEFAULT_THEME);
  try {
    const config = await getSiteConfig();
    css = themeToCssVars(config.theme);
  } catch {
    /* الهوية الافتراضية */
  }
  return (
    <style
      id="hakeem-site-theme"
      dangerouslySetInnerHTML={{ __html: css }}
    />
  );
}
