const fs = require('fs');
let content = fs.readFileSync('components/FlightTile.tsx', 'utf8');

// Replace each pilot name display with separated seat config
const pilotRegex = /<div className={picClasses}>({picName\?\.\split\('\u2013'\)\[0\]}{picSeatConfig})<\/div>/g;
content = content.replace(pilotRegex, (match, pilotPart) => {
    const nameOnly = pilotPart.replace('{picSeatConfig}', '');
    return `<div className={picClasses}>${nameOnly}</div>{picSeatConfig && <span className="font-normal text-white/80 ml-1">{picSeatConfig}</span>}`;
});

// Replace each student name display with separated seat config
const studentRegex = /<div className={studentClasses}>({typeof studentDisplay === 'string' \? studentDisplay \+ studentSeatConfig : studentDisplay})<\/div>/g;
content = content.replace(studentRegex, (match, studentPart) => {
    if (studentPart.includes('+')) {
        return `<div className={studentClasses}>{typeof studentDisplay === 'string' ? <>{studentDisplay.replace(' + studentSeatConfig', '')}{studentSeatConfig && <span className="font-normal text-white/80 ml-1">{studentSeatConfig}</span>}</> : studentDisplay}</div>`;
    }
    return match;
});

// Handle the flyout case with font-bold
const flyoutPilotRegex = /<div className={`font-bold (${picClasses\.replace\('truncate', '''\)})`}>{picName\?\.\split\('\u2013'\)\[0\]}{picSeatConfig}<\/div>/g;
content = content.replace(flyoutPilotRegex, (match, picClasses) => {
    return `<div className={\`font-bold ${picClasses}\`}>{picName?.split('\u2013')[0]}</div>{picSeatConfig && <span className="font-normal text-white/80 ml-1">{picSeatConfig}</span>}`;
});

fs.writeFileSync('components/FlightTile.tsx', content);
console.log('Fixed seat config formatting');