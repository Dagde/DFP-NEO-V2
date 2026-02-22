"use strict";
"use client";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// app/test-sso/page.tsx
var page_exports = {};
__export(page_exports, {
  default: () => TestSSOPage
});
module.exports = __toCommonJS(page_exports);
var import_react = require("react");
function TestSSOPage() {
  (0, import_react.useEffect)(() => {
    console.log("[TEST SSO] Page loaded");
    console.log("[TEST SSO] Full URL:", window.location.href);
    console.log("[TEST SSO] Search params:", window.location.search);
    const urlParams = new URLSearchParams(window.location.search);
    const userId = urlParams.get("userId");
    const username = urlParams.get("username");
    console.log("[TEST SSO] userId:", userId);
    console.log("[TEST SSO] username:", username);
    document.body.innerHTML = `
      <h1>SSO Test Page</h1>
      <h2>Full URL: ${window.location.href}</h2>
      <h2>Search Params: ${window.location.search}</h2>
      <h3>userId: ${userId || "NOT FOUND"}</h3>
      <h3>username: ${username || "NOT FOUND"}</h3>
      <p>If you see userId and username above, SSO is working!</p>
    `;
  }, []);
  return /* @__PURE__ */ React.createElement("div", null, "Loading...");
}
