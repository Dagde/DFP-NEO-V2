import React from 'react';
import { Trainee } from '../types';
import { Score } from '../types';
import { Pt051Assessment } from '../types';

interface PT051HateSheetViewProps {
  trainee: Trainee;
  lmpScores: Score[];
  assessments: Pt051Assessment[];
  onSelectLmpScore: (score: Score) => void;
}

const PT051HateSheetView: React.FC<PT051HateSheetViewProps> = ({
  trainee,
  lmpScores,
  assessments,
  onSelectLmpScore
}) => {
  return (
    <div className="hate-sheet-view" style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <div className="trainee-header" style={{ marginBottom: '20px', borderBottom: '2px solid #ccc', paddingBottom: '10px' }}>
        <h2 style={{ margin: 0, color: '#333' }}>PT-051 Hate Sheet</h2>
        <div style={{ marginTop: '10px' }}>
          <strong>Trainee:</strong> {trainee.fullName} ({trainee.rank})
          <br />
          <strong>Course:</strong> {trainee.course}
          <br />
          <strong>Unit:</strong> {trainee.unit}
          {trainee.flight && <><br /><strong>Flight:</strong> {trainee.flight}</>}
          {trainee.service && <><br /><strong>Service:</strong> {trainee.service}</>}
        </div>
      </div>

      <div className="assessments-section" style={{ marginBottom: '30px' }}>
        <h3 style={{ color: '#555', borderBottom: '1px solid #ddd', paddingBottom: '5px' }}>
          PT-051 Assessments ({assessments.length})
        </h3>
        {assessments.length === 0 ? (
          <p style={{ color: '#666', fontStyle: 'italic' }}>No PT-051 assessments found for this trainee.</p>
        ) : (
          <div style={{ display: 'grid', gap: '15px' }}>
            {assessments.map((assessment) => (
              <div key={assessment.id} style={{ 
                border: '1px solid #ddd', 
                borderRadius: '5px', 
                padding: '15px',
                backgroundColor: '#f9f9f9'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                  <strong>{assessment.flightNumber}</strong>
                  <span style={{ color: assessment.overallResult === 'P' ? 'green' : assessment.overallResult === 'F' ? 'red' : '#666' }}>
                    {assessment.overallResult || 'Pending'}
                  </span>
                </div>
                <div style={{ fontSize: '0.9em', color: '#666' }}>
                  <div><strong>Date:</strong> {new Date(assessment.date).toLocaleDateString()}</div>
                  <div><strong>Instructor:</strong> {assessment.instructorName}</div>
                  {assessment.overallGrade && (
                    <div><strong>Grade:</strong> {assessment.overallGrade}</div>
                  )}
                  {assessment.dcoResult && (
                    <div><strong>DCO Result:</strong> {assessment.dcoResult}</div>
                  )}
                  {assessment.overallComments && (
                    <div style={{ marginTop: '5px' }}><strong>Comments:</strong> {assessment.overallComments}</div>
                  )}
                </div>
                {assessment.scores.length > 0 && (
                  <div style={{ marginTop: '10px' }}>
                    <strong>Element Scores:</strong>
                    <ul style={{ margin: '5px 0', paddingLeft: '20px' }}>
                      {assessment.scores.map((score, index) => (
                        <li key={index} style={{ fontSize: '0.85em' }}>
                          {score.element}: {score.grade || 'Not graded'}
                          {score.comment && <span> - {score.comment}</span>}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="lmp-scores-section">
        <h3 style={{ color: '#555', borderBottom: '1px solid #ddd', paddingBottom: '5px' }}>
          LMP Scores ({lmpScores.length})
        </h3>
        {lmpScores.length === 0 ? (
          <p style={{ color: '#666', fontStyle: 'italic' }}>No LMP scores found for this trainee.</p>
        ) : (
          <div style={{ display: 'grid', gap: '10px' }}>
            {lmpScores.map((score, index) => (
              <div 
                key={index} 
                onClick={() => onSelectLmpScore(score)}
                style={{ 
                  border: '1px solid #ddd', 
                  borderRadius: '5px', 
                  padding: '10px',
                  backgroundColor: '#fff',
                  cursor: 'pointer',
                  transition: 'background-color 0.2s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f0f0f0'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#fff'}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <strong>{score.event}</strong>
                  <span style={{ 
                    color: score.score >= 4 ? 'green' : score.score >= 3 ? 'orange' : 'red',
                    fontWeight: 'bold'
                  }}>
                    {score.score}/5
                  </span>
                </div>
                <div style={{ fontSize: '0.9em', color: '#666' }}>
                  <div><strong>Date:</strong> {new Date(score.date).toLocaleDateString()}</div>
                  <div><strong>Instructor:</strong> {score.instructor}</div>
                  {score.notes && <div><strong>Notes:</strong> {score.notes}</div>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default PT051HateSheetView;
