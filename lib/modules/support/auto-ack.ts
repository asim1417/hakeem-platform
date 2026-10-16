/**
 * رد تلقائي أول مرة في الخيط — حتى لا تبدو المحادثة ميتة بعد الإرسال.
 */
import { appendMessage } from "@/lib/modules/support/support-store";
import { buildSupportAutoAck } from "@/lib/modules/support/auto-ack-text";

export { buildSupportAutoAck } from "@/lib/modules/support/auto-ack-text";

/** يُدرج ردًا تلقائيًا بعد أول رسالة من العميل فقط. */
export async function maybeAppendFirstMessageAutoAck(opts: {
  threadId: string;
  userMessageCountBefore: number;
  userBody: string;
}): Promise<boolean> {
  if (opts.userMessageCountBefore > 0) return false;
  const message = await appendMessage({
    threadId: opts.threadId,
    senderRole: "admin",
    senderId: null,
    senderName: "دعم حكيم (تلقائي)",
    body: buildSupportAutoAck(opts.userBody),
  });
  return Boolean(message);
}
