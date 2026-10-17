"use client";
import { useState } from "react";
import {
  DeskConfig,
  PERMISSIONS,
  PERMISSION_LABELS,
  targetSchema,
} from "@/lib/modules/editorial/contracts";

export const TARGET_LABELS = {
  work: "الوثائق التنظيمية",
  unit: "المواد والبنود",
  ruling: "الأحكام",
  principle: "المبادئ",
  amendment: "التعديلات",
  relation: "العلاقات",
};
export function DeskSettings({
  initial,
  revision,
  users,
  disabled,
  save,
}: {
  initial: DeskConfig;
  revision: number;
  users: { id: string; name: string }[];
  disabled: boolean;
  save: (value: object) => Promise<void>;
}) {
  const [config, setConfig] = useState(initial);
  const [reason, setReason] = useState("");
  const edit = (fn: (copy: DeskConfig) => void) =>
    setConfig((prev) => {
      const copy = structuredClone(prev);
      fn(copy);
      return copy;
    });
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void save({ action: "settings", config, revision, reason });
      }}
      className="desk-stack"
    >
      <section className="desk-card">
        <h2>الأدوار والصلاحيات</h2>
        <p>
          أنشئ أدوار فريقك ووزع المهام. تطبيق الصلاحيات يتم على كل طلب في
          الخادم.
        </p>
        {config.roles.map((role, index) => (
          <fieldset key={role.id} className="desk-role">
            <legend>{role.name}</legend>
            <div className="desk-row">
              <label>
                اسم الدور
                <input
                  value={role.name}
                  onChange={(e) =>
                    edit((c) => {
                      c.roles[index].name = e.target.value;
                    })
                  }
                />
              </label>
              <label className="desk-check">
                <input
                  type="checkbox"
                  checked={role.enabled}
                  onChange={(e) =>
                    edit((c) => {
                      c.roles[index].enabled = e.target.checked;
                    })
                  }
                />
                الدور مفعل
              </label>
            </div>
            <div className="desk-grid">
              {PERMISSIONS.map((permission) => (
                <label className="desk-check" key={permission}>
                  <input
                    type="checkbox"
                    checked={role.permissions.includes(permission)}
                    onChange={(e) =>
                      edit((c) => {
                        c.roles[index].permissions = e.target.checked
                          ? [...role.permissions, permission]
                          : role.permissions.filter((p) => p !== permission);
                      })
                    }
                  />
                  {PERMISSION_LABELS[permission]}
                </label>
              ))}
            </div>
          </fieldset>
        ))}
        <button
          type="button"
          className="desk-secondary"
          onClick={() =>
            edit((c) => {
              c.roles.push({
                id: crypto.randomUUID(),
                name: "دور جديد",
                permissions: [],
                enabled: true,
              });
            })
          }
        >
          إضافة دور
        </button>
      </section>
      <section className="desk-card">
        <h2>أعضاء الفريق ونطاق العمل</h2>
        <p>
          يمكن منح المستخدم أكثر من دور. ترك المجالات فارغة يسمح بجميع المجالات
          ضمن الأنواع المحددة. حساب الوكيل يقتصر على الاقتراح.
        </p>
        {config.bindings.map((binding, index) => (
          <fieldset key={index} className="desk-role">
            <legend>تكليف {index + 1}</legend>
            <div className="desk-grid">
              <label>
                المستخدم
                <select
                  value={binding.userId}
                  onChange={(e) =>
                    edit((c) => {
                      c.bindings[index].userId = e.target.value;
                    })
                  }
                >
                  <option value="">اختر المستخدم</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} · {u.id.slice(-6)}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                الدور
                <select
                  value={binding.roleId}
                  onChange={(e) =>
                    edit((c) => {
                      c.bindings[index].roleId = e.target.value;
                    })
                  }
                >
                  {config.roles.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                نوع الحساب
                <select
                  value={binding.kind}
                  onChange={(e) =>
                    edit((c) => {
                      c.bindings[index].kind = e.target.value as
                        "human" | "agent";
                    })
                  }
                >
                  <option value="human">مستخدم بشري</option>
                  <option value="agent">وكيل اقتراح</option>
                </select>
              </label>
              <label>
                المجالات (تفصل بفاصلة)
                <input
                  value={binding.domains.join(",")}
                  onChange={(e) =>
                    edit((c) => {
                      c.bindings[index].domains = e.target.value
                        .split(/[,،]/)
                        .map((v) => v.trim())
                        .filter(Boolean);
                    })
                  }
                />
              </label>
            </div>
            <div className="desk-grid">
              {targetSchema.options.map((t) => (
                <label className="desk-check" key={t}>
                  <input
                    type="checkbox"
                    checked={binding.targets.includes(t)}
                    onChange={(e) =>
                      edit((c) => {
                        c.bindings[index].targets = e.target.checked
                          ? [...binding.targets, t]
                          : binding.targets.filter((x) => x !== t);
                      })
                    }
                  />
                  {TARGET_LABELS[t]}
                </label>
              ))}
            </div>
            <label className="desk-check">
              <input
                type="checkbox"
                checked={binding.enabled}
                onChange={(e) =>
                  edit((c) => {
                    c.bindings[index].enabled = e.target.checked;
                  })
                }
              />
              التكليف مفعل
            </label>
            <button
              type="button"
              className="desk-danger"
              onClick={() =>
                edit((c) => {
                  c.bindings.splice(index, 1);
                })
              }
            >
              سحب التكليف
            </button>
          </fieldset>
        ))}
        <button
          type="button"
          className="desk-secondary"
          onClick={() =>
            edit((c) => {
              c.bindings.push({
                userId: users[0]?.id ?? "",
                roleId: c.roles[0]?.id ?? "",
                kind: "human",
                targets: ["work"],
                domains: [],
                enabled: true,
              });
            })
          }
        >
          إضافة تكليف
        </button>
      </section>
      <section className="desk-card">
        <h2>سياسات الاعتماد</h2>
        <p>
          عدد الموافقات يعني مستخدمين مختلفين. يُعاد التحقق من صلاحياتهم قبل
          النشر، والاعتماد الذاتي مغلق افتراضيًا.
        </p>
        {config.policies.map((p, index) => (
          <div className="desk-role" key={p.target}>
            <h3>{TARGET_LABELS[p.target]}</h3>
            <div className="desk-grid">
              <label>
                عدد الموافقات المطلوبة
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={p.minApprovals}
                  onChange={(e) =>
                    edit((c) => {
                      c.policies[index].minApprovals = Number(e.target.value);
                    })
                  }
                />
              </label>
              <label className="desk-check">
                <input
                  type="checkbox"
                  checked={p.enabled}
                  onChange={(e) =>
                    edit((c) => {
                      c.policies[index].enabled = e.target.checked;
                    })
                  }
                />
                المسار مفعل
              </label>
              <label className="desk-check">
                <input
                  type="checkbox"
                  checked={p.ownerSelfApproval}
                  onChange={(e) =>
                    edit((c) => {
                      c.policies[index].ownerSelfApproval = e.target.checked;
                    })
                  }
                />
                استثناء المالك للاعتماد الذاتي بسبب موثق
              </label>
              <label className="desk-check">
                <input
                  type="checkbox"
                  checked={p.urgentOwnerRevert}
                  onChange={(e) =>
                    edit((c) => {
                      c.policies[index].urgentOwnerRevert = e.target.checked;
                    })
                  }
                />
                السماح للمالك بتراجع عاجل دون انتظار الموافقات، مع سبب وإشعار
                الفريق
              </label>
            </div>
          </div>
        ))}
      </section>
      <section className="desk-card">
        <h2>قوالب المهام</h2>
        <p>
          تنشأ مهمة تلقائيًا عند استلام تغيير من النوع المحدد، ثم يمكن إسنادها
          من صفحة المهام.
        </p>
        {config.taskTemplates.map((t, index) => (
          <div className="desk-role" key={t.id}>
            <div className="desk-grid">
              <label>
                اسم المهمة
                <input
                  value={t.name}
                  onChange={(e) =>
                    edit((c) => {
                      c.taskTemplates[index].name = e.target.value;
                    })
                  }
                />
              </label>
              <label>
                نوع المحتوى
                <select
                  value={t.target}
                  onChange={(e) =>
                    edit((c) => {
                      c.taskTemplates[index].target = targetSchema.parse(
                        e.target.value,
                      );
                    })
                  }
                >
                  {targetSchema.options.map((x) => (
                    <option key={x} value={x}>
                      {TARGET_LABELS[x]}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                الدور المسؤول
                <select
                  value={t.roleId}
                  onChange={(e) =>
                    edit((c) => {
                      c.taskTemplates[index].roleId = e.target.value;
                    })
                  }
                >
                  {config.roles.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                المهلة بالساعات
                <input
                  type="number"
                  min={1}
                  max={8760}
                  value={t.dueHours}
                  onChange={(e) =>
                    edit((c) => {
                      c.taskTemplates[index].dueHours = Number(e.target.value);
                    })
                  }
                />
              </label>
              <label className="desk-check">
                <input
                  type="checkbox"
                  checked={t.enabled}
                  onChange={(e) =>
                    edit((c) => {
                      c.taskTemplates[index].enabled = e.target.checked;
                    })
                  }
                />
                مفعلة
              </label>
            </div>
            <button
              type="button"
              className="desk-danger"
              onClick={() =>
                edit((c) => {
                  c.taskTemplates.splice(index, 1);
                })
              }
            >
              حذف القالب
            </button>
          </div>
        ))}
        <button
          type="button"
          className="desk-secondary"
          onClick={() =>
            edit((c) => {
              c.taskTemplates.push({
                id: crypto.randomUUID(),
                name: "مراجعة المصدر",
                target: "work",
                roleId: c.roles[0]?.id ?? "",
                dueHours: 48,
                enabled: true,
              });
            })
          }
        >
          إضافة قالب مهمة
        </button>
      </section>
      <section className="desk-card">
        <h2>تصنيفات الوثائق وأدوات الإصدار</h2>
        <div className="desk-grid">
          <label>
            أنواع الوثائق — نوع في كل سطر
            <textarea
              rows={8}
              value={config.documentKinds.join("\n")}
              onChange={(e) =>
                edit((c) => {
                  c.documentKinds = e.target.value.split("\n");
                })
              }
            />
          </label>
          <label>
            أدوات الإصدار — أداة في كل سطر
            <textarea
              rows={8}
              value={config.instrumentKinds.join("\n")}
              onChange={(e) =>
                edit((c) => {
                  c.instrumentKinds = e.target.value.split("\n");
                })
              }
            />
          </label>
        </div>
        <label>
          سبب التغيير
          <textarea
            required
            minLength={5}
            maxLength={2000}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </label>
        <button disabled={disabled} className="desk-primary">
          حفظ نسخة الإعدادات
        </button>
      </section>
    </form>
  );
}
