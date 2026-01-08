# NEO Build Investigation - STBY Events Only

## Problem
- NEO Build is only scheduling STBY (standby) events
- No flight events, FTD events, CPT events, or Ground events are being scheduled
- All trainees are being placed on STBY lines

## Investigation Tasks
- [x] Analyze screenshot and logs
- [ ] Analyze the computeNextEventsForTrainee function logic
- [ ] Check prerequisite validation logic
- [ ] Verify event types being generated
- [ ] Check if aircraft and instructor availability is blocking events
- [ ] Review the generateDfpInternal function for scheduling logic
- [ ] Examine why only Duty Supervisor events are being created

## Next Steps
- Review App.tsx NEO Build algorithm
- Check event type definitions and filtering
- Verify resource availability constraints