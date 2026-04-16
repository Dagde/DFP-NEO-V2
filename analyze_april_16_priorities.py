#!/usr/bin/env python3
"""
Analyze the active DFP for April 16th and identify the 10 lowest priority flight events
from the prioritized Next event list.
"""

import json
import re
from typing import List, Dict, Any, Tuple
from datetime import datetime

# Color codes for output
GREEN = '\033[92m'
YELLOW = '\033[93m'
RED = '\033[91m'
BLUE = '\033[94m'
RESET = '\033[0m'

def extract_ts_interfaces(file_path: str) -> Dict[str, List[Dict]]:
    """Extract TypeScript interfaces and mock data from the main file."""
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Extract mockData section
    mock_data_match = re.search(r'export const mockData = ({[^;]+});', content, re.DOTALL)
    if not mock_data_match:
        print(f"{RED}Could not find mockData in {file_path}{RESET}")
        return {}
    
    try:
        # Parse the JavaScript object as JSON by cleaning it up
        mock_data_str = mock_data_match.group(1)
        # Convert JavaScript object to valid JSON
        mock_data_str = re.sub(r'(\w+):', r'"\1":', mock_data_str)  # Quote keys
        mock_data_str = re.sub(r"'([^']+)'", r'"\1"', mock_data_str)  # Single quotes to double quotes
        mock_data = json.loads(mock_data_str)
        return mock_data
    except Exception as e:
        print(f"{RED}Error parsing mockData: {e}{RESET}")
        return {}

def find_april_16_events(mock_data: Dict, build_date: str = "2026-04-16") -> List[Dict]:
    """Find all events for April 16th from the active DFP."""
    all_events = []
    
    # Check if there's a publishedSchedules section
    if 'publishedSchedules' in mock_data and build_date in mock_data['publishedSchedules']:
        events = mock_data['publishedSchedules'][build_date]
        all_events.extend(events)
        print(f"{GREEN}Found {len(events)} events in publishedSchedules for {build_date}{RESET}")
    
    # Also check if there are events directly in the data
    if 'events' in mock_data:
        events_on_date = [e for e in mock_data['events'] if e.get('date') == build_date]
        all_events.extend(events_on_date)
        if events_on_date:
            print(f"{GREEN}Found {len(events_on_date)} additional events for {build_date}{RESET}")
    
    return all_events

def calculate_priority_score(event: Dict, trainees: List[Dict], scores: List[Dict]) -> int:
    """
    Calculate priority score for a flight event based on the algorithm used in App.tsx.
    
    Formula from calculateTraineePriorityScore:
    - daysSinceEvent * 2
    - daysSinceFlight * 1
    - lag * 5 (lag = courseMedian - traineeProgress)
    - +500 if remedial
    """
    # Get trainee for this event
    event_trainee = None
    student_name = event.get('student') or event.get('pilot', '')
    
    if student_name:
        event_trainee = next((t for t in trainees if t.get('fullName') == student_name), None)
    
    if not event_trainee:
        return 0
    
    # Get trainee scores
    trainee_scores = [s for s in scores if s.get('trainee') == student_name]
    trainee_progress = len([s for s in trainee_scores if not s.get('event', '').startswith('-REM-')])
    
    # Calculate course median (simplified)
    course = event_trainee.get('course', '')
    course_trainees = [t for t in trainees if t.get('course') == course]
    if not course_trainees:
        course_median = 0
    else:
        all_progress = []
        for t in course_trainees:
            t_scores = [s for s in scores if s.get('trainee') == t.get('fullName')]
            progress = len([s for s in t_scores if not s.get('event', '').startswith('-REM-')])
            all_progress.append(progress)
        all_progress.sort()
        mid = len(all_progress) // 2
        course_median = all_progress[mid] if all_progress else 0
    
    # Calculate days since last event and last flight
    build_date = datetime.strptime("2026-04-16", "%Y-%m-%d")
    last_event_date_str = event_trainee.get('lastEventDate', '')
    last_flight_date_str = event_trainee.get('lastFlightDate', '')
    
    if last_event_date_str:
        last_event_date = datetime.strptime(last_event_date_str, "%Y-%m-%d")
        days_since_event = (build_date - last_event_date).days
    else:
        days_since_event = 100  # Default value from App.tsx
    
    if last_flight_date_str:
        last_flight_date = datetime.strptime(last_flight_date_str, "%Y-%m-%d")
        days_since_flight = (build_date - last_flight_date).days
    else:
        days_since_flight = 100  # Default value from App.tsx
    
    # Calculate lag (how far behind median)
    lag = course_median - trainee_progress
    
    # Calculate priority score
    score = 0
    score += days_since_event * 2
    score += days_since_flight * 1
    score += lag * 5
    
    # Check if remedial
    flight_number = event.get('flightNumber', '')
    is_remedial = '-REM-' in flight_number or event.get('isRemedial', False)
    if is_remedial:
        score += 500
    
    return score

