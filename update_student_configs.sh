#!/bin/bash
# Update student names to separate seat config with normal font

# Line 388 - FTD regular
sed -i '388s|<div className={studentClasses}>{typeof studentDisplay === .string. ? studentDisplay \+ studentSeatConfig : studentDisplay}</div>|<div className={studentClasses}>{typeof studentDisplay === '\''string'\'' ? <>{studentDisplay}{studentSeatConfig && <span className="font-normal text-white/80 ml-1">{studentSeatConfig}</span>}</> : studentDisplay}</div>|' components/FlightTile.tsx

# Line 407 - Flight events  
sed -i '407s|<div className={studentClasses}>{typeof studentDisplay === .string. ? studentDisplay \+ studentSeatConfig : studentDisplay}</div>|<div className={studentClasses}>{typeof studentDisplay === '\''string'\'' ? <>{studentDisplay}{studentSeatConfig && <span className="font-normal text-white/80 ml-1">{studentSeatConfig}</span>}</> : studentDisplay}</div>|' components/FlightTile.tsx

# Line 506 - Flyout
sed -i '506s|<div className={studentClasses.*}>{typeof studentDisplay === .string. ? studentDisplay \+ studentSeatConfig : studentDisplay}</div>|<div className={studentClasses.replace('\''truncate'\'', '\''\'\'')}>{typeof studentDisplay === '\''string'\'' ? <>{studentDisplay}{studentSeatConfig && <span className="font-normal text-white/80 ml-1">{studentSeatConfig}</span>}</> : studentDisplay}</div>|' components/FlightTile.tsx

echo "Updated student names with normal font seat config"