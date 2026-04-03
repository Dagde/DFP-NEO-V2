# DFP-NEO STBY Instructor Fix

## Root Cause Identified & Fixed
`isInstructorAvailableForEvent` used 1.25h pre-brief + 0.5h post-brief windows.
An instructor with 2 flights in the main build had booking windows spanning the entire
flying day (e.g. 6:45-13:00), blocking ALL STBY slots.

## Fix Applied (commit b7ff518a)
Added `isInstructorAvailableForStby()` that uses actual flight time + turnaround buffer only.
STBY is overflow — instructors are already at work and briefed. Only the actual flight
duration + turnaround needs to be conflict-free, not the full 1.25h brief window.

## Tasks
- [x] Add `isInstructorAvailableForStby` function (actual flight time + turnaround only)
- [x] Use it in `findBestInstructorForStby` instead of `isInstructorAvailableForEvent`
- [x] Build bundle
- [x] Commit and push (b7ff518a)