with open('/workspace/App.tsx', 'r') as f:
    content = f.read()

# Remove the try-catch block for personnel API call
old_code = """                           let actualRank = data.user.rank || 'FLTLT';
                           try {
                               const personnelResponse = await fetch('/api/user/personnel', {
                                   credentials: 'include',
                               });
                               if (personnelResponse.ok) {
                                   const personnelData = await personnelResponse.json();
                                   if (personnelData.rank) {
                                       actualRank = personnelData.rank;
                                       console.log('\u2705 [SESSION] Fetched actual rank from Personnel:', actualRank);
                                   }
                               }
                           } catch (personnelError) {
                               console.log('\u26a0\ufe0f [SESSION] Could not fetch Personnel, using role from session:', actualRank);
                           }
                           """

new_code = """                           let actualRank = data.user.rank || 'FLTLT';
                           console.log('\u2705 [SESSION] Using rank from User table:', actualRank);
                           """

content = content.replace(old_code, new_code)

with open('/workspace/App.tsx', 'w') as f:
    f.write(content)

print("✅ Removed unnecessary personnel API call")
print("✅ Now using data.user.rank directly from User table")