import re

with open('src/pages/Players.tsx', 'r') as f:
    content = f.read()

content = content.replace("getPlayerGroup(p.position) === posId", "getPlayerGroup(p.position || '') === posId")

with open('src/pages/Players.tsx', 'w') as f:
    f.write(content)

with open('src/services/data.ts', 'r') as f:
    lines = f.readlines()

new_lines = []
for i, line in enumerate(lines):
    line_num = i + 1
    
    # Fix the method names and any type
    if line_num == 17:
        line = line.replace('getTrainingAttendances', 'getTrainingAttendance')
    if line_num == 19:
        line = line.replace('a =>', '(a: any) =>')
    if line_num == 33:
        line = line.replace('setTrainingAttendances', 'setTrainingAttendance')
        
    # Keep applyCompetitiveLeaveEffects only in specific lines
    if 'applyCompetitiveLeaveEffects(' in line:
        if line_num not in [6, 1396, 1417, 1444, 1469]:
            continue # Remove this line
            
    new_lines.append(line)

with open('src/services/data.ts', 'w') as f:
    f.writelines(new_lines)
