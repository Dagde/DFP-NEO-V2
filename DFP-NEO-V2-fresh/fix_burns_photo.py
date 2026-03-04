content = open('components/InstructorProfileFlyout.tsx').read()

old = (
    '                    {/* Profile photo */}\n'
    '                    <div className="flex-shrink-0">\n'
    '                      <div className="w-16 h-20 bg-gray-600 rounded border border-gray-500 flex items-center justify-center overflow-hidden">\n'
    '                        <svg className="w-10 h-10 text-gray-400" fill="currentColor" viewBox="0 0 24 24">\n'
    '                          <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z"/>\n'
    '                        </svg>\n'
    '                      </div>\n'
    '                    </div>'
)

new = (
    '                    {/* Profile photo */}\n'
    '                    <div className="flex-shrink-0">\n'
    '                      <div className="w-20 h-24 bg-gray-600 rounded border border-gray-500 flex items-center justify-center overflow-hidden">\n'
    '                        {instructor.name && instructor.name.toLowerCase().includes(\'burns\') ? (\n'
    '                          <img src="/burns-profile.png" alt={instructor.name} className="w-full h-full object-cover object-top" />\n'
    '                        ) : (\n'
    '                          <svg className="w-10 h-10 text-gray-400" fill="currentColor" viewBox="0 0 24 24">\n'
    '                            <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z"/>\n'
    '                          </svg>\n'
    '                        )}\n'
    '                      </div>\n'
    '                    </div>'
)

if old in content:
    content = content.replace(old, new, 1)
    open('components/InstructorProfileFlyout.tsx', 'w').write(content)
    print('Done')
else:
    print('NOT FOUND')
    idx = content.find('Profile photo')
    print(repr(content[idx:idx+400]))