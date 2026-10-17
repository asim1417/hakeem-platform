import { DeskHeader, DeskNav, deskNavAccess } from "@/components/editorial/DeskNav";
import { DeskSwitch } from "@/components/editorial/DeskSwitch";
import { SettingsEditor } from "@/components/editorial/SettingsEditor";
import { DeskRoot, isMissingRelation, LoadFailed, Message, NotMigrated, PageDenied, ReadOnlyBanner } from "@/components/editorial/ui";
import { canManageSettings } from "@/lib/modules/editorial/access";
import { pgErrorCode } from "@/lib/modules/editorial/db";
import { deskPageWriteContext, editorialDb, requireEditorialPage } from "@/lib/modules/editorial/guard";
import { accountMfaStatus } from "@/lib/modules/editorial/mfa";
import { loadEditorialConfig } from "@/lib/modules/editorial/policy";
import { readEditorialSettings, type SettingsView } from "@/lib/modules/editorial/settings";
import { isEditorialError } from "@/lib/modules/editorial/types";

export const dynamic = "force-dynamic";

export default async function EditorialSettingsPage() {
  const actor = await requireEditorialPage("view");
  const allowed = canManageSettings(actor.access);
  const { state: writeState, banner } = await deskPageWriteContext(actor);
  // حفظ التكليفات والسياسات مسموح والكتابة مقفلة، إلا بمفتاح الطوارئ.
  const settingsWritable = writeState.env !== "kill";
  const ownerMfa = allowed ? await accountMfaStatus(actor.id) : { enabled: false, linked: false };
  let view: SettingsView | null = null;
  let state: "ok" | "missing" | "invalid" | "error" = "ok";
  let invalidMessage = "";
  if (allowed) {
    try {
      const db = editorialDb();
      const loaded = await loadEditorialConfig(db);
      if (!loaded.installed) state = "missing";
      else view = await readEditorialSettings(db, actor);
    } catch (error) {
      if (isEditorialError(error) && error.code === "INVALID_STATE") {
        state = "invalid";
        invalidMessage = error.message;
      } else state = isMissingRelation(pgErrorCode(error)) ? "missing" : "error";
    }
  }

  return (
    <DeskRoot>
      <DeskHeader title="إعدادات المكتب" lead="مفتاح الكتابة، وتكليفات الفريق، وسياسات الاعتماد. يحررها المالك وحده، وكل حفظ نسخة جديدة بسبب مكتوب." />
      <DeskNav current="/admin/legal/settings" access={deskNavAccess(actor.access)} />
      {!allowed ? (
        <PageDenied title="إعدادات المكتب للمالك وحده." body="تُعرض التكليفات والسياسات وتُحرَّر من حساب المالك." />
      ) : (
        <>
          <ReadOnlyBanner {...banner} isOwner={false} />
          {view ? (
            <DeskSwitch
              version={view.version}
              writeEnabled={writeState.controls.writeEnabled}
              requireMfa={writeState.controls.requireMfa}
              env={writeState.env}
              ownerMfa={ownerMfa}
            />
          ) : null}
          <div className="mt-4">
            {state === "missing" ? (
              <NotMigrated what="جدول إعدادات المكتب غير موجود" />
            ) : state === "invalid" ? (
              <Message tone="error" role="alert" title="نسخة الإعدادات المخزّنة غير صالحة.">
                {invalidMessage}
              </Message>
            ) : state === "error" || !view ? (
              <LoadFailed what="تحميل الإعدادات" retryHref="/admin/legal/settings" />
            ) : null}
          </div>
          {view ? <SettingsEditor initial={JSON.parse(JSON.stringify(view))} writeEnabled={settingsWritable} /> : null}
        </>
      )}
    </DeskRoot>
  );
}
