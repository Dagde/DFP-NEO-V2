with open('components/TraineeDatabaseTable.tsx', 'r') as f:
    content = f.read()

# Fix the broken header - remove nested th tags
content = content.replace(
    """                <th className="px-4 py-3 text-left text-sm font-semibold tracking-wide">
                  NAME
                    <th className="px-4 py-3 text-left text-sm font-semibold tracking-wide">
                      ROLE
                    </th>
                </th>""",
    """                <th className="px-4 py-3 text-left text-sm font-semibold tracking-wide">
                  NAME
                </th>
                <th className="px-4 py-3 text-left text-sm font-semibold tracking-wide">
                  ROLE
                </th>"""
)

# Fix the broken cell - remove nested td tags
content = content.replace(
    """                    <td className="px-4 py-3 text-sm text-white">
                      {trainee.name}
                       <td className="px-4 py-3 text-sm text-white">
   
                          Trainee
   
                        </td>
   
                    </td>""",
    """                    <td className="px-4 py-3 text-sm text-white">
                      {trainee.name}
                    </td>
                    <td className="px-4 py-3 text-sm text-white">
                      Trainee
                    </td>"""
)

with open('components/TraineeDatabaseTable.tsx', 'w') as f:
    f.write(content)

print("Fixed HTML structure.")