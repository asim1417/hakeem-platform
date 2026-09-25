/** واجهة MCP Apps مستقلة لبطاقة خدمة أمان داخل ChatGPT. */

export const AMAN_TRIAGE_WIDGET_URI = "ui://aman/triage-card-v1.html";

export const AMAN_TRIAGE_WIDGET_HTML = String.raw`<!doctype html>
<html lang="ar" dir="rtl">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>أمان الامتثال</title>
    <style>
      :root { color-scheme: light; font-family: "IBM Plex Sans Arabic", Tahoma, Arial, sans-serif; }
      * { box-sizing: border-box; }
      body { margin: 0; background: #f6f7f4; color: #102c28; }
      main { max-width: 680px; margin: 0 auto; padding: 16px; }
      .card { overflow: hidden; border: 1px solid #d7ddd7; border-radius: 18px; background: #fff; box-shadow: 0 8px 24px rgba(14, 41, 37, .08); }
      .hero { padding: 20px; background: linear-gradient(135deg, #0f3b33, #174e43); color: #fff; }
      .eyebrow { margin: 0 0 8px; color: #d9b36c; font-size: 13px; font-weight: 700; }
      h1 { margin: 0; font-size: 21px; line-height: 1.45; }
      .badges { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 14px; }
      .badge { border: 1px solid rgba(255,255,255,.24); border-radius: 999px; padding: 5px 10px; font-size: 12px; }
      .content { display: grid; gap: 18px; padding: 20px; }
      h2 { margin: 0 0 8px; color: #133e35; font-size: 16px; }
      p { margin: 0; line-height: 1.75; font-size: 14px; }
      ul { display: grid; gap: 7px; margin: 0; padding: 0 18px 0 0; }
      li { font-size: 13px; line-height: 1.6; }
      .grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
      .panel { border: 1px solid #e3e8e3; border-radius: 14px; padding: 14px; background: #fbfcfa; }
      .notice { border-right: 4px solid #c3913d; padding: 10px 12px; background: #fff8e9; color: #5d4721; font-size: 12px; line-height: 1.7; }
      .actions { display: grid; gap: 9px; }
      .action { display: block; border-radius: 10px; padding: 11px 13px; background: #0f3b33; color: #fff; font-size: 14px; font-weight: 700; text-align: center; text-decoration: none; }
      .action:hover { background: #0a2c25; }
      .action-note { margin-top: 5px; color: #596762; font-size: 11px; line-height: 1.5; }
      .policies { display: flex; flex-wrap: wrap; gap: 12px; }
      .policies a { color: #0f5b4c; font-size: 12px; text-decoration: underline; }
      .empty { color: #66746f; font-size: 14px; }
      @media (max-width: 540px) { .grid { grid-template-columns: 1fr; } .hero, .content { padding: 16px; } }
    </style>
  </head>
  <body>
    <main>
      <section class="card" aria-live="polite">
        <div class="hero">
          <p class="eyebrow">أمان الامتثال للمحاماة والاستشارات القانونية</p>
          <h1 id="title">بطاقة الخدمة القانونية</h1>
          <div class="badges" id="badges"></div>
        </div>
        <div class="content" id="content"><p class="empty">يجري تجهيز بطاقة الخدمة…</p></div>
      </section>
    </main>
    <script>
      (function () {
        var pending = new Map();
        var sequence = 0;
        var targetOrigin = "*";
        try { if (document.referrer) targetOrigin = new URL(document.referrer).origin; } catch (_) {}

        function request(method, params) {
          return new Promise(function (resolve, reject) {
            var id = "aman-" + (++sequence);
            pending.set(id, { resolve: resolve, reject: reject });
            window.parent.postMessage({ jsonrpc: "2.0", id: id, method: method, params: params }, targetOrigin);
          });
        }

        function notify(method, params) {
          window.parent.postMessage({ jsonrpc: "2.0", method: method, params: params }, targetOrigin);
        }

        function asArray(value) { return Array.isArray(value) ? value : []; }
        function element(tag, text, className) {
          var node = document.createElement(tag);
          if (text) node.textContent = text;
          if (className) node.className = className;
          return node;
        }

        function render(data) {
          if (!data || !data.service) return;
          document.getElementById("title").textContent = data.service.title || "بطاقة الخدمة القانونية";
          var badges = document.getElementById("badges");
          badges.replaceChildren();
          [data.legal_area_label, data.urgency_label].filter(Boolean).forEach(function (label) {
            badges.appendChild(element("span", label, "badge"));
          });

          var content = document.getElementById("content");
          content.replaceChildren();
          var summary = element("section");
          summary.appendChild(element("h2", "نطاق الخدمة"));
          summary.appendChild(element("p", data.service.description || ""));
          content.appendChild(summary);

          var grid = element("div", "", "grid");
          var focusPanel = element("section", "", "panel");
          focusPanel.appendChild(element("h2", "ما يمكن أن يغطيه الفريق"));
          var focus = element("ul");
          asArray(data.service.focus).forEach(function (item) { focus.appendChild(element("li", item)); });
          focusPanel.appendChild(focus);
          grid.appendChild(focusPanel);

          var docsPanel = element("section", "", "panel");
          docsPanel.appendChild(element("h2", "وثائق جهزها لاحقًا"));
          var docs = element("ul");
          asArray(data.suggested_documents).forEach(function (item) { docs.appendChild(element("li", item)); });
          docsPanel.appendChild(docs);
          grid.appendChild(docsPanel);
          content.appendChild(grid);

          var steps = element("section");
          steps.appendChild(element("h2", "الخطوات المقترحة"));
          var list = element("ul");
          asArray(data.recommended_steps).forEach(function (item) { list.appendChild(element("li", item)); });
          steps.appendChild(list);
          content.appendChild(steps);

          [data.privacy_notice, data.legal_notice].filter(Boolean).forEach(function (notice) {
            content.appendChild(element("p", notice, "notice"));
          });

          var options = asArray(data.contact_options);
          if (options.length) {
            var actions = element("section");
            actions.appendChild(element("h2", "تواصل بموافقتك"));
            var actionList = element("div", "", "actions");
            options.forEach(function (option) {
              if (!option || !option.href) return;
              var wrapper = element("div");
              var anchor = element("a", option.label || "فتح بوابة أمان", "action");
              anchor.href = option.href;
              anchor.target = "_blank";
              anchor.rel = "noopener noreferrer";
              wrapper.appendChild(anchor);
              if (option.note) wrapper.appendChild(element("p", option.note, "action-note"));
              actionList.appendChild(wrapper);
            });
            actions.appendChild(actionList);
            content.appendChild(actions);
          }

          var policies = asArray(data.policy_links);
          if (policies.length) {
            var policiesSection = element("section");
            var policyLinks = element("div", "", "policies");
            policies.forEach(function (policy) {
              if (!policy || !policy.href) return;
              var policyAnchor = element("a", policy.label || "معلومات قانونية");
              policyAnchor.href = policy.href;
              policyAnchor.target = "_blank";
              policyAnchor.rel = "noopener noreferrer";
              policyLinks.appendChild(policyAnchor);
            });
            policiesSection.appendChild(policyLinks);
            content.appendChild(policiesSection);
          }
        }

        function structuredContent(message) {
          return message && message.structuredContent || message && message.result && message.result.structuredContent || message && message.params && message.params.structuredContent || message && message.params && message.params.result && message.params.result.structuredContent;
        }

        window.addEventListener("message", function (event) {
          var message = event.data || {};
          if (message.id && pending.has(message.id)) {
            var requestState = pending.get(message.id);
            pending.delete(message.id);
            if (message.error) requestState.reject(message.error); else requestState.resolve(message.result);
            return;
          }
          if (message.method === "ui/notifications/tool-result") render(structuredContent(message));
        }, { passive: true });

        var initial = window.openai && (window.openai.toolOutput && (window.openai.toolOutput.structuredContent || window.openai.toolOutput));
        if (initial) render(initial);

        request("ui/initialize", { appInfo: { name: "aman-legal-triage", version: "1.0.0" }, appCapabilities: {}, protocolVersion: "2026-01-26" })
          .then(function () { notify("ui/notifications/initialized", {}); })
          .catch(function () { /* UI remains usable through compatibility state. */ });
      })();
    </script>
  </body>
</html>`;
