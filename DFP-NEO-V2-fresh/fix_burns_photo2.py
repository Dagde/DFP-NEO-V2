content = open('components/InstructorProfileFlyout.tsx').read()

old = '                          <img src="/burns-profile.png" alt={instructor.name} className="w-full h-full object-cover object-top" />'
new = '                          <img src="https://dfp-neo.com/burns-profile.png" alt={instructor.name} className="w-full h-full object-cover object-top" />'

if old in content:
    content = content.replace(old, new, 1)
    open('components/InstructorProfileFlyout.tsx', 'w').write(content)
    print('Done')
else:
    print('NOT FOUND')
    idx = content.find('burns-profile')
    print(repr(content[idx-50:idx+200]))