with open('App.tsx', 'r') as f:
    content = f.read()

# 1. Update handleSendAlert signature to accept description
old1 = '    const handleSendAlert = async (eventId: string, recipients: string[]) => {'
new1 = '    const handleSendAlert = async (eventId: string, recipients: string[], description: string = \'\') => {'
content = content.replace(old1, new1, 1)
print("1. Updated handleSendAlert signature:", old1 in content or new1 in content)

# 2. Add description to the payload
old2 = '''                eventDetails: eventForAlert ? {
                    flightNumber: eventForAlert.flightNumber,
                    startTime: eventForAlert.startTime,
                    duration: eventForAlert.duration,
                    resourceId: eventForAlert.resourceId,
                    instructor: eventForAlert.instructor,
                    student: eventForAlert.student,
                    pilot: eventForAlert.pilot,
                } : {},
            };'''
new2 = '''                description,
                eventDetails: eventForAlert ? {
                    flightNumber: eventForAlert.flightNumber,
                    startTime: eventForAlert.startTime,
                    duration: eventForAlert.duration,
                    resourceId: eventForAlert.resourceId,
                    instructor: eventForAlert.instructor,
                    student: eventForAlert.student,
                    pilot: eventForAlert.pilot,
                } : {},
            };'''
if old2 in content:
    content = content.replace(old2, new2, 1)
    print("2. Added description to payload: OK")
else:
    print("2. ERROR: payload old string not found")

with open('App.tsx', 'w') as f:
    f.write(content)

print("Done!")