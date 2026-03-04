#!/bin/bash

# This script adds audit buttons to all remaining views

# PT051View
if ! grep -q "import AuditButton" DFP---NEO/components/PT051View.tsx; then
    sed -i '/^import.*from.*types/a import AuditButton from '\''./AuditButton'\'';' DFP---NEO/components/PT051View.tsx
fi

# HateSheetView
if ! grep -q "import AuditButton" DFP---NEO/components/HateSheetView.tsx; then
    sed -i '/^import.*from.*types/a import AuditButton from '\''./AuditButton'\'';' DFP---NEO/components/HateSheetView.tsx
fi

# SyllabusView
if ! grep -q "import AuditButton" DFP---NEO/components/SyllabusView.tsx; then
    sed -i '/^import.*from.*types/a import AuditButton from '\''./AuditButton'\'';' DFP---NEO/components/SyllabusView.tsx
fi

# TraineeLmpView
if ! grep -q "import AuditButton" DFP---NEO/components/TraineeLmpView.tsx; then
    sed -i '/^import.*from.*types/a import AuditButton from '\''./AuditButton'\'';' DFP---NEO/components/TraineeLmpView.tsx
fi

# PostFlightView
if ! grep -q "import AuditButton" DFP---NEO/components/PostFlightView.tsx; then
    sed -i '/^import.*from.*types/a import AuditButton from '\''./AuditButton'\'';' DFP---NEO/components/PostFlightView.tsx
fi

# SettingsView
if ! grep -q "import AuditButton" DFP---NEO/components/SettingsView.tsx; then
    sed -i '/^import.*from.*types/a import AuditButton from '\''./AuditButton'\'';' DFP---NEO/components/SettingsView.tsx
fi

# CurrencyView
if ! grep -q "import AuditButton" DFP---NEO/components/CurrencyView.tsx; then
    sed -i '/^import.*from.*types/a import AuditButton from '\''./AuditButton'\'';' DFP---NEO/components/CurrencyView.tsx
fi

# CurrencyBuilderView
if ! grep -q "import AuditButton" DFP---NEO/components/CurrencyBuilderView.tsx; then
    sed -i '/^import.*from.*types/a import AuditButton from '\''./AuditButton'\'';' DFP---NEO/components/CurrencyBuilderView.tsx
fi

# InstructorScheduleView
if ! grep -q "import AuditButton" DFP---NEO/components/InstructorScheduleView.tsx; then
    sed -i '/^import.*from.*types/a import AuditButton from '\''./AuditButton'\'';' DFP---NEO/components/InstructorScheduleView.tsx
fi

# TraineeScheduleView
if ! grep -q "import AuditButton" DFP---NEO/components/TraineeScheduleView.tsx; then
    sed -i '/^import.*from.*types/a import AuditButton from '\''./AuditButton'\'';' DFP---NEO/components/TraineeScheduleView.tsx
fi

# NextDayInstructorScheduleView
if ! grep -q "import AuditButton" DFP---NEO/components/NextDayInstructorScheduleView.tsx; then
    sed -i '/^import.*from.*types/a import AuditButton from '\''./AuditButton'\'';' DFP---NEO/components/NextDayInstructorScheduleView.tsx
fi

# NextDayTraineeScheduleView
if ! grep -q "import AuditButton" DFP---NEO/components/NextDayTraineeScheduleView.tsx; then
    sed -i '/^import.*from.*types/a import AuditButton from '\''./AuditButton'\'';' DFP---NEO/components/NextDayTraineeScheduleView.tsx
fi

# ProgramDataView
if ! grep -q "import AuditButton" DFP---NEO/components/ProgramDataView.tsx; then
    sed -i '/^import.*from.*types/a import AuditButton from '\''./AuditButton'\'';' DFP---NEO/components/ProgramDataView.tsx
fi

# CourseProgressView
if ! grep -q "import AuditButton" DFP---NEO/components/CourseProgressView.tsx; then
    sed -i '/^import.*from.*types/a import AuditButton from '\''./AuditButton'\'';' DFP---NEO/components/CourseProgressView.tsx
fi

# LogbookView
if ! grep -q "import AuditButton" DFP---NEO/components/LogbookView.tsx; then
    sed -i '/^import.*from.*types/a import AuditButton from '\''./AuditButton'\'';' DFP---NEO/components/LogbookView.tsx
fi

echo "Audit button imports added successfully!"