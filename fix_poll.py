with open('/workspace/App.tsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Find the polling block
start_line = None
end_line = None
for i, line in enumerate(lines):
    if 'Mobile unavailability live-refresh polling' in line:
        start_line = i
    if 'End mobile unavailability polling' in line:
        end_line = i
        break

print(f"Start line: {start_line + 1}, End line: {end_line + 1}")

new_block = (
    "    // \u2500\u2500 Mobile unavailability live-refresh polling \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\n"
    "    // Poll every 5 seconds so that unavailability submitted from the iOS app\n"
    "    // appears in the browser without a hard refresh.\n"
    "    useEffect(() => {\n"
    "        const buildUnavailHash = (records: any[]): string => {\n"
    "            return records\n"
    "                .map(r => `${r.id}:${JSON.stringify((r.unavailability || []).map((u: any) => u.id).sort())}`)\n"
    "                .sort()\n"
    "                .join('|');\n"
    "        };\n"
    "\n"
    "        const pollUnavailability = async () => {\n"
    "            try {\n"
    "                console.log('[Poll] Polling /api/personnel and /api/trainees...');\n"
    "                const [personnelRes, traineesRes] = await Promise.all([\n"
    "                    fetch('/api/personnel', { credentials: 'include' }),\n"
    "                    fetch('/api/trainees',  { credentials: 'include' }),\n"
    "                ]);\n"
    "                console.log('[Poll] Personnel response:', personnelRes.status, 'Trainees response:', traineesRes.status);\n"
    "                if (personnelRes.ok) {\n"
    "                    const personnelData = await personnelRes.json();\n"
    "                    const dbPersonnel = (personnelData.personnel || []).map((p: any) => ({\n"
    "                        ...p,\n"
    "                        currencyStatus: p.qualifications?.currencyStatus || p.currencyStatus || [],\n"
    "                        _dataSource: 'database' as const,\n"
    "                        unavailability: Array.isArray(p.unavailability)\n"
    "                            ? p.unavailability.filter((u: any) => !u?.notes?.startsWith('__deploy__'))\n"
    "                            : p.unavailability,\n"
    "                    }));\n"
    "                    console.log('[Poll] Fetched', dbPersonnel.length, 'personnel from DB. Total unavailability entries:', dbPersonnel.reduce((sum: number, p: any) => sum + (p.unavailability?.length || 0), 0));\n"
    "                    setInstructorsData(prev => {\n"
    "                        const prevDbPersonnel = prev.filter(i => (i as any)._dataSource === 'database');\n"
    "                        const prevHash = buildUnavailHash(prevDbPersonnel);\n"
    "                        const newHash  = buildUnavailHash(dbPersonnel);\n"
    "                        console.log('[Poll] Personnel hash match:', prevHash === newHash, 'prevDB:', prevDbPersonnel.length, 'new:', dbPersonnel.length);\n"
    "                        if (prevHash === newHash) return prev;\n"
    "                        console.log('[Poll] Personnel unavailability CHANGED - updating React state NOW');\n"
    "                        const nonDbInstructors = prev.filter(i => (i as any)._dataSource !== 'database');\n"
    "                        return [...nonDbInstructors, ...dbPersonnel];\n"
    "                    });\n"
    "                }\n"
    "                if (traineesRes.ok) {\n"
    "                    const traineesData = await traineesRes.json();\n"
    "                    const dbTrainees = (traineesData.trainees || []).map((t: any) => ({\n"
    "                        ...t,\n"
    "                        _dataSource: 'database' as const,\n"
    "                        unavailability: Array.isArray(t.unavailability)\n"
    "                            ? t.unavailability.filter((u: any) => !u?.notes?.startsWith('__deploy__'))\n"
    "                            : t.unavailability,\n"
    "                    }));\n"
    "                    console.log('[Poll] Fetched', dbTrainees.length, 'trainees from DB. Total unavailability entries:', dbTrainees.reduce((sum: number, t: any) => sum + (t.unavailability?.length || 0), 0));\n"
    "                    setTraineesData(prev => {\n"
    "                        const prevDbTrainees = prev.filter(t => (t as any)._dataSource === 'database');\n"
    "                        const prevHash = buildUnavailHash(prevDbTrainees);\n"
    "                        const newHash  = buildUnavailHash(dbTrainees);\n"
    "                        console.log('[Poll] Trainee hash match:', prevHash === newHash);\n"
    "                        if (prevHash === newHash) return prev;\n"
    "                        console.log('[Poll] Trainee unavailability CHANGED - updating React state NOW');\n"
    "                        const mockTrainees = prev.filter(t => (t as any)._dataSource === 'mockdata');\n"
    "                        return [...mockTrainees, ...dbTrainees];\n"
    "                    });\n"
    "                }\n"
    "            } catch (e) {\n"
    "                console.error('[Poll] Error during poll:', e);\n"
    "            }\n"
    "        };\n"
    "\n"
    "        // Poll immediately on load, then every 5 seconds for near-instant updates\n"
    "        pollUnavailability();\n"
    "        const pollInterval = setInterval(pollUnavailability, 5 * 1000);\n"
    "        return () => clearInterval(pollInterval);\n"
    "    // eslint-disable-next-line react-hooks/exhaustive-deps\n"
    "    }, []);\n"
    "    // \u2500\u2500 End mobile unavailability polling \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\n"
    "\n"
)

new_lines = lines[:start_line] + [new_block] + lines[end_line + 1:]

with open('/workspace/App.tsx', 'w', encoding='utf-8') as f:
    f.writelines(new_lines)

print(f"Done. New file has {len(new_lines)} lines (was {len(lines)})")