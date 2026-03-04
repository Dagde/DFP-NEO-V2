content = open('mockData.ts').read()

# Fix the comment and the num1FTSFltlts / numCFSFltlts values
old = (
    '    // ESL: 28 for 1FTS + 11 for CFS = 39 FLTLTs\n'
    '    // Total ESL: 4 exec (1FTS) + 28 FLTLT (1FTS) = 32 for 1FTS\n'
    '    //            2 exec (CFS) + 11 FLTLT (CFS) + 1 Joe Bloggs (CFS) = 14 for CFS\n'
    '    // PEA: 31 for 2FTS\n'
    '    const num1FTSFltlts = isESL ? 32 : 0;\n'
    '    const numCFSFltlts = isESL ? 16 : 0;'
)

new = (
    '    // ESL: 34 for 1FTS + 15 for CFS = 49 FLTLTs\n'
    '    // Total ESL: 4 exec (1FTS) + 34 FLTLT (1FTS) = 38 for 1FTS\n'
    '    //            2 exec (CFS) + 15 FLTLT (CFS) + 1 Joe Bloggs (CFS) = 18 for CFS\n'
    '    // PEA: 31 for 2FTS\n'
    '    const num1FTSFltlts = isESL ? 34 : 0;\n'
    '    const numCFSFltlts = isESL ? 15 : 0;'
)

if old in content:
    content = content.replace(old, new, 1)
    open('mockData.ts', 'w').write(content)
    print('Done')
else:
    print('NOT FOUND')
    idx = content.find('num1FTSFltlts')
    print(repr(content[idx-200:idx+200]))