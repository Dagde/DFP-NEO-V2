/**
 * Default Phrase Bank Configuration
 * Contains default radio communication assessment phrases for grading rubrics.
 * This is APPLICATION CONFIGURATION - not mock data.
 * Extracted from mockData.ts as part of mock data removal project.
 */

import { PhraseBank } from '../types';

export const DEFAULT_PHRASE_BANK: PhraseBank = {
    'Airmanship': {
        5: [
            'Operates the aircraft safely and effectively at all times.',
            'Organised and deals with all situations effectively, under all workloads.',
            'Handles non-standard situations capably with a high level of confidence.',
            'Excellent decision making based on situational awareness and prioritised attention.'
        ],
        4: [
            'Operates the aircraft safely and effectively.',
            'Handles most normal situations well.',
            'Needs occasional help with non-standard routines but does not become confused under moderate workloads.',
            'Very good decision making based on situational awareness and prioritised attention.',
            'Sometimes overlooks some considerations but not to the detriment of safety.'
        ],
        3: [
            'Operates the aircraft safely.',
            'Copes with normal situations.',
            'Occasionally slow to react to new or developing situations.',
            'Makes basic decisions and applies the basic considerations.',
            'Adequate confidence and decision making ability.'
        ],
        2: [
            'Operates the aircraft safely in familiar situations.',
            'Slow to react to new or developing situations.',
            'Makes basic decisions in familiar situations.',
            'Sometimes unsure in new or more advanced sequences.',
            'Developing confidence and decision making ability.'
        ],
        1: [
            'Just coping with familiar situations.',
            'Had difficulty applying normal procedures.',
            'Often deviated from more complex or advanced routines.',
            'Showed a lack of situational awareness.',
            'Made basic decisions but was sometimes overwhelmed or task saturated by basic sequences.',
            'Not confident.',
            'Uncharacteristic major safety breach.'
        ],
        0: [
            'Poor.',
            'Frequently deviated from normal procedures.',
            'Not able to cope with familiar situations.',
            'Demonstrated likelihood of violating aircraft and operational limits.',
            'Frequently task-saturated by basic sequences.',
            'Easily confused and often disorganised.',
            'Excessively under or over confident.',
            'Repeated safety breaches.'
        ]
    },
    'Preparation': {
        5: [
            'Always fully prepared.',
            'An excellent understanding of sortie requirements.',
            'Focussed and committed to continuous improvement.',
            'Prepared technique and sequences to a very high standard.',
            'Enthusiastic and motivated to achieve excellence.'
        ],
        4: [
            'Well prepared.',
            'Researched widely to develop a sound understanding of all sortie aspects.',
            'Focussed and committed to improvement.',
            'Prepared technique and sequences to a high standard.',
            'Enthusiastic and motivated.'
        ],
        3: [
            'Adequately prepared.',
            'A satisfactory understanding of sortie requirements.',
            'Prepared required technique and sequences.',
            'Satisfactory motivation.'
        ],
        2: [
            'Partially prepared.',
            'Some gaps in understanding of sortie requirements.',
            'Partially prepared required technique and sequences.',
            'Required prompting in some areas.'
        ],
        1: [
            'Poorly prepared.',
            'Significant gaps in understanding of sortie requirements.',
            'Inadequately prepared required technique and sequences.',
            'Required significant prompting.'
        ],
        0: [
            'Not prepared.',
            'No understanding of sortie requirements.',
            'Did not prepare required technique or sequences.',
            'Unable to proceed without full instructor support.'
        ]
    },
    'Technique': {
        5: [
            'Aircraft control precise and smooth at all times.',
            'Excellent management of aircraft energy.',
            'Proactively manages all aspects of the sortie.',
            'Techniques mastered to a very high standard.'
        ],
        4: [
            'Aircraft control accurate and mostly smooth.',
            'Good management of aircraft energy.',
            'Manages most aspects of the sortie effectively.',
            'Good technical standard overall.'
        ],
        3: [
            'Aircraft control adequate.',
            'Satisfactory management of aircraft energy.',
            'Manages basic aspects of the sortie.',
            'Acceptable technical standard.'
        ],
        2: [
            'Aircraft control developing.',
            'Some difficulty managing aircraft energy.',
            'Manages basic aspects with some prompting.',
            'Technical standard requires improvement.'
        ],
        1: [
            'Aircraft control below standard.',
            'Difficulty managing aircraft energy.',
            'Requires regular prompting.',
            'Technical standard unsatisfactory.'
        ],
        0: [
            'Aircraft control unacceptable.',
            'Unable to manage aircraft energy.',
            'Requires constant prompting and assistance.',
            'Technical standard dangerous.'
        ]
    },
    'Communication': {
        5: [
            'RT phraseology precise, professional, and correct at all times.',
            'Listens out effectively, never misses a call.',
            'Maintains excellent situational awareness of radio environment.',
            'Sets an exemplary standard of RT discipline.'
        ],
        4: [
            'RT phraseology accurate and professional.',
            'Rarely misses a radio call.',
            'Good situational awareness of radio environment.',
            'High standard of RT discipline.'
        ],
        3: [
            'RT phraseology generally correct.',
            'Occasionally misses a radio call.',
            'Adequate situational awareness of radio environment.',
            'Satisfactory RT discipline.'
        ],
        2: [
            'RT phraseology sometimes incorrect.',
            'Misses some radio calls.',
            'Developing situational awareness of radio environment.',
            'RT discipline requires improvement.'
        ],
        1: [
            'RT phraseology frequently incorrect.',
            'Misses many radio calls.',
            'Limited situational awareness of radio environment.',
            'RT discipline unsatisfactory.'
        ],
        0: [
            'RT phraseology unacceptable.',
            'Unable to maintain radio watch.',
            'No situational awareness of radio environment.',
            'RT discipline dangerous or absent.'
        ]
    },
    'Cockpit Management': {
        5: [
            'Cockpit management exemplary.',
            'All checks and procedures completed accurately and on time.',
            'Excellent prioritisation of tasks under all workloads.',
            'Proactively manages cockpit environment.'
        ],
        4: [
            'Cockpit management of a high standard.',
            'Checks and procedures completed accurately.',
            'Good prioritisation of tasks.',
            'Manages cockpit environment effectively.'
        ],
        3: [
            'Cockpit management satisfactory.',
            'Checks and procedures generally completed.',
            'Adequate prioritisation of tasks.',
            'Manages basic cockpit requirements.'
        ],
        2: [
            'Cockpit management developing.',
            'Some checks or procedures missed or late.',
            'Difficulty prioritising tasks under moderate workload.',
            'Requires prompting for cockpit management.'
        ],
        1: [
            'Cockpit management unsatisfactory.',
            'Frequently misses checks or procedures.',
            'Unable to prioritise tasks effectively.',
            'Requires regular prompting.'
        ],
        0: [
            'Cockpit management dangerous.',
            'Critical checks or procedures missed.',
            'Task saturated; unable to manage cockpit.',
            'Work cycles disorganised or absent.',
            'Easily overwhelmed; demonstrates unsafe or inconsistent behaviour.'
        ]
    }
};