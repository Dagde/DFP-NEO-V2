with open('/tmp/patched_index.js', 'rb') as f:
    content = f.read()

# The insertion point: insert before the closing of the return array
# We insert the showChoiceDialog conditional JSX as another item in the array
# It goes right before:  "  ] }, void 0, true, {\n    fileName: .../CoursesManagementView.tsx\",\n    lineNumber: 199,"

old_bytes = b'  ] }, void 0, true, {\n    fileName: "/workspace/DFP-NEO-V2-fresh/components/CoursesManagementView.tsx",\n    lineNumber: 199,\n    columnNumber: 9\n  }, void 0);\n};\nconst TrainingRecordsExportView'

# The new choice dialog JSX to insert before the closing bracket
# This follows the same jsxDEV pattern used throughout the bundle
new_choice_dialog = b'''  ,showChoiceDialog && /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("div", { className: "fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50", children: /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("div", { className: "bg-gray-800 rounded-lg p-6 max-w-sm w-full mx-4 shadow-xl", children: [
    /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("h3", { className: "text-xl font-semibold text-white mb-4", children: "What would you like to do?" }, void 0, false, { fileName: "/workspace/DFP-NEO-V2-fresh/components/CoursesManagementView.tsx", lineNumber: 315, columnNumber: 25 }, void 0),
    /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("p", { className: "text-gray-300 mb-6", children: ["Choose an action for course ", /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("span", { className: "font-semibold text-sky-400", children: courseToDelete }, void 0, false, { fileName: "/workspace/DFP-NEO-V2-fresh/components/CoursesManagementView.tsx", lineNumber: 316, columnNumber: 53 }, void 0)] }, void 0, true, { fileName: "/workspace/DFP-NEO-V2-fresh/components/CoursesManagementView.tsx", lineNumber: 316, columnNumber: 25 }, void 0),
    /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("div", { className: "flex flex-col gap-3", children: [
      /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("div", { className: "flex gap-3 justify-end", children: [
        /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("button", { onClick: handleCancelChoice, className: "px-4 py-2 bg-gray-700 text-white rounded-md hover:bg-gray-600 transition-colors", children: "Cancel" }, void 0, false, { fileName: "/workspace/DFP-NEO-V2-fresh/components/CoursesManagementView.tsx", lineNumber: 320, columnNumber: 29 }, void 0),
        /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("button", { onClick: handleArchiveCourse, className: "px-4 py-2 bg-amber-600 text-white rounded-md hover:bg-amber-700 transition-colors", children: "Archive Course" }, void 0, false, { fileName: "/workspace/DFP-NEO-V2-fresh/components/CoursesManagementView.tsx", lineNumber: 321, columnNumber: 29 }, void 0),
        /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("button", { onClick: handleDeleteCoursePermanently, className: "px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors", children: "Delete Permanently" }, void 0, false, { fileName: "/workspace/DFP-NEO-V2-fresh/components/CoursesManagementView.tsx", lineNumber: 322, columnNumber: 29 }, void 0)
      ] }, void 0, true, { fileName: "/workspace/DFP-NEO-V2-fresh/components/CoursesManagementView.tsx", lineNumber: 319, columnNumber: 25 }, void 0)
    ] }, void 0, true, { fileName: "/workspace/DFP-NEO-V2-fresh/components/CoursesManagementView.tsx", lineNumber: 318, columnNumber: 21 }, void 0)
  ] }, void 0, true, { fileName: "/workspace/DFP-NEO-V2-fresh/components/CoursesManagementView.tsx", lineNumber: 314, columnNumber: 21 }, void 0) }, void 0, false, { fileName: "/workspace/DFP-NEO-V2-fresh/components/CoursesManagementView.tsx", lineNumber: 313, columnNumber: 17 }, void 0)
'''

new_bytes = new_choice_dialog + old_bytes

if old_bytes in content:
    new_content = content.replace(old_bytes, new_bytes, 1)
    print(f'Patch 3 applied successfully!')
    print(f'Old size: {len(content)}')
    print(f'New size: {len(new_content)}')
    print(f'Difference: +{len(new_content) - len(content)} bytes')
    with open('/tmp/patched_index.js', 'wb') as f:
        f.write(new_content)
    print('File written.')
else:
    print('ERROR: Could not find insertion point!')
    # Debug: show what's at the expected location
    pos = content.find(b'lineNumber: 199,')
    print(f'lineNumber: 199, found at: {pos}')
    if pos != -1:
        print(repr(content[pos-200:pos+100]))