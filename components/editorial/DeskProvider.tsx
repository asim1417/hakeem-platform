"use client";
import { DataProvider, Refine } from "@refinedev/core";

const unsupported = async () => {
  throw new Error("استخدم إجراء مكتب التحرير المعتمد.");
};
const provider: DataProvider = {
  getApiUrl: () => "/api/admin/legal",
  getList: unsupported,
  getOne: unsupported,
  create: unsupported,
  update: unsupported,
  deleteOne: unsupported,
  custom: async ({ url, method, payload, query }) => {
    const target = new URL(url, window.location.origin);
    for (const [key, value] of Object.entries(query ?? {}))
      if (value !== undefined && value !== null)
        target.searchParams.set(key, String(value));
    const result = await fetch(target, {
      method: method.toUpperCase(),
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: method === "get" ? undefined : JSON.stringify(payload),
    });
    const data = await result.json();
    if (!result.ok)
      throw {
        message: data.message ?? "تعذر الطلب",
        statusCode: result.status,
      };
    return { data };
  },
};
export function DeskProvider({ children }: { children: React.ReactNode }) {
  return (
    <Refine
      dataProvider={provider}
      options={{
        disableTelemetry: true,
        reactQuery: {
          clientConfig: {
            defaultOptions: {
              queries: { retry: false, refetchOnWindowFocus: false },
            },
          },
        },
      }}
    >
      {children}
    </Refine>
  );
}
