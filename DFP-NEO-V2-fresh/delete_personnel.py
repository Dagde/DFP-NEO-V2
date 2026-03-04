#!/usr/bin/env python3
"""
Script to delete specific personnel records from the database.
This script requires authentication credentials to access the API.
"""

import requests
import json

# API base URL
BASE_URL = "https://dfp-neo.com"

def get_personnel_records(auth_token):
    """Fetch all personnel records"""
    headers = {
        'Authorization': f'Bearer {auth_token}',
        'Content-Type': 'application/json'
    }
    
    response = requests.get(f'{BASE_URL}/api/personnel', headers=headers)
    if response.status_code == 200:
        return response.json()
    else:
        print(f"Error fetching personnel: {response.status_code}")
        return None

def delete_personnel_record(auth_token, personnel_id):
    """Delete a specific personnel record by ID"""
    headers = {
        'Authorization': f'Bearer {auth_token}',
        'Content-Type': 'application/json'
    }
    
    response = requests.delete(f'{BASE_URL}/api/personnel/{personnel_id}', headers=headers)
    if response.status_code == 200:
        print(f"✓ Successfully deleted personnel record ID: {personnel_id}")
        return True
    else:
        print(f"✗ Failed to delete personnel record ID: {personnel_id}")
        print(f"  Status: {response.status_code}")
        print(f"  Response: {response.text}")
        return False

def main():
    print("Personnel Record Deletion Script")
    print("=" * 50)
    
    # You need to provide an authentication token
    auth_token = input("Enter your authentication token: ").strip()
    
    # Fetch all personnel records
    print("\nFetching personnel records...")
    personnel = get_personnel_records(auth_token)
    
    if not personnel:
        print("Failed to fetch personnel records.")
        return
    
    # Search for Daniel Dawe and Daniel Evans
    print(f"\nFound {len(personnel)} total personnel records")
    print("\nSearching for 'Daniel Dawe' and 'Daniel Evans'...")
    
    target_records = []
    for record in personnel:
        full_name = f"{record.get('firstName', '')} {record.get('lastName', '')}"
        if 'Daniel Dawe' in full_name or 'Daniel Evans' in full_name:
            target_records.append(record)
            print(f"\nFound: {full_name}")
            print(f"  ID: {record.get('id')}")
            print(f"  Rank: {record.get('rank')}")
            print(f"  Service: {record.get('service')}")
    
    if not target_records:
        print("\nNo matching records found for 'Daniel Dawe' or 'Daniel Evans'")
        return
    
    # Confirm deletion
    print(f"\n{'='*50}")
    print(f"Found {len(target_records)} matching record(s) to delete")
    print(f"{'='*50}")
    
    confirm = input("\nDo you want to delete these records? (yes/no): ").strip().lower()
    
    if confirm == 'yes':
        print("\nDeleting records...")
        success_count = 0
        for record in target_records:
            if delete_personnel_record(auth_token, record['id']):
                success_count += 1
        
        print(f"\n{'='*50}")
        print(f"Successfully deleted {success_count}/{len(target_records)} record(s)")
        print(f"{'='*50}")
    else:
        print("\nDeletion cancelled.")

if __name__ == "__main__":
    main()