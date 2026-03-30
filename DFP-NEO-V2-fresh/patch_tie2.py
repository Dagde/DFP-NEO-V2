with open('components/tabs/TrainingIntelligenceTab.tsx', 'r') as f:
    content = f.read()

# ──────────────────────────────────────────────────────────────────────
# 1. Add gradeByTraineeModal state to TraineeTab
# ──────────────────────────────────────────────────────────────────────
old1 = "  const [progressionModal, setProgressionModal] = useState<{ data: number[]; name: string; trend: string } | null>(null);"
new1 = """  const [progressionModal, setProgressionModal] = useState<{ data: number[]; name: string; trend: string } | null>(null);
  const [gradeByTraineeModal, setGradeByTraineeModal] = useState(false);"""

if old1 not in content:
    print("ERROR: patch 1 not found")
else:
    content = content.replace(old1, new1, 1)
    print("Patch 1 OK")

# ──────────────────────────────────────────────────────────────────────
# 2. Wire GradeByTraineeModal render (after ProgressionModal render)
# ──────────────────────────────────────────────────────────────────────
old2 = """      {progressionModal && (
        <ProgressionModal
          data={progressionModal.data}
          name={progressionModal.name}
          trend={progressionModal.trend}
          onClose={() => setProgressionModal(null)}
        />
      )}"""
new2 = """      {progressionModal && (
        <ProgressionModal
          data={progressionModal.data}
          name={progressionModal.name}
          trend={progressionModal.trend}
          onClose={() => setProgressionModal(null)}
        />
      )}

      {gradeByTraineeModal && (
        <GradeByTraineeModal
          trainees={[...trainees].sort((a, b) => safeN(a.avgOverallGrade) - safeN(b.avgOverallGrade)).map(t => ({
            label: t.traineeFullName.split(' ').pop() || t.traineeFullName,
            value: safeN(t.avgOverallGrade),
          }))}
          onClose={() => setGradeByTraineeModal(false)}
        />
      )}"""

if old2 not in content:
    print("ERROR: patch 2 not found")
else:
    content = content.replace(old2, new2, 1)
    print("Patch 2 OK")

# ──────────────────────────────────────────────────────────────────────
# 3. Grade by Trainee card — add click to expand + hint
# ──────────────────────────────────────────────────────────────────────
old3 = """              <SCard title="Grade by Trainee (sorted low to high)">
                <div className="overflow-x-auto">
                  <ColChart
                    data={[...trainees].sort((a, b) => safeN(a.avgOverallGrade) - safeN(b.avgOverallGrade)).map(t => ({
                      label: t.traineeFullName.split(' ').pop() || t.traineeFullName,
                      value: safeN(t.avgOverallGrade),
                    }))}
                    max={5} height={110} />
                </div>
              </SCard>"""
new3 = """              <SCard title="Grade by Trainee (sorted low to high)">
                <button
                  onClick={() => setGradeByTraineeModal(true)}
                  className="w-full hover:opacity-80 transition-opacity cursor-zoom-in text-left"
                  title="Click to enlarge"
                >
                  <div className="overflow-x-auto">
                    <ColChart
                      data={[...trainees].sort((a, b) => safeN(a.avgOverallGrade) - safeN(b.avgOverallGrade)).map(t => ({
                        label: t.traineeFullName.split(' ').pop() || t.traineeFullName,
                        value: safeN(t.avgOverallGrade),
                      }))}
                      max={5} height={130} />
                  </div>
                </button>
                <p className="text-xs text-gray-600 mt-1 text-center">click to enlarge</p>
              </SCard>"""

if old3 not in content:
    print("ERROR: patch 3 not found")
else:
    content = content.replace(old3, new3, 1)
    print("Patch 3 OK")

# ──────────────────────────────────────────────────────────────────────
# 4. Upgrade inline Grade Progression card — bigger sparkline + interactive
# ──────────────────────────────────────────────────────────────────────
old4 = """            {/* Progression sparkline — click to enlarge */}
            {selProgression.length >= 2 && (
              <SCard title="Grade Progression">
                <button
                  onClick={() => setProgressionModal({ data: selProgression, name: selected.traineeFullName, trend: selected.overallTrend })}
                  className="w-full hover:opacity-80 transition-opacity cursor-zoom-in"
                  title="Click to enlarge"
                >
                  <div className="flex justify-center py-1">
                    <SparkLine data={selProgression} width={210} height={55}
                      color={selected.overallTrend === 'improving' ? '#10b981' : selected.overallTrend === 'worsening' ? '#ef4444' : '#60a5fa'} />
                  </div>
                </button>
                <div className="flex justify-between text-xs text-gray-600 mt-0.5">
                  <span>Earliest</span><span>Latest</span>
                </div>
                <p className="text-xs text-gray-600 mt-1">{selProgression.length} assessments &middot; <span className="text-gray-500">click to enlarge</span></p>
              </SCard>
            )}"""

new4 = """            {/* Progression sparkline — interactive inline + click to enlarge */}
            {selProgression.length >= 2 && (
              <SCard title="Grade Progression">
                <div className="overflow-x-auto">
                  <SparkLine
                    data={selProgression}
                    labels={selProgression.map((_, i) => `Assessment #${i + 1}`)}
                    width={Math.max(230, selProgression.length * 28)}
                    height={90}
                    color={selected.overallTrend === 'improving' ? '#10b981' : selected.overallTrend === 'worsening' ? '#ef4444' : '#60a5fa'}
                    interactive={true}
                  />
                </div>
                <div className="flex justify-between text-xs text-gray-600 mt-1">
                  <span>Earliest</span><span>Latest</span>
                </div>
                <p className="text-xs text-gray-600 mt-1">{selProgression.length} assessments</p>
                <button
                  onClick={() => setProgressionModal({ data: selProgression, name: selected.traineeFullName, trend: selected.overallTrend })}
                  className="mt-2 w-full text-xs text-blue-400 hover:text-blue-300 hover:bg-blue-900/20 rounded py-1 transition-colors border border-blue-900/40"
                >
                  Expand full view
                </button>
              </SCard>
            )}"""

if old4 not in content:
    print("ERROR: patch 4 not found")
else:
    content = content.replace(old4, new4, 1)
    print("Patch 4 OK")

# ──────────────────────────────────────────────────────────────────────
# Write file
# ──────────────────────────────────────────────────────────────────────
with open('components/tabs/TrainingIntelligenceTab.tsx', 'w') as f:
    f.write(content)

print(f'Done. File length: {len(content)} chars')