def main():
    print(f"\n{BLUE}{'=' * 80}{RESET}")
    print(f"{BLUE}Analyzing Active DFP for April 16th - 10 Lowest Priority Flight Events{RESET}")
    print(f"{BLUE}{'=' * 80}\n")
    
    # Load data
    mock_data_path = "mockData.ts"
    print(f"{YELLOW}Loading data from {mock_data_path}...{RESET}")
    
    try:
        content = open(mock_data_path, 'r').read()
        
        # Extract trainees
        trainees_match = re.search(r'export const mockTrainees: Trainee\[\] = (\[[^\]]+\]);', content, re.DOTALL)
        if trainees_match:
            # Parse trainees array
            trainees_str = trainees_match.group(1)
            # Simple extraction of trainee objects
            trainee_objects = re.findall(r'{[^}]+}?', trainees_str)
            print(f"{GREEN}Extracted {len(trainee_objects)} trainees{RESET}")
        
        # Extract scores
        scores_match = re.search(r'export const mockScores: Score\[\] = (\[[^\]]+\]);', content, re.DOTALL)
        if scores_match:
            scores_str = scores_match.group(1)
            print(f"{GREEN}Found scores data{RESET}")
        
        # For this analysis, let's look at the App.tsx to see how we can get the actual data
        print(f"\n{YELLOW}Analyzing App.tsx for actual implementation...{RESET}")
        
    except Exception as e:
        print(f"{RED}Error loading data: {e}{RESET}")
    
    # Now let's analyze the actual build algorithm in App.tsx
    print(f"\n{YELLOW}Extracting build algorithm information from App.tsx...{RESET}")
    
    app_path = "App.tsx"
    try:
        with open(app_path, 'r', encoding='utf-8') as f:
            app_content = f.read()
        
        # Look for the sortTrainees function and priority calculation
        sort_trainees_match = re.search(
            r'const sortTrainees = \([^)]+\) => ([^;]+) => number[^{]*{([^}]+)}',
            app_content,
            re.DOTALL
        )
        
        if sort_trainees_match:
            print(f"{GREEN}Found sortTrainees function{RESET}")
        
        # Look for nextEventLists creation
        next_events_match = re.search(
            r'const nextEventLists: NextEventLists[^{]*{([^}]+)}',
            app_content
        )
        
        if next_events_match:
            print(f"{GREEN}Found nextEventLists structure{RESET}")
        
    except Exception as e:
        print(f"{RED}Error reading App.tsx: {e}{RESET}")
    
    print(f"\n{BLUE}{'=' * 80}{RESET}")
    print(f"{YELLOW}Note: To get the actual 10 lowest priority flight events for April 16th,{RESET}")
    print(f"{YELLOW}we need to:{RESET}")
    print(f"{YELLOW}1. Load the active DFP events for April 16th{RESET}")
    print(f"{YELLOW}2. Identify all flight events in the Next Event Lists (flight, BNF){RESET}")
    print(f"{YELLOW}3. Calculate priority scores using the algorithm from sortTrainees{RESET}")
    print(f"{YELLOW}4. Sort by priority and return the 10 lowest{RESET}")
    print(f"{BLUE}{'=' * 80}\n")

if __name__ == "__main__":
    main()