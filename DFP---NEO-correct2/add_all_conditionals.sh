#!/bin/bash

# Add conditionals for Units
sed -i '/^[[:space:]]*{\/\* Units Window \*\/}/a\                   {activeSection === '\''units'\'' && (' components/SettingsView.tsx

# Add conditionals for SCT Events  
sed -i '/^[[:space:]]*{\/\* SCT Events Window \*\/}/a\                   {activeSection === '\''sct-events'\'' && (' components/SettingsView.tsx

# Add conditionals for Currencies
sed -i '/^[[:space:]]*{\/\* Currencies Window \*\/}/a\                   {activeSection === '\''currencies'\'' && (' components/SettingsView.tsx

# Add conditionals for Data Loaders
sed -i '/^[[:space:]]*{\/\* Data Loaders Window \*\/}/a\                   {activeSection === '\''data-loaders'\'' && (' components/SettingsView.tsx

# Add conditionals for Events Limits
sed -i '/^[[:space:]]*{\/\* Events Limits Window \*\/}/a\                   {activeSection === '\''event-limits'\'' && (' components/SettingsView.tsx

# Add conditionals for Permissions Manager
sed -i '/^[[:space:]]*{\/\* Permissions Manager Window \*\/}/a\                   {activeSection === '\''permissions'\'' && (' components/SettingsView.tsx

echo "Conditionals added"