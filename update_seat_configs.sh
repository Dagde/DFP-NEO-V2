#!/bin/bash
# Update pilot names to separate seat config with normal font

# Line 375 - FTD duty sup
sed -i '375s|<div className={picClasses}>{picName?.split.*}</div>|<div className={picClasses}>{picName?.split('\''\xe2\x80\x93'\'')[0]}</div>{picSeatConfig && <span className="font-normal text-white/80 ml-1">{picSeatConfig}</span>}|' components/FlightTile.tsx

# Line 387 - FTD regular  
sed -i '387s|<div className={picClasses}>{picName?.split.*}</div>|<div className={picClasses}>{picName?.split('\''\xe2\x80\x93'\'')[0]}</div>{picSeatConfig && <span className="font-normal text-white/80 ml-1">{picSeatConfig}</span>}|' components/FlightTile.tsx

# Line 406 - Flight events
sed -i '406s|<div className={picClasses}>{picName?.split.*}</div>|<div className={picClasses}>{picName?.split('\''\xe2\x80\x93'\'')[0]}</div>{picSeatConfig && <span className="font-normal text-white/80 ml-1">{picSeatConfig}</span>}|' components/FlightTile.tsx

# Line 505 - Flyout
sed -i '505s|<div className={`font-bold.*}>{picName?.split.*}</div>|<div className={`font-bold ${picClasses.replace('\''truncate'\'', '\''\'\'')}`}>{picName?.split('\''\xe2\x80\x93'\'')[0]}</div>{picSeatConfig && <span className="font-normal text-white/80 ml-1">{picSeatConfig}</span>}|' components/FlightTile.tsx

echo "Updated pilot names with normal font seat config